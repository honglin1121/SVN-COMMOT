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
const vscode = __importStar(require("vscode"));
const DevOpsCache_1 = require("./core/DevOpsCache");
const ConfigManager_1 = require("./vscode/ConfigManager");
const AmendStrategy_1 = require("./vscode/AmendStrategy");
const git_1 = require("./vscode/git");
const providerFactory_1 = require("./vscode/providerFactory");
const QuickPickFlow_1 = require("./vscode/QuickPickFlow");
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
async function runSubmitWithDevOpsTask(config, cache) {
    try {
        const git = await (0, git_1.getGitApi)();
        const repository = await (0, git_1.pickRepository)(git);
        if (!repository) {
            vscode.window.showWarningMessage('当前没有打开 Git 仓库。');
            return;
        }
        const provider = (0, providerFactory_1.createProvider)(config);
        const metadata = await (0, QuickPickFlow_1.collectDevOpsCommitMetadata)(provider, cache, config.commitTemplate);
        if (!metadata) {
            return;
        }
        const strategy = new AmendStrategy_1.AmendStrategy(repository);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在写入 DevOps 信息到 commit',
            cancellable: false
        }, () => strategy.apply(metadata, config.commitTemplate));
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在推送代码',
            cancellable: false
        }, () => repository.push());
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
//# sourceMappingURL=extension.js.map