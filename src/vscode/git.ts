import * as vscode from 'vscode';

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
