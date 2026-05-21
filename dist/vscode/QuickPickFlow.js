"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDevOpsCommitMetadata = collectDevOpsCommitMetadata;
const vscode = __importStar(require("vscode"));
const DevOpsCommitFormatter_1 = require("../core/DevOpsCommitFormatter");
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
async function collectDevOpsCommitMetadata(provider, cache, commitTemplate) {
    // @AI-Begin R2S5T 20260519 @@cc
    const taskTypePick = await vscode.window.showQuickPick([
        { label: 'task', description: '开发任务', value: 'task' },
        { label: 'bug', description: '缺陷修复', value: 'bug' }
    ], {
        title: '选择工作项类型',
        placeHolder: 'task 或 bug',
        ignoreFocusOut: true
    });
    if (!taskTypePick) {
        return undefined;
    }
    const taskType = taskTypePick.value;
    const tasks = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `正在加载 ${taskType} 列表`,
        cancellable: false
    }, () => cache.getTasks(provider, taskType));
    if (tasks.length === 0) {
        vscode.window.showWarningMessage(`没有未完成的 ${taskType}。`);
        return undefined;
    }
    const grouped = groupByProduct(tasks);
    const taskPickItems = [];
    for (const [productName, productTasks] of grouped) {
        taskPickItems.push({ label: productName, kind: vscode.QuickPickItemKind.Separator });
        for (const task of productTasks) {
            taskPickItems.push({
                label: task.code,
                description: task.status,
                detail: `${task.title}${formatTaskReference(task)}`,
                task
            });
        }
    }
    const taskPick = await vscode.window.showQuickPick(taskPickItems, {
        title: `选择一个 ${taskType}`,
        placeHolder: '搜索工作项编号或标题',
        ignoreFocusOut: true,
        matchOnDetail: true
    });
    // @AI-End R2S5T 20260519 @@cc
    if (!taskPick?.task) {
        return undefined;
    }
    const selectedTask = taskPick.task;
    // @AI-Begin J7K8L 20260518 @@cc
    let todayWorkHour;
    if (provider.fetchWorkHours) {
        const taskId = selectedTask.id || selectedTask.code;
        todayWorkHour = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在查询今日工时记录',
            cancellable: false
        }, async () => {
            const records = await provider.fetchWorkHours(taskId);
            const today = new Date().toISOString().split('T')[0];
            return records.find((r) => r.taskWorkhourDate === today);
        });
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
    // @AI-Begin N8M3K 20260521 @@cc
    let workHourTypeCode = '24';
    if (provider.fetchWorkHourTypes) {
        const types = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在加载工时类型',
            cancellable: false
        }, () => cache.getWorkHourTypes(provider));
        if (types.length > 0) {
            const typePick = await vscode.window.showQuickPick(types.map((t) => ({ label: t.eleName, code: t.eleCode })), {
                title: '选择工时类型',
                placeHolder: '选择本次工时对应的类型',
                ignoreFocusOut: true
            });
            if (!typePick) {
                return undefined;
            }
            workHourTypeCode = typePick.code;
        }
    }
    // @AI-End N8M3K 20260521 @@cc
    // @AI-Begin J7K8L 20260518 @@cc
    const hoursPrompt = todayWorkHour
        ? `${formatTodayWorkHourHint(todayWorkHour)}\n${formatHoursReference(selectedTask)}`
        : `请输入本次提交关联的 DevOps 工时。${formatHoursReference(selectedTask)}`;
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
        prompt: `请输入任务完成度百分比。${formatProgressReference(selectedTask)}100 会让工作项自动置为已解决。`,
        placeHolder: '0-100',
        ignoreFocusOut: true,
        validateInput: validateProgress
    });
    if (progress === undefined) {
        return undefined;
    }
    // @AI-Begin J7K8L 20260518 @@cc
    const metadata = {
        project: {
            code: selectedTask.projectCode,
            name: selectedTask.projectName || selectedTask.projectCode
        },
        task: selectedTask,
        commitType: commitTypePick.label,
        subject: subject.trim(),
        hours: normalizeNumber(hours),
        progress: normalizeNumber(progress),
        todayWorkHour,
        // @AI-Begin N8M3K 20260521 @@cc
        workHourTypeCode
        // @AI-End N8M3K 20260521 @@cc
    };
    // @AI-End J7K8L 20260518 @@cc
    const preview = (0, DevOpsCommitFormatter_1.formatDevOpsCommitMetadata)(commitTemplate, metadata);
    const confirmation = await vscode.window.showInformationMessage(`即将把最新未推送 commit message 修改为：${preview}`, { modal: true }, '确认并推送', '取消');
    return confirmation === '确认并推送' ? metadata : undefined;
}
function validateSubject(value) {
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
function validateHours(value) {
    const number = Number(value);
    if (!value.trim()) {
        return '请输入工时。';
    }
    if (!Number.isFinite(number) || number <= 0) {
        return '工时必须大于 0。';
    }
    return undefined;
}
function validateProgress(value) {
    const number = Number(value);
    if (!value.trim()) {
        return '请输入完成度。';
    }
    if (!Number.isInteger(number) || number < 0 || number > 100) {
        return '完成度必须是 0 到 100 之间的整数。';
    }
    return undefined;
}
function normalizeNumber(value) {
    return String(Number(value));
}
function formatTaskReference(task) {
    const parts = [
        task.estimatedHours ? `预计工时 ${task.estimatedHours}` : undefined,
        task.usedHours ? `已发生工时 ${task.usedHours}` : undefined,
        task.currentProgress ? `当前完成度 ${task.currentProgress}%` : undefined
    ].filter(Boolean);
    return parts.length ? `\n${parts.join('，')}` : '';
}
function formatHoursReference(task) {
    const parts = [
        task.estimatedHours ? `预计工时：${task.estimatedHours}` : undefined,
        task.usedHours ? `已发生工时：${task.usedHours}` : undefined
    ].filter(Boolean);
    return parts.length ? `参考：${parts.join('，')}。` : '';
}
function formatProgressReference(task) {
    return task.currentProgress ? `当前完成度：${task.currentProgress}%。` : '';
}
// @AI-Begin J7K8L 20260518 @@cc
function formatTodayWorkHourHint(record) {
    return `今日已登记 ${record.spendTaskTime}h（${record.dayCompletion}），工时将覆盖非累加，工作内容将追加。`;
}
// @AI-End J7K8L 20260518 @@cc
// @AI-Begin R2S5T 20260519 @@cc
function groupByProduct(tasks) {
    const map = new Map();
    for (const task of tasks) {
        const key = task.projectName || task.projectCode;
        const group = map.get(key);
        if (group) {
            group.push(task);
        }
        else {
            map.set(key, [task]);
        }
    }
    return map;
}
// @AI-End R2S5T 20260519 @@cc
//# sourceMappingURL=QuickPickFlow.js.map