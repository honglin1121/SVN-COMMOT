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
exports.getCurrentBranchName = getCurrentBranchName;
exports.listRemotes = listRemotes;
exports.getUpstreamInfo = getUpstreamInfo;
exports.hasStagedChanges = hasStagedChanges;
exports.getGitApi = getGitApi;
exports.pickRepository = pickRepository;
const cp = __importStar(require("node:child_process"));
const util = __importStar(require("node:util"));
const vscode = __importStar(require("vscode"));
const execFile = util.promisify(cp.execFile);
// @AI-Begin K7M2N 20260520 @@cc
function getCurrentBranchName(repository) {
    return repository.state.HEAD?.name;
}
async function listRemotes(cwd) {
    const { stdout } = await execFile('git', ['remote'], { cwd });
    return stdout.trim().split('\n').filter(Boolean);
}
async function getUpstreamInfo(cwd) {
    try {
        const { stdout } = await execFile('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd });
        const ref = stdout.trim();
        const parts = ref.split('/');
        if (parts.length >= 2) {
            return { remote: parts[0], branch: parts.slice(1).join('/') };
        }
        return null;
    }
    catch {
        return null;
    }
}
// @AI-Begin Y9Z0A 20260520 @@cc
async function hasStagedChanges(cwd) {
    try {
        await execFile('git', ['diff', '--cached', '--quiet'], { cwd });
        return false;
    }
    catch {
        return true;
    }
}
// @AI-End Y9Z0A 20260520 @@cc
// @AI-End K7M2N 20260520 @@cc
async function getGitApi() {
    const extension = vscode.extensions.getExtension('vscode.git');
    if (!extension) {
        throw new Error('VS Code Git extension is not available.');
    }
    const gitExtension = extension.isActive ? extension.exports : await extension.activate();
    return gitExtension.getAPI(1);
}
async function pickRepository(api) {
    if (api.repositories.length <= 1) {
        return api.repositories[0];
    }
    const picked = await vscode.window.showQuickPick(api.repositories.map((repository) => ({
        label: vscode.workspace.asRelativePath(repository.rootUri),
        repository
    })), { placeHolder: '选择要推送的 Git 仓库' });
    return picked?.repository;
}
//# sourceMappingURL=git.js.map