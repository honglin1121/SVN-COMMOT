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

  // @AI-Begin T8K2M 20260518 @@cc
  async getTasks(provider: DevOpsProvider, projectCode: string, type: DevOpsTaskType): Promise<DevOpsTask[]> {
    const key = `${projectCode}:${type}`;
    const items = await provider.fetchTasks(projectCode, type);
    this.tasks.set(key, { cachedAt: Date.now(), items });
    return items;
  }
  // @AI-End T8K2M 20260518 @@cc

  // @AI-Begin X9N7P 20260518 @@cc
  clear(): void {
    this.projects = [];
    this.projectsCachedAt = 0;
    this.tasks.clear();
  }
  // @AI-End X9N7P 20260518 @@cc
}
