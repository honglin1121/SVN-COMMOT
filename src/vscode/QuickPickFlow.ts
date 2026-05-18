import * as vscode from 'vscode';
import { DevOpsCache } from '../core/DevOpsCache';
import { formatDevOpsCommitMetadata } from '../core/DevOpsCommitFormatter';
import { DevOpsCommitMetadata, DevOpsProvider, DevOpsTaskType, WorkHourRecord } from '../core/DevOpsProvider';

const COMMIT_TYPES = [
  { label: 'feat', description: '增加新功能' },
  { label: 'fix', description: '修复 bug' },
  { label: 'perf', description: '性能或体验优化' },
  { label: 'refactor', description: '代码重构' },
  { label: 'test', description: '增加或调整测试' },
  { label: 'style', description: '格式、空格、缩进等不影响含义的改动' },
  { label: 'build', description: '构建、发布、依赖调整' },
  { label: 'chore', description: '日常维护或杂务处理' },
  { label: 'upd', description: '已有内容更新或修改' },
  { label: 'Merge', description: '合并操作，必须以 Merge 空格开头' },
  { label: 'doc', description: '文档改动' }
];

export async function collectDevOpsCommitMetadata(
  provider: DevOpsProvider,
  cache: DevOpsCache,
  commitTemplate: string
): Promise<DevOpsCommitMetadata | undefined> {
  const projects = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在加载 DevOps 产品列表',
      cancellable: false
    },
    () => cache.getProjects(provider)
  );

  const projectPick = await vscode.window.showQuickPick(
    projects.map((project) => ({
      label: project.name,
      project
    })),
    {
      title: '选择产品',
      placeHolder: '搜索产品名称',
      ignoreFocusOut: true
    }
  );

  if (!projectPick) {
    return undefined;
  }

  const taskTypePick = await vscode.window.showQuickPick(
    [
      { label: 'task', description: '开发任务', value: 'task' as const },
      { label: 'bug', description: '缺陷修复', value: 'bug' as const }
    ],
    {
      title: '选择工作项类型',
      placeHolder: 'task 或 bug',
      ignoreFocusOut: true
    }
  );

  if (!taskTypePick) {
    return undefined;
  }

  const taskType: DevOpsTaskType = taskTypePick.value;
  const tasks = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `正在加载 ${taskType} 列表`,
      cancellable: false
    },
    () => cache.getTasks(provider, projectPick.project.code, taskType)
  );

  if (tasks.length === 0) {
    vscode.window.showWarningMessage(`${projectPick.project.name} 下没有未完成的 ${taskType}。`);
    return undefined;
  }

  const taskPick = await vscode.window.showQuickPick(
    tasks.map((task) => ({
      label: task.code,
      description: task.status,
      detail: `${task.title}${formatTaskReference(task)}`,
      task
    })),
    {
      title: `选择一个 ${taskType}`,
      placeHolder: '搜索工作项编号或标题',
      ignoreFocusOut: true
    }
  );

  if (!taskPick) {
    return undefined;
  }

  // @AI-Begin J7K8L 20260518 @@cc
  let todayWorkHour: WorkHourRecord | undefined;
  if (provider.fetchWorkHours) {
    const taskId = taskPick.task.id || taskPick.task.code;
    todayWorkHour = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在查询今日工时记录',
        cancellable: false
      },
      async () => {
        const records = await provider.fetchWorkHours!(taskId);
        const today = new Date().toISOString().split('T')[0];
        return records.find((r) => r.taskWorkhourDate === today);
      }
    );
  }
  // @AI-End J7K8L 20260518 @@cc

  const commitTypePick = await vscode.window.showQuickPick(COMMIT_TYPES, {
    title: '选择 commit type',
    placeHolder: '必须以指定 type 开头',
    ignoreFocusOut: true
  });

  if (!commitTypePick) {
    return undefined;
  }

  const subject = await vscode.window.showInputBox({
    title: '输入提交说明 subject',
    prompt: '请输入本次提交的简短描述，例如：修复登录异常。',
    placeHolder: '修复xxxx缺陷',
    ignoreFocusOut: true,
    validateInput: validateSubject
  });

  if (subject === undefined) {
    return undefined;
  }

  // @AI-Begin J7K8L 20260518 @@cc
  const hoursPrompt = todayWorkHour
    ? `${formatTodayWorkHourHint(todayWorkHour)}\n${formatHoursReference(taskPick.task)}`
    : `请输入本次提交关联的 DevOps 工时。${formatHoursReference(taskPick.task)}`;

  const hours = await vscode.window.showInputBox({
    title: '输入投入工时',
    prompt: hoursPrompt,
    placeHolder: '例如：2 或 1.5',
    ignoreFocusOut: true,
    validateInput: validateHours
  });
  // @AI-End J7K8L 20260518 @@cc

  if (hours === undefined) {
    return undefined;
  }

  const progress = await vscode.window.showInputBox({
    title: '输入任务完成度',
    prompt: `请输入任务完成度百分比。${formatProgressReference(taskPick.task)}100 会让工作项自动置为已解决。`,
    placeHolder: '0-100',
    ignoreFocusOut: true,
    validateInput: validateProgress
  });

  if (progress === undefined) {
    return undefined;
  }

  // @AI-Begin J7K8L 20260518 @@cc
  const metadata: DevOpsCommitMetadata = {
    project: projectPick.project,
    task: taskPick.task,
    commitType: commitTypePick.label,
    subject: subject.trim(),
    hours: normalizeNumber(hours),
    progress: normalizeNumber(progress),
    todayWorkHour
  };
  // @AI-End J7K8L 20260518 @@cc
  const preview = formatDevOpsCommitMetadata(commitTemplate, metadata);
  const confirmation = await vscode.window.showInformationMessage(
    `即将把最新未推送 commit message 修改为：${preview}`,
    { modal: true },
    '确认并推送',
    '取消'
  );

  return confirmation === '确认并推送' ? metadata : undefined;
}

function validateSubject(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return '请输入提交说明。';
  }
  if (trimmed.length < 5) {
    return '提交说明不能少于 5 个字。';
  }
  if (trimmed.length > 250) {
    return '提交说明不能超过 250 个字。';
  }
  if (/scrum\s+-e/i.test(trimmed)) {
    return 'subject 中不要手动输入 scrum -e，插件会自动生成。';
  }
  return undefined;
}

function validateHours(value: string): string | undefined {
  const number = Number(value);
  if (!value.trim()) {
    return '请输入工时。';
  }
  if (!Number.isFinite(number) || number <= 0) {
    return '工时必须大于 0。';
  }
  return undefined;
}

function validateProgress(value: string): string | undefined {
  const number = Number(value);
  if (!value.trim()) {
    return '请输入完成度。';
  }
  if (!Number.isInteger(number) || number < 0 || number > 100) {
    return '完成度必须是 0 到 100 之间的整数。';
  }
  return undefined;
}

function normalizeNumber(value: string): string {
  return String(Number(value));
}

function formatTaskReference(task: { estimatedHours?: string; usedHours?: string; currentProgress?: string }): string {
  const parts = [
    task.estimatedHours ? `预计工时 ${task.estimatedHours}` : undefined,
    task.usedHours ? `已发生工时 ${task.usedHours}` : undefined,
    task.currentProgress ? `当前完成度 ${task.currentProgress}%` : undefined
  ].filter(Boolean);
  return parts.length ? `\n${parts.join('，')}` : '';
}

function formatHoursReference(task: { estimatedHours?: string; usedHours?: string }): string {
  const parts = [
    task.estimatedHours ? `预计工时：${task.estimatedHours}` : undefined,
    task.usedHours ? `已发生工时：${task.usedHours}` : undefined
  ].filter(Boolean);
  return parts.length ? `参考：${parts.join('，')}。` : '';
}

function formatProgressReference(task: { currentProgress?: string }): string {
  return task.currentProgress ? `当前完成度：${task.currentProgress}%。` : '';
}

// @AI-Begin J7K8L 20260518 @@cc
function formatTodayWorkHourHint(record: { spendTaskTime: number; dayCompletion: string }): string {
  return `今日已登记 ${record.spendTaskTime}h（${record.dayCompletion}），工时将覆盖非累加，工作内容将追加。`;
}
// @AI-End J7K8L 20260518 @@cc
