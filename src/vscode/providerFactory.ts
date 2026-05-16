import { DevOpsProvider } from '../core/DevOpsProvider';
import { CompanyDevOpsAdapter } from '../core/providers/CompanyDevOpsAdapter';
import { ExtensionConfig } from './ConfigManager';

export function createProvider(config: ExtensionConfig): DevOpsProvider {
  if (!config.username || !config.password) {
    throw new Error('请先执行“初始化 DevOps 账号”，保存用户名和密码。');
  }
  for (const variable of ['${COMMIT_TYPE}', '${SUBJECT}', '${CODE}', '${HOURS}', '${PROGRESS}']) {
    if (!config.commitTemplate.includes(variable)) {
      throw new Error(`issueLinkPush.commitTemplate must include ${variable}.`);
    }
  }

  return new CompanyDevOpsAdapter({
    username: config.username,
    password: config.password,
    timeoutMs: config.requestTimeoutMs
  });
}
