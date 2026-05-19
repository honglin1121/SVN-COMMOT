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
    // @AI-Begin T8K2M 20260518 @@cc
    async getTasks(provider, type) {
        const key = `${type}`;
        const items = await provider.fetchTasks(type);
        this.tasks.set(key, { cachedAt: Date.now(), items });
        return items;
    }
    // @AI-End T8K2M 20260518 @@cc
    // @AI-Begin X9N7P 20260518 @@cc
    clear() {
        this.projects = [];
        this.projectsCachedAt = 0;
        this.tasks.clear();
    }
}
exports.DevOpsCache = DevOpsCache;
//# sourceMappingURL=DevOpsCache.js.map