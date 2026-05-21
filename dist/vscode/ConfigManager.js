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
exports.ConfigManager = void 0;
const vscode = __importStar(require("vscode"));
class ConfigManager {
    secrets;
    static usernameKey = 'issueLinkPush.devops.username';
    static passwordKey = 'issueLinkPush.devops.password';
    constructor(secrets) {
        this.secrets = secrets;
    }
    async load() {
        const config = vscode.workspace.getConfiguration('issueLinkPush');
        return {
            commitTemplate: config.get('commitTemplate', '${COMMIT_TYPE}:${SUBJECT} scrum -e ${CODE} -h:${HOURS} -s:${PROGRESS}'),
            requestTimeoutMs: config.get('requestTimeoutMs', 10000),
            cacheTtlMs: config.get('cacheTtlMs', 300000),
            workHourMode: config.get('workHourMode', 'append'),
            workContentMode: config.get('workContentMode', 'append'),
            progressMode: config.get('progressMode', 'overwrite'),
            username: await this.secrets.get(ConfigManager.usernameKey),
            password: await this.secrets.get(ConfigManager.passwordKey)
        };
    }
    async initializeDevOpsAccount() {
        const username = await vscode.window.showInputBox({
            title: '初始化 DevOps 账号',
            prompt: '请输入公司 DevOps 用户名。',
            ignoreFocusOut: true,
            validateInput: (value) => (value.trim() ? undefined : '请输入用户名。')
        });
        if (username === undefined) {
            return;
        }
        const password = await vscode.window.showInputBox({
            title: '初始化 DevOps 账号',
            prompt: '请输入 DevOps 登录密码密文。可登录 DevOps 平台 F12，在 login 接口负载中获取 password 字段值。',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => (value ? undefined : '请输入密码密文。')
        });
        if (password === undefined) {
            return;
        }
        await this.secrets.store(ConfigManager.usernameKey, username.trim());
        await this.secrets.store(ConfigManager.passwordKey, password);
        vscode.window.showInformationMessage('DevOps 账号已安全保存。');
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=ConfigManager.js.map