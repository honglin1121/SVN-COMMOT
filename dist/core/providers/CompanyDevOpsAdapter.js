"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyDevOpsAdapter = void 0;
const AppError_1 = require("../AppError");
const http_1 = require("../http");
const DEVOPS_BASE_URL = 'https://devops.ctjsoft.com';
const DEVOPS_PAGE_ID = 'AbY8d4R';
const DEVOPS_TOP_MENU_ID = 'DevPro';
const DEVOPS_GROUP_ID = '1';
class CompanyDevOpsAdapter {
    options;
    name = 'Company DevOps';
    session;
    constructor(options) {
        this.options = options;
    }
    async fetchProjects() {
        const session = await this.getSession();
        const url = new URL(`${DEVOPS_BASE_URL}/devops-server/config/commonQuery/query/product/listByUserRight`);
        url.searchParams.set('userId', session.userId);
        url.searchParams.set('pageId', DEVOPS_PAGE_ID);
        const response = await (0, http_1.fetchJson)(this.name, url.toString(), {
            timeoutMs: this.options.timeoutMs,
            headers: {
                cookie: session.cookie,
                'user-context': JSON.stringify({
                    userId: session.userId,
                    pageId: DEVOPS_PAGE_ID
                })
            }
        });
        const projects = collectProductItems(response)
            .map(toProject)
            .filter((project) => project.code && project.name);
        if (projects.length === 0) {
            throw new AppError_1.ProviderError(`${this.name} did not return any products for this user.`, undefined, this.name);
        }
        return projects;
    }
    // @AI-Begin R2S5T 20260519 @@cc
    async fetchTasks(type) {
        const session = await this.getSession();
        const groupValue = `executeUser7770$${session.userId}`;
        const response = await (0, http_1.fetchJson)(this.name, `${DEVOPS_BASE_URL}/devops-server/config/v3/task/query/loadTaskListWithGroup`, {
            method: 'POST',
            timeoutMs: this.options.timeoutMs,
            headers: {
                'content-type': 'application/json',
                cookie: session.cookie,
                origin: DEVOPS_BASE_URL,
                'user-context': JSON.stringify({
                    userId: session.userId,
                    pageId: DEVOPS_PAGE_ID
                })
            },
            body: JSON.stringify({
                simpleFieldCondition: {
                    topMenuId: DEVOPS_TOP_MENU_ID,
                    pageId: DEVOPS_PAGE_ID,
                    currentUser: session.userId,
                    currentProductId: 'undefined',
                    configFlag: type === 'task' ? 'Task' : 'Bug',
                    parentId: groupValue,
                    taskTypeQueryRule: '0',
                    progressStatus: 'incomplete',
                    executeUser: [session.userId]
                },
                groupId: '6',
                groupField: 'executeUser',
                groupFieldValue: groupValue,
                parentGroupInfos: [],
                groupTaskCount: 5
            })
        });
        return response
            .map((item) => this.toTask(item, type))
            .filter((task) => task.code && task.title);
    }
    // @AI-End R2S5T 20260519 @@cc
    async testConnection() {
        await this.getSession();
        return true;
    }
    async addWorkHour(taskId, createTime, spendTaskTime, dayCompletion, workContent) {
        const session = await this.getSession();
        await (0, http_1.fetchJson)(this.name, `${DEVOPS_BASE_URL}/devops-server/config/v3/task/add/addWorkHour`, {
            method: 'POST',
            timeoutMs: this.options.timeoutMs,
            headers: {
                'content-type': 'application/json',
                cookie: session.cookie,
                origin: DEVOPS_BASE_URL,
                'user-context': JSON.stringify({
                    userId: session.userId,
                    pageId: DEVOPS_PAGE_ID
                })
            },
            body: JSON.stringify({
                createTime,
                taskWorkhourType: '24',
                spendTaskTime,
                dayCompletion,
                workContent,
                taskId,
                createUser: session.userId
            })
        });
    }
    // @AI-Begin D3E4F 20260518 @@cc
    async fetchWorkHours(taskId) {
        const session = await this.getSession();
        const url = new URL(`${DEVOPS_BASE_URL}/devops-server/config/v3/task/query/workHour/list`);
        url.searchParams.set('taskId', taskId);
        const response = await (0, http_1.fetchJson)(this.name, url.toString(), {
            timeoutMs: this.options.timeoutMs,
            headers: {
                cookie: session.cookie,
                'user-context': JSON.stringify({
                    userId: session.userId,
                    pageId: DEVOPS_PAGE_ID
                })
            }
        });
        return response.data ?? [];
    }
    // @AI-End D3E4F 20260518 @@cc
    // @AI-Begin G5H6I 20260518 @@cc
    async modifyWorkHour(taskWorkhourId, taskId, createTime, spendTaskTime, dayCompletion, workContent) {
        const session = await this.getSession();
        await (0, http_1.fetchJson)(this.name, `${DEVOPS_BASE_URL}/devops-server/config/v3/task/modify/modifyWorkHour`, {
            method: 'POST',
            timeoutMs: this.options.timeoutMs,
            headers: {
                'content-type': 'application/json',
                cookie: session.cookie,
                origin: DEVOPS_BASE_URL,
                'user-context': JSON.stringify({
                    userId: session.userId,
                    pageId: DEVOPS_PAGE_ID
                })
            },
            body: JSON.stringify({
                createTime,
                taskWorkhourType: '24',
                spendTaskTime,
                dayCompletion,
                workContent,
                taskId,
                taskWorkhourId,
                updateUser: session.userId
            })
        });
    }
    // @AI-End G5H6I 20260518 @@cc
    async getSession() {
        if (this.session) {
            return this.session;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
        try {
            const form = new FormData();
            form.set('version', '3.0');
            form.set('loginType', 'password');
            form.set('username', this.options.username);
            form.set('password', this.options.password);
            form.set('region', '');
            form.set('year', String(new Date().getFullYear()));
            const response = await fetch(`${DEVOPS_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    accept: 'application/json, text/plain, */*',
                    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'cache-control': 'no-cache',
                    origin: DEVOPS_BASE_URL,
                    pragma: 'no-cache',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
                    'user-context': JSON.stringify({
                        userId: '',
                        userCode: '',
                        userName: 'undefined',
                        appId: '',
                        appCode: '',
                        busiYear: '',
                        tenantId: '',
                        pageId: ''
                    })
                },
                body: form,
                signal: controller.signal
            });
            if (!response.ok) {
                throw new AppError_1.ProviderError(`${(0, http_1.readableHttpError)(this.name, response.status)} If the web login encrypts the password, re-run initialization and paste the captured login password field value.`, response.status, this.name);
            }
            const text = await response.text();
            const body = (0, http_1.parseResponsePayload)(this.name, text);
            const cookie = parseCookieHeaders(readSetCookieHeaders(response.headers));
            const userId = findDeepString(body, ['userId']);
            if (!cookie) {
                throw new AppError_1.ProviderError(`${this.name} login did not return session cookies.`, undefined, this.name);
            }
            if (!userId) {
                throw new AppError_1.ProviderError('登录成功，但登录响应中没有找到 userId。请把登录响应结构脱敏后发我，我来补字段映射。', undefined, this.name);
            }
            this.session = { cookie, userId };
            return this.session;
        }
        catch (error) {
            if (error instanceof AppError_1.ProviderError) {
                throw error;
            }
            if (error instanceof Error && error.name === 'AbortError') {
                throw new AppError_1.ProviderError(`${this.name} login timed out.`, undefined, this.name);
            }
            throw new AppError_1.ProviderError(`${this.name} login failed: ${error instanceof Error ? error.message : String(error)}`, undefined, this.name);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    // @AI-Begin R2S5T 20260519 @@cc
    toTask(task, type) {
        const code = String(task.taskNo ?? task.problemNo ?? task.taskId ?? '');
        const title = String(task.taskName ?? task.title ?? task.name ?? task.taskNo ?? code);
        return {
            code,
            title,
            type,
            status: String(task.implementStatus ?? task.status ?? task.progressStatus ?? 'incomplete'),
            projectCode: String(task.prodId ?? task.projectCode ?? ''),
            projectName: typeof task.prodName === 'string' ? task.prodName : undefined,
            estimatedHours: toOptionalString(task.planTaskTime),
            usedHours: toOptionalString(task.devWorkload ??
                task.proWorkload ??
                task.executeTaskTime),
            currentProgress: toOptionalString(task.completion ?? task.groupTaskSumCompletion),
            url: typeof task.url === 'string' ? task.url : undefined,
            id: String(task.taskId ?? task.id ?? code)
        };
    }
}
exports.CompanyDevOpsAdapter = CompanyDevOpsAdapter;
function toOptionalString(value) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    return String(value).replace(/%$/, '');
}
function readSetCookieHeaders(headers) {
    const withGetSetCookie = headers;
    const cookies = withGetSetCookie.getSetCookie?.();
    if (cookies?.length) {
        return cookies;
    }
    const combined = headers.get('set-cookie');
    return combined ? [combined] : [];
}
function parseCookieHeaders(setCookies) {
    if (setCookies.length === 0) {
        return '';
    }
    return setCookies
        .flatMap((header) => header.split(/,(?=\s*[^;,]+=)/))
        .map((cookie) => cookie.split(';')[0]?.trim())
        .filter(Boolean)
        .join('; ');
}
function findDeepString(value, keys) {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    const record = value;
    for (const key of keys) {
        const found = record[key];
        if (typeof found === 'string' && found) {
            return found;
        }
        if (typeof found === 'number') {
            return String(found);
        }
    }
    for (const child of Object.values(record)) {
        const found = findDeepString(child, keys);
        if (found) {
            return found;
        }
    }
    return undefined;
}
function collectProductItems(value) {
    const items = [];
    collectProductObjects(value, items);
    return items.filter((item) => Boolean(item.prodId ?? item.productId ?? item.prodCode ?? item.code ?? item.id));
}
function toProject(product) {
    const code = product.prodId ?? product.productId ?? product.prodCode ?? product.code ?? product.id ?? '';
    const name = product.prodCname ?? code;
    return {
        code: String(code),
        name: String(name)
    };
}
function collectProductObjects(value, items) {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectProductObjects(item, items);
        }
        return;
    }
    if (!value || typeof value !== 'object') {
        return;
    }
    const record = value;
    if (record.prodId || record.productId || record.prodCode || record.code || record.id) {
        items.push(record);
    }
    for (const child of Object.values(record)) {
        collectProductObjects(child, items);
    }
}
function collectTaskItems(value) {
    const items = [];
    collectTaskObjects(value, items);
    return items.filter((item) => Boolean(item.taskNo ?? item.problemNo ?? item.code ?? item.taskCode ?? item.bugCode ?? item.taskId ?? item.id));
}
function collectTaskObjects(value, items) {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectTaskObjects(item, items);
        }
        return;
    }
    if (!value || typeof value !== 'object') {
        return;
    }
    const record = value;
    if (record.taskNo || record.problemNo || record.code || record.taskCode || record.bugCode || record.taskId || record.id) {
        items.push(record);
    }
    for (const child of Object.values(record)) {
        collectTaskObjects(child, items);
    }
}
//# sourceMappingURL=CompanyDevOpsAdapter.js.map