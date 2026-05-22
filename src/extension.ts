import * as vscode from 'vscode';
import { DevOpsCache } from './core/DevOpsCache';
import { ConfigManager, ExtensionConfig } from './vscode/ConfigManager';
import { DevOpsCommitMetadata, DevOpsProvider } from './core/DevOpsProvider';
import { formatDevOpsCommitMetadata } from './core/DevOpsCommitFormatter';
import { hasCommittableChanges, pickWorkingCopy, svnCommit, validateCommitMessage, formatSvnError, getChangedFiles, isCommittable, isUnversioned, getStatusLabel } from './vscode/svn';
import { createProvider } from './vscode/providerFactory';
import { collectDevOpsCommitMetadata } from './vscode/QuickPickFlow';

export function activate(context: vscode.ExtensionContext): void {
  const configManager = new ConfigManager(context.secrets);
  let cache: DevOpsCache | undefined;

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('svnLinkPush')) {
        cache = undefined;
      }
    }),
    vscode.commands.registerCommand('svnLinkPush.initializeDevOps', async () => {
      await configManager.initializeDevOpsAccount();
      cache = undefined;
    }),
    vscode.commands.registerCommand('svnLinkPush.clearCache', () => {
      if (cache) {
        cache.clear();
        vscode.window.showInformationMessage('DevOps 缓存已清除。');
      } else {
        vscode.window.showInformationMessage('缓存为空，无需清除。');
      }
    }),
    // 关联 DevOps 任务并提交到 SVN
    vscode.commands.registerCommand('svnLinkPush.commitToSvn', async () => {
      const config = await configManager.load();
      cache ??= new DevOpsCache(config.cacheTtlMs);
      await runCommitToSvn(config, cache);
    })
  );
}

export function deactivate(): void { }

/**
 * 主流程：收集 DevOps 任务信息 → 生成提交信息 → SVN 提交 → 登记工时
 */
async function runCommitToSvn(config: ExtensionConfig, cache: DevOpsCache): Promise<void> {
  try {
    // 查找 SVN 工作副本
    const cwd = await pickWorkingCopy();
    if (!cwd) {
      vscode.window.showWarningMessage('当前没有打开 SVN 工作副本。请确保工作区目录受 SVN 版本控制。');
      return;
    }

    // 检查是否有可提交的改动
    if (!(await hasCommittableChanges(cwd))) {
      vscode.window.showWarningMessage('当前没有可提交的改动。请先修改文件。');
      return;
    }

    // 收集 DevOps 任务信息
    const provider = createProvider(config);
    const metadata = await collectDevOpsCommitMetadata(provider, cache, config);
    if (!metadata) {
      return;
    }

    // 生成并校验提交信息
    const message = formatDevOpsCommitMetadata(config.commitTemplate, metadata);
    validateCommitMessage(message);

    // 让用户选择要提交的文件
    const fileSelection = await pickFilesToCommit(cwd);
    if (!fileSelection) {
      return;
    }

    // 提交到 SVN
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在提交代码到 SVN',
        cancellable: false
      },
      async () => {
        await svnCommit(cwd, message, fileSelection.files, fileSelection.unversioned);
      }
    );

    // 登记工时到 DevOps
    await recordHours(provider, metadata, config);
    vscode.window.showInformationMessage('代码已提交到 SVN，工时已登记到 DevOps。');
  } catch (error) {
    vscode.window.showErrorMessage(formatSvnError(error));
  }
}

/**
 * 登记工时到 DevOps
 */
async function recordHours(
  provider: DevOpsProvider,
  metadata: DevOpsCommitMetadata,
  config: ExtensionConfig
): Promise<void> {
  const createTime = new Date().toISOString().split('T')[0];
  const spendTaskTime = calcSpendTaskTime(metadata, config.workHourMode);
  const dayCompletion = calcDayCompletion(metadata, config.progressMode);
  const taskId = metadata.task.id || metadata.task.code;

  if (metadata.todayWorkHour && provider.modifyWorkHour) {
    const workContent = calcWorkContent(metadata, config.workContentMode);
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在更新今日工时到 DevOps',
        cancellable: false
      },
      async () => {
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
    const workContent = `• ${metadata.subject}`;
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
          workContent,
          metadata.workHourTypeCode
        );
      }
    );
  }
}

interface FileSelection {
  /** 选中的所有文件路径 */
  files: string[];
  /** 其中需要先 svn add 的未版本控制文件 */
  unversioned: string[];
}

/** 文件选择时自动排除的目录名（构建产物、IDE 配置等） */
const IGNORED_DIR_SEGMENTS = new Set(['target', '.idea', '.settings', 'node_modules', 'bin', 'build', 'dist', '.vscode']);

/** 判断文件路径是否应被排除 */
function shouldIgnorePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments.some(seg => IGNORED_DIR_SEGMENTS.has(seg));
}

async function pickFilesToCommit(cwd: string): Promise<FileSelection | undefined> {
  const allFiles = await getChangedFiles(cwd);
  const committable = allFiles.filter(f => isCommittable(f.status) && !shouldIgnorePath(f.path));
  const ignoredCount = allFiles.filter(f => isCommittable(f.status) && shouldIgnorePath(f.path)).length;

  if (committable.length === 0) {
    vscode.window.showWarningMessage('没有可提交的文件改动。');
    return undefined;
  }

  // 如果只有一个可提交文件，直接选中
  if (committable.length === 1) {
    const f = committable[0];
    return {
      files: [f.path],
      unversioned: isUnversioned(f.status) ? [f.path] : []
    };
  }

  // 多个文件时让用户多选
  interface FilePickItem extends vscode.QuickPickItem {
    filePath: string;
    fileStatus: string;
  }

  const items: FilePickItem[] = committable.map(f => {
    const normalized = f.path.replace(/\\/g, '/');
    const segments = normalized.split('/');
    const fileName = segments[segments.length - 1];
    const dirPath = segments.length > 1 ? segments.slice(0, -1).join('/') : '';
    return {
      label: fileName,
      description: `[${getStatusLabel(f.status)}]`,
      detail: dirPath ? dirPath : f.path,
      picked: true,
      filePath: f.path,
      fileStatus: f.status
    };
  });

  const selected = await vscode.window.showQuickPick(items, {
    title: `选择要提交的文件${ignoredCount > 0 ? `（已自动排除 ${ignoredCount} 个构建产物文件）` : ''}`,
    placeHolder: '勾选要提交的文件，取消勾选则跳过',
    canPickMany: true,
    ignoreFocusOut: true
  });

  if (!selected || selected.length === 0) {
    return undefined;
  }

  const files = selected.map(item => item.filePath);
  const unversioned = selected
    .filter(item => isUnversioned(item.fileStatus))
    .map(item => item.filePath);

  return { files, unversioned };
}

function calcSpendTaskTime(metadata: DevOpsCommitMetadata, mode: 'append' | 'overwrite'): number {
  const input = Number(metadata.hours);
  if (mode === 'append' && metadata.todayWorkHour) {
    return metadata.todayWorkHour.spendTaskTime + input;
  }
  return input;
}

function calcDayCompletion(metadata: DevOpsCommitMetadata, mode: 'append' | 'overwrite'): string {
  const input = Number(metadata.progress);
  if (mode === 'append' && metadata.todayWorkHour) {
    const existing = parseFloat(metadata.todayWorkHour.dayCompletion) || 0;
    return `${Math.min(existing + input, 100)}%`;
  }
  return `${input}%`;
}

function calcWorkContent(metadata: DevOpsCommitMetadata, mode: 'append' | 'overwrite'): string {
  const entry = `• ${metadata.subject}`;
  if (mode === 'append' && metadata.todayWorkHour) {
    return metadata.todayWorkHour.workContent + '\n' + entry;
  }
  return entry;
}
