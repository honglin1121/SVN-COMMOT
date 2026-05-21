import * as cp from 'node:child_process';
import * as util from 'node:util';
import * as vscode from 'vscode';
import { DevOpsCache } from './core/DevOpsCache';
import { ConfigManager, ExtensionConfig } from './vscode/ConfigManager';
import { AmendStrategy, checkBranchState } from './vscode/AmendStrategy';
import { DevOpsCommitMetadata, DevOpsProvider } from './core/DevOpsProvider';
import { formatDevOpsCommitMetadata } from './core/DevOpsCommitFormatter';
import { getGitApi, getCurrentBranchName, hasStagedChanges, listRemotes, pickRepository, Repository } from './vscode/git';
import { createProvider } from './vscode/providerFactory';
import { collectDevOpsCommitMetadata } from './vscode/QuickPickFlow';

const execFile = util.promisify(cp.execFile);

export function activate(context: vscode.ExtensionContext): void {
  const configManager = new ConfigManager(context.secrets);
  let cache: DevOpsCache | undefined;

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('issueLinkPush')) {
        cache = undefined;
      }
    }),
    vscode.commands.registerCommand('issueLinkPush.initializeDevOps', async () => {
      await configManager.initializeDevOpsAccount();
      cache = undefined;
    }),
    // @AI-Begin W3F6G 20260518 @@clearCache
    vscode.commands.registerCommand('issueLinkPush.clearCache', () => {
      if (cache) {
        cache.clear();
        vscode.window.showInformationMessage('DevOps 缓存已清除。');
      } else {
        vscode.window.showInformationMessage('缓存为空，无需清除。');
      }
    }),
    // @AI-End W3F6G 20260518 @@cc
    vscode.commands.registerCommand('issueLinkPush.submitWithDevOpsTask', async () => {
      const config = await configManager.load();
      cache ??= new DevOpsCache(config.cacheTtlMs);
      await runSubmitWithDevOpsTask(config, cache);
    }),
    // @AI-Begin B6C7D 20260520 @@cc
    vscode.commands.registerCommand('issueLinkPush.commitAndPush', async () => {
      const config = await configManager.load();
      cache ??= new DevOpsCache(config.cacheTtlMs);
      await runCommitAndPush(config, cache);
    })
    // @AI-End B6C7D 20260520 @@cc
  );
}

export function deactivate(): void { }

// @AI-Begin D8E4F 20260520 @@cc
interface PushTarget {
  hasUpstream: boolean;
  remoteName?: string;
  branchName?: string;
}
// @AI-End D8E4F 20260520 @@cc

async function runSubmitWithDevOpsTask(config: ExtensionConfig, cache: DevOpsCache): Promise<void> {
  try {
    const git = await getGitApi();
    const repository = await pickRepository(git);
    if (!repository) {
      vscode.window.showWarningMessage('当前没有打开 Git 仓库。');
      return;
    }

    const cwd = repository.rootUri.fsPath;

    // @AI-Begin F1G3H 20260520 @@cc
    const pushTarget = await resolvePushTarget(cwd, repository);
    if (!pushTarget) {
      return;
    }
    // @AI-End F1G3H 20260520 @@cc

    const provider = createProvider(config);
    const metadata = await collectDevOpsCommitMetadata(provider, cache, config.commitTemplate);
    if (!metadata) {
      return;
    }

    const strategy = new AmendStrategy(cwd);
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在写入 DevOps 信息到 commit',
        cancellable: false
      },
      () => strategy.apply(metadata, config.commitTemplate)
    );

    await pushAndRecordHours({
      repository,
      cwd,
      pushTarget,
      provider,
      metadata,
      onPushFailure: () => recoverAmend(cwd),
      successMessage: 'DevOps 信息已写入，推送并登记工时完成。'
    });
  } catch (error) {
    vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
  }
}

// @AI-Begin E8F9G 20260520 @@cc
async function runCommitAndPush(config: ExtensionConfig, cache: DevOpsCache): Promise<void> {
  try {
    const git = await getGitApi();
    const repository = await pickRepository(git);
    if (!repository) {
      vscode.window.showWarningMessage('当前没有打开 Git 仓库。');
      return;
    }

    const cwd = repository.rootUri.fsPath;

    if (!(await hasStagedChanges(cwd))) {
      vscode.window.showWarningMessage('当前没有已暂存的改动。请先 git add 暂存要提交的文件。');
      return;
    }

    const pushTarget = await resolvePushTarget(cwd, repository, false);
    if (!pushTarget) {
      return;
    }

    const provider = createProvider(config);
    const metadata = await collectDevOpsCommitMetadata(provider, cache, config.commitTemplate);
    if (!metadata) {
      return;
    }

    const message = formatDevOpsCommitMetadata(config.commitTemplate, metadata);
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在提交代码',
        cancellable: false
      },
      async () => {
        await execFile('git', ['commit', '-m', message], { cwd });
      }
    );

    await pushAndRecordHours({
      repository,
      cwd,
      pushTarget,
      provider,
      metadata,
      onPushFailure: () => recoverCommit(cwd),
      successMessage: '代码已提交，推送并登记工时完成。'
    });
  } catch (error) {
    vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
  }
}

async function recoverCommit(cwd: string): Promise<void> {
  try {
    await execFile('git', ['reset', '--soft', 'HEAD~1'], { cwd });
  } catch {
    // 恢复失败不掩盖原始错误
  }
}
// @AI-End E8F9G 20260520 @@cc

// @AI-Begin H0I1J 20260520 @@cc
interface PushAndRecordOptions {
  repository: Repository;
  cwd: string;
  pushTarget: PushTarget;
  provider: DevOpsProvider;
  metadata: DevOpsCommitMetadata;
  onPushFailure: () => Promise<void>;
  successMessage: string;
}

async function pushAndRecordHours(options: PushAndRecordOptions): Promise<void> {
  const { repository, cwd, pushTarget, provider, metadata, onPushFailure } = options;

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在推送代码',
        cancellable: false
      },
      () => {
        if (pushTarget.hasUpstream) {
          return repository.push();
        }
        return repository.push(pushTarget.remoteName, pushTarget.branchName, true);
      }
    );
  } catch (pushError) {
    await onPushFailure();
    throw pushError;
  }

  // @AI-Begin M9N0P 20260518 @@cc
  const createTime = new Date().toISOString().split('T')[0];
  const spendTaskTime = Number(metadata.hours);
  const dayCompletion = `${metadata.progress}%`;
  const taskId = metadata.task.id || metadata.task.code;

  if (metadata.todayWorkHour && provider.modifyWorkHour) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在更新今日工时到 DevOps',
        cancellable: false
      },
      async () => {
        const workContent = metadata.todayWorkHour!.workContent + '\n' + metadata.subject;
        await provider.modifyWorkHour!(
          metadata.todayWorkHour!.taskWorkhourId,
          taskId,
          createTime,
          spendTaskTime,
          dayCompletion,
          workContent,
          metadata.workHourTypeCode
        );
      }
    );
  } else if (provider.addWorkHour) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在登记工时到 DevOps',
        cancellable: false
      },
      async () => {
        await provider.addWorkHour!(
          taskId,
          createTime,
          spendTaskTime,
          dayCompletion,
          metadata.subject,
          metadata.workHourTypeCode
        );
      }
    );
  }
  // @AI-End M9N0P 20260518 @@cc

  vscode.window.showInformationMessage(options.successMessage);
}
// @AI-End H0I1J 20260520 @@cc

// @AI-Begin P2Q4R 20260520 @@cc
async function resolvePushTarget(cwd: string, repository: Repository, requireUnpushedCommits = true): Promise<PushTarget | null> {
  const state = await checkBranchState(cwd);

  if (requireUnpushedCommits && !state.hasUnpushedCommits) {
    vscode.window.showWarningMessage('当前没有未推送的 commit。');
    return null;
  }

  if (state.hasUpstream) {
    return { hasUpstream: true };
  }

  const remotes = await listRemotes(cwd);
  if (remotes.length === 0) {
    vscode.window.showErrorMessage('当前仓库没有配置 remote，请先执行 git remote add 添加远程仓库。');
    return null;
  }

  let remoteName: string;
  if (remotes.length === 1) {
    remoteName = remotes[0];
  } else {
    const picked = await vscode.window.showQuickPick(
      remotes.map((r) => ({ label: r })),
      { placeHolder: '当前分支没有 upstream，请选择要推送到的远程仓库' }
    );
    if (!picked) {
      return null;
    }
    remoteName = picked.label;
  }

  const localBranch = getCurrentBranchName(repository) ?? 'main';

  const remoteBranch = await vscode.window.showInputBox({
    prompt: `将推送到 ${remoteName}，请输入远程分支名`,
    value: localBranch,
    validateInput: (value) => {
      if (!value.trim()) {
        return '远程分支名不能为空';
      }
      return null;
    }
  });
  if (!remoteBranch) {
    return null;
  }

  return {
    hasUpstream: false,
    remoteName,
    branchName: remoteBranch.trim()
  };
}
// @AI-End P2Q4R 20260520 @@cc

async function recoverAmend(cwd: string): Promise<void> {
  try {
    const { stdout } = await execFile('git', ['rev-parse', 'HEAD@{1}'], { cwd });
    const prevCommit = stdout.trim();
    if (prevCommit) {
      await execFile('git', ['reset', '--soft', 'HEAD@{1}'], { cwd });
    }
  } catch {
    // 恢复失败不掩盖原始错误
  }
}
