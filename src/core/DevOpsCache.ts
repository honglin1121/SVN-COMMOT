import { DevOpsProject, DevOpsProvider, DevOpsTask, DevOpsTaskType } from './DevOpsProvider';

export class DevOpsCache {
  private projectsCachedAt = 0;
  private projects: DevOpsProject[] = [];
  private readonly tasks = new Map<string, { cachedAt: number; items: DevOpsTask[] }>();

  constructor(private readonly ttlMs: number) {}

  async getProjects(provider: DevOpsProvider): Promise<DevOpsProject[]> {
    if (this.ttlMs > 0 && Date.now() - this.projectsCachedAt < this.ttlMs) {
      return this.projects;
    }

    this.projects = await provider.fetchProjects();
    this.projectsCachedAt = Date.now();
    return this.projects;
  }

  async getTasks(provider: DevOpsProvider, projectCode: string, type: DevOpsTaskType): Promise<DevOpsTask[]> {
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
