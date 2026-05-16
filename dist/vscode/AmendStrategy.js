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
exports.AmendStrategy = void 0;
const cp = __importStar(require("node:child_process"));
const util = __importStar(require("node:util"));
const DevOpsCommitFormatter_1 = require("../core/DevOpsCommitFormatter");
const execFile = util.promisify(cp.execFile);
class AmendStrategy {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async apply(metadata, template) {
        const cwd = this.repository.rootUri.fsPath;
        await ensureHasUnpushedCommit(cwd);
        const nextMessage = (0, DevOpsCommitFormatter_1.formatDevOpsCommitMetadata)(template, metadata);
        validateCommitMessage(nextMessage);
        await execFile('git', ['commit', '--amend', '--only', '-m', nextMessage], { cwd });
    }
}
exports.AmendStrategy = AmendStrategy;
async function ensureHasUnpushedCommit(cwd) {
    const upstream = await execFile('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd })
        .then((result) => result.stdout.trim())
        .catch(() => undefined);
    if (!upstream) {
        throw new Error('当前分支没有 upstream。请先设置远端分支后再关联 DevOps 信息。');
    }
    const { stdout } = await execFile('git', ['rev-list', '--count', `${upstream}..HEAD`], { cwd });
    const count = Number(stdout.trim());
    if (!Number.isFinite(count) || count <= 0) {
        throw new Error('当前没有未推送的 commit 可修改。');
    }
}
function validateCommitMessage(message) {
    if (message.length < 10) {
        throw new Error('commit message 不能少于 10 个字符。');
    }
    if (message.length > 500) {
        throw new Error('commit message 不能超过 500 个字符。');
    }
    if (!/\sscrum -e\s+\S+/.test(message)) {
        throw new Error('commit message 必须包含小写指令 scrum -e。');
    }
    if (!/^(feat|fix|perf|refactor|test|style|build|chore|upd|doc):/i.test(message) && !/^Merge\s/.test(message)) {
        throw new Error('commit message 必须以合法 type 开头，Merge 操作必须以 “Merge ” 开头。');
    }
}
//# sourceMappingURL=AmendStrategy.js.map