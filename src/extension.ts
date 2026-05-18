import * as vscode from 'vscode';
import { DevOpsCache } from './core/DevOpsCache';
import { ConfigManager, ExtensionConfig } from './vscode/ConfigManager';
import { AmendStrategy } from './vscode/AmendStrategy';
import { getGitApi, pickRepository } from './vscode/git';
import { createProvider } from './vscode/providerFactory';
import { collectDevOpsCommitMetadata } from './vscode/QuickPickFlow';

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
    // @AI-Begin W3F6G 20260518 @@cc
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
    })
  );
}

export function deactivate(): void { }

async function runSubmitWithDevOpsTask(config: ExtensionConfig, cache: DevOpsCache): Promise<void> {
  try {
    const git = await getGitApi();
    const repository = await pickRepository(git);
    if (!repository) {
      vscode.window.showWarningMessage('当前没有打开 Git 仓库。');
      return;
    }

    const provider = createProvider(config);
    const metadata = await collectDevOpsCommitMetadata(provider, cache, config.commitTemplate);
    if (!metadata) {
      return;
    }

    const strategy = new AmendStrategy(repository);
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在写入 DevOps 信息到 commit',
        cancellable: false
      },
      () => strategy.apply(metadata, config.commitTemplate)
    );

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在推送代码',
        cancellable: false
      },
      () => repository.push()
    );

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
            workContent
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
            metadata.subject
          );
        }
      );
    }
    // @AI-End M9N0P 20260518 @@cc

    vscode.window.showInformationMessage('DevOps 信息已写入，推送并登记工时完成。');
  } catch (error) {
    vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
  }
}
