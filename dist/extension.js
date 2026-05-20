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
    }));
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
        const metadata = await (0, QuickPickFlow_1.collectDevOpsCommitMetadata)(provider, cache, config.commitTemplate);
        if (!metadata) {
            return;
        }
        const strategy = new AmendStrategy_1.AmendStrategy(cwd);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在写入 DevOps 信息到 commit',
            cancellable: false
        }, () => strategy.apply(metadata, config.commitTemplate));
        // @AI-Begin J5K6L 20260520 @@cc
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
            await recoverAmend(cwd);
            throw pushError;
        }
        // @AI-End J5K6L 20260520 @@cc
        // @AI-Begin M9N0P 20260518 @@cc
        const createTime = new Date().toISOString().split('T')[0];
        const spendTaskTime = Number(metadata.hours);
        const dayCompletion = `${metadata.progress}%`;
        const taskId = metadata.task.id || metadata.task.code;
        if (metadata.todayWorkHour && provider.modifyWorkHour) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在更新今日工时到 DevOps',
                cancellable: false
            }, async () => {
                const workContent = metadata.todayWorkHour.workContent + '\n' + metadata.subject;
                await provider.modifyWorkHour(metadata.todayWorkHour.taskWorkhourId, taskId, createTime, spendTaskTime, dayCompletion, workContent);
            });
        }
        else if (provider.addWorkHour) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在登记工时到 DevOps',
                cancellable: false
            }, async () => {
                await provider.addWorkHour(taskId, createTime, spendTaskTime, dayCompletion, metadata.subject);
            });
        }
        // @AI-End M9N0P 20260518 @@cc
        vscode.window.showInformationMessage('DevOps 信息已写入，推送并登记工时完成。');
    }
    catch (error) {
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
    }
}
// @AI-Begin P2Q4R 20260520 @@cc
async function resolvePushTarget(cwd, repository) {
    const state = await (0, AmendStrategy_1.checkBranchState)(cwd);
    if (!state.hasUnpushedCommits) {
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
// @AI-End P2Q4R 20260520 @@cc
//# sourceMappingURL=extension.js.map