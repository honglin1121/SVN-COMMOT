import * as cp from 'node:child_process';
import * as util from 'node:util';
import * as vscode from 'vscode';

const execFile = util.promisify(cp.execFile);

export interface GitExtension {
  getAPI(version: 1): GitApi;
}

export interface GitApi {
  repositories: Repository[];
}

export interface Repository {
  rootUri: vscode.Uri;
  inputBox: { value: string };
  state: {
    HEAD?: { name?: string; upstream?: { name: string; remote: string } };
  };
  push(remoteName?: string, branchName?: string, setUpstream?: boolean): Promise<void>;
}

export interface UpstreamInfo {
  remote: string;
  branch: string;
}

// @AI-Begin K7M2N 20260520 @@cc
export function getCurrentBranchName(repository: Repository): string | undefined {
  return repository.state.HEAD?.name;
}

export async function listRemotes(cwd: string): Promise<string[]> {
  const { stdout } = await execFile('git', ['remote'], { cwd });
  return stdout.trim().split('\n').filter(Boolean);
}

export async function getUpstreamInfo(cwd: string): Promise<UpstreamInfo | null> {
  try {
    const { stdout } = await execFile('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd });
    const ref = stdout.trim();
    const parts = ref.split('/');
    if (parts.length >= 2) {
      return { remote: parts[0], branch: parts.slice(1).join('/') };
    }
    return null;
  } catch {
    return null;
  }
}
// @AI-End K7M2N 20260520 @@cc

export async function getGitApi(): Promise<GitApi> {
  const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!extension) {
    throw new Error('VS Code Git extension is not available.');
  }
  const gitExtension = extension.isActive ? extension.exports : await extension.activate();
  return gitExtension.getAPI(1);
}

export async function pickRepository(api: GitApi): Promise<Repository | undefined> {
  if (api.repositories.length <= 1) {
    return api.repositories[0];
  }

  const picked = await vscode.window.showQuickPick(
    api.repositories.map((repository) => ({
      label: vscode.workspace.asRelativePath(repository.rootUri),
      repository
    })),
    { placeHolder: '选择要推送的 Git 仓库' }
  );

  return picked?.repository;
}
