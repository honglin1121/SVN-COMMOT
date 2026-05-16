"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevOpsCache = void 0;
class DevOpsCache {
    ttlMs;
    projectsCachedAt = 0;
    projects = [];
    tasks = new Map();
    constructor(ttlMs) {
        this.ttlMs = ttlMs;
    }
    async getProjects(provider) {
        if (this.ttlMs > 0 && Date.now() - this.projectsCachedAt < this.ttlMs) {
            return this.projects;
        }
        this.projects = await provider.fetchProjects();
        this.projectsCachedAt = Date.now();
        return this.projects;
    }
    async getTasks(provider, projectCode, type) {
        const key = `${projectCode}:${type}`;
        const cached = this.tasks.get(key);
        if (cached && this.ttlMs > 0 && Date.now() - cached.cachedAt < this.ttlMs) {
            return cached.items;
        }
        const items = await provider.fetchTasks(projectCode, type);
        this.tasks.set(key, { cachedAt: Date.now(), items });
        return items;
    }
}
exports.DevOpsCache = DevOpsCache;
//# sourceMappingURL=DevOpsCache.js.map