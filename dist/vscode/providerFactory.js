"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvider = createProvider;
const CompanyDevOpsAdapter_1 = require("../core/providers/CompanyDevOpsAdapter");
function createProvider(config) {
    if (!config.username || !config.password) {
        throw new Error('请先执行“初始化 DevOps 账号”，保存用户名和密码。');
    }
    for (const variable of ['${COMMIT_TYPE}', '${SUBJECT}', '${CODE}', '${HOURS}', '${PROGRESS}']) {
        if (!config.commitTemplate.includes(variable)) {
            throw new Error(`issueLinkPush.commitTemplate must include ${variable}.`);
        }
    }
    return new CompanyDevOpsAdapter_1.CompanyDevOpsAdapter({
        username: config.username,
        password: config.password,
        timeoutMs: config.requestTimeoutMs
    });
}
//# sourceMappingURL=providerFactory.js.map