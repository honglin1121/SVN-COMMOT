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
exports.activate = activate;
exports.deactivate = deactivate;
const cp = __importStar(require("node:child_process"));
const util = __importStar(require("node:util"));
const vscode = __importStar(require("vscode"));
const DevOpsCache_1 = require("./core/DevOpsCache");
const ConfigManager_1 = require("./vscode/ConfigManager");
const AmendStrategy_1 = require("./vscode/AmendStrategy");
const DevOpsCommitFormatter_1 = require("./core/DevOpsCommitFormatter");
const git_1 = require("./vscode/git");
const providerFactory_1 = require("./vscode/providerFactory");
const QuickPickFlow_1 = require("./vscode/QuickPickFlow");
const execFile = util.promisify(cp.execFile);
function activate(context) {
    const configManager = new ConfigManager_1.ConfigManager(context.secrets);
    let cache;
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('issueLinkPush')) {
            cache = undefined;
        }
    }), vscode.commands.registerCommand('issueLinkPush.initializeDevOps', async () => {
        await configManager.initializeDevOpsAccount();
        cache = undefined;
    }), 
    // @AI-Begin W3F6G 20260518 @@clearCache
    vscode.commands.registerCommand('issueLinkPush.clearCache', () => {
        if (cache) {
            cache.clear();
            vscode.window.showInformationMessage('DevOps 缓存已清除。');
        }
        else {
            vscode.window.showInformationMessage('缓存为空，无需清除。');
        }
    }), 
    // @AI-End W3F6G 20260518 @@cc
    vscode.commands.registerCommand('issueLinkPush.submitWithDevOpsTask', async () => {
        const config = await configManager.load();
        cache ??= new DevOpsCache_1.DevOpsCache(config.cacheTtlMs);
        await runSubmitWithDevOpsTask(config, cache);
    }), 
    // @AI-Begin B6C7D 20260520 @@cc
    vscode.commands.registerCommand('issueLinkPush.commitAndPush', async () => {
        const config = await configManager.load();
        cache ??= new DevOpsCache_1.DevOpsCache(config.cacheTtlMs);
        await runCommitAndPush(config, cache);
    }), vscode.commands.registerCommand('issueLinkPush.commitOnly', async () => {
        const config = await configManager.load();
        cache ??= new DevOpsCache_1.DevOpsCache(config.cacheTtlMs);
        await runCommitOnly(config, cache);
    })
    // @AI-End B6C7D 20260520 @@cc
    );
}
function deactivate() { }
// @AI-End D8E4F 20260520 @@cc
async function runSubmitWithDevOpsTask(config, cache) {
    try {
        const git = await (0, git_1.getGitApi)();
        const repository = await (0, git_1.pickRepository)(git);
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
        const provider = (0, providerFactory_1.createProvider)(config);
        const metadata = await (0, QuickPickFlow_1.collectDevOpsCommitMetadata)(provider, cache, config);
        if (!metadata) {
            return;
        }
        const strategy = new AmendStrategy_1.AmendStrategy(cwd);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在写入 DevOps 信息到 commit',
            cancellable: false
        }, () => strategy.apply(metadata, config.commitTemplate));
        await pushAndRecordHours({
            repository,
            cwd,
            pushTarget,
            provider,
            metadata,
            config,
            onPushFailure: () => recoverAmend(cwd),
            successMessage: 'DevOps 信息已写入，推送并登记工时完成。'
        });
    }
    catch (error) {
        vscode.window.showErrorMessage(formatGitError(error));
    }
}
// @AI-Begin E8F9G 20260520 @@cc
async function runCommitAndPush(config, cache) {
    try {
        const git = await (0, git_1.getGitApi)();
        const repository = await (0, git_1.pickRepository)(git);
        if (!repository) {
            vscode.window.showWarningMessage('当前没有打开 Git 仓库。');
            return;
        }
        const cwd = repository.rootUri.fsPath;
        if (!(await (0, git_1.hasStagedChanges)(cwd))) {
            vscode.window.showWarningMessage('当前没有已暂存的改动。请先 git add 暂存要提交的文件。');
            return;
        }
        const pushTarget = await resolvePushTarget(cwd, repository, false);
        if (!pushTarget) {
            return;
        }
        const provider = (0, providerFactory_1.createProvider)(config);
        const metadata = await (0, QuickPickFlow_1.collectDevOpsCommitMetadata)(provider, cache, config);
        if (!metadata) {
            return;
        }
        const message = (0, DevOpsCommitFormatter_1.formatDevOpsCommitMetadata)(config.commitTemplate, metadata);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在提交代码',
            cancellable: false
        }, async () => {
            await execFile('git', ['commit', '-m', message], { cwd });
        });
        await pushAndRecordHours({
            repository,
            cwd,
            pushTarget,
            provider,
            metadata,
            config,
            onPushFailure: () => recoverCommit(cwd),
            successMessage: '代码已提交，推送并登记工时完成。'
        });
    }
    catch (error) {
        vscode.window.showErrorMessage(formatGitError(error));
    }
}
async function runCommitOnly(config, cache) {
    try {
        const git = await (0, git_1.getGitApi)();
        const repository = await (0, git_1.pickRepository)(git);
        if (!repository) {
            vscode.window.showWarningMessage('当前没有打开 Git 仓库。');
            return;
        }
        const cwd = repository.rootUri.fsPath;
        if (!(await (0, git_1.hasStagedChanges)(cwd))) {
            vscode.window.showWarningMessage('当前没有已暂存的改动。请先 git add 暂存要提交的文件。');
            return;
        }
        const provider = (0, providerFactory_1.createProvider)(config);
        const metadata = await (0, QuickPickFlow_1.collectDevOpsCommitMetadata)(provider, cache, config);
        if (!metadata) {
            return;
        }
        const message = (0, DevOpsCommitFormatter_1.formatDevOpsCommitMetadata)(config.commitTemplate, metadata);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在提交代码',
            cancellable: false
        }, async () => {
            await execFile('git', ['commit', '-m', message], { cwd });
        });
        await recordHours(provider, metadata, config);
        vscode.window.showInformationMessage('代码已提交到本地，工时已登记。');
    }
    catch (error) {
        vscode.window.showErrorMessage(formatGitError(error));
    }
}
async function recoverCommit(cwd) {
    try {
        await execFile('git', ['reset', '--soft', 'HEAD~1'], { cwd });
    }
    catch {
        // 恢复失败不掩盖原始错误
    }
}
async function pushAndRecordHours(options) {
    const { repository, cwd, pushTarget, provider, metadata, config, onPushFailure } = options;
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在推送代码',
            cancellable: false
        }, () => {
            if (pushTarget.hasUpstream) {
                return repository.push();
            }
            return repository.push(pushTarget.remoteName, pushTarget.branchName, true);
        });
    }
    catch (pushError) {
        await onPushFailure();
        throw pushError;
    }
    await recordHours(provider, metadata, config);
    vscode.window.showInformationMessage(options.successMessage);
}
async function recordHours(provider, metadata, config) {
    const createTime = new Date().toISOString().split('T')[0];
    const spendTaskTime = calcSpendTaskTime(metadata, config.workHourMode);
    const dayCompletion = calcDayCompletion(metadata, config.progressMode);
    const taskId = metadata.task.id || metadata.task.code;
    if (metadata.todayWorkHour && provider.modifyWorkHour) {
        const workContent = calcWorkContent(metadata, config.workContentMode);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在更新今日工时到 DevOps',
            cancellable: false
        }, async () => {
            await provider.modifyWorkHour(metadata.todayWorkHour.taskWorkhourId, taskId, createTime, spendTaskTime, dayCompletion, workContent, metadata.workHourTypeCode);
        });
    }
    else if (provider.addWorkHour) {
        const workContent = `• ${metadata.subject}`;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在登记工时到 DevOps',
            cancellable: false
        }, async () => {
            await provider.addWorkHour(taskId, createTime, spendTaskTime, dayCompletion, workContent, metadata.workHourTypeCode);
        });
    }
}
function calcSpendTaskTime(metadata, mode) {
    const input = Number(metadata.hours);
    if (mode === 'append' && metadata.todayWorkHour) {
        return metadata.todayWorkHour.spendTaskTime + input;
    }
    return input;
}
function calcDayCompletion(metadata, mode) {
    const input = Number(metadata.progress);
    if (mode === 'append' && metadata.todayWorkHour) {
        const existing = parseFloat(metadata.todayWorkHour.dayCompletion) || 0;
        return `${Math.min(existing + input, 100)}%`;
    }
    return `${input}%`;
}
function calcWorkContent(metadata, mode) {
    const entry = `• ${metadata.subject}`;
    if (mode === 'append' && metadata.todayWorkHour) {
        return metadata.todayWorkHour.workContent + '\n' + entry;
    }
    return entry;
}
function formatGitError(error) {
    if (error instanceof Error) {
        const execError = error;
        if (execError.stderr) {
            return execError.stderr.trim();
        }
        return error.message;
    }
    return String(error);
}
// @AI-Begin P2Q4R 20260520 @@cc
async function resolvePushTarget(cwd, repository, requireUnpushedCommits = true) {
    const state = await (0, AmendStrategy_1.checkBranchState)(cwd);
    if (requireUnpushedCommits && !state.hasUnpushedCommits) {
        vscode.window.showWarningMessage('当前没有未推送的 commit。');
        return null;
    }
    if (state.hasUpstream) {
        return { hasUpstream: true };
    }
    const remotes = await (0, git_1.listRemotes)(cwd);
    if (remotes.length === 0) {
        vscode.window.showErrorMessage('当前仓库没有配置 remote，请先执行 git remote add 添加远程仓库。');
        return null;
    }
    let remoteName;
    if (remotes.length === 1) {
        remoteName = remotes[0];
    }
    else {
        const picked = await vscode.window.showQuickPick(remotes.map((r) => ({ label: r })), { placeHolder: '当前分支没有 upstream，请选择要推送到的远程仓库' });
        if (!picked) {
            return null;
        }
        remoteName = picked.label;
    }
    const localBranch = (0, git_1.getCurrentBranchName)(repository) ?? 'main';
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
async function recoverAmend(cwd) {
    try {
        const { stdout } = await execFile('git', ['rev-parse', 'HEAD@{1}'], { cwd });
        const prevCommit = stdout.trim();
        if (prevCommit) {
            await execFile('git', ['reset', '--soft', 'HEAD@{1}'], { cwd });
        }
    }
    catch {
        // 恢复失败不掩盖原始错误
    }
}
//# sourceMappingURL=extension.js.map