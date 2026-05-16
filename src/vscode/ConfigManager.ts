import * as vscode from 'vscode';

export interface ExtensionConfig {
  commitTemplate: string;
  requestTimeoutMs: number;
  cacheTtlMs: number;
  username?: string;
  password?: string;
}

export class ConfigManager {
  private static readonly usernameKey = 'issueLinkPush.devops.username';
  private static readonly passwordKey = 'issueLinkPush.devops.password';

  constructor(private readonly secrets: vscode.SecretStorage) {}

  async load(): Promise<ExtensionConfig> {
    const config = vscode.workspace.getConfiguration('issueLinkPush');
    return {
      commitTemplate: config.get<string>(
        'commitTemplate',
        '${COMMIT_TYPE}:${SUBJECT} scrum -e ${CODE} -h:${HOURS} -s:${PROGRESS}'
      ),
      requestTimeoutMs: config.get<number>('requestTimeoutMs', 10000),
      cacheTtlMs: config.get<number>('cacheTtlMs', 300000),
      username: await this.secrets.get(ConfigManager.usernameKey),
      password: await this.secrets.get(ConfigManager.passwordKey)
    };
  }

  async initializeDevOpsAccount(): Promise<void> {
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
