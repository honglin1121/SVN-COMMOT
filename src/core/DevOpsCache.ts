import { DevOpsProject, DevOpsProvider, DevOpsTask, DevOpsTaskType, WorkHourType } from './DevOpsProvider';

export class DevOpsCache {
  private projectsCachedAt = 0;
  private projects: DevOpsProject[] = [];
  private readonly tasks = new Map<string, { cachedAt: number; items: DevOpsTask[] }>();
  // @AI-Begin Q3P8M 20260521 @@cc
  private workHourTypesCachedAt = 0;
  private workHourTypes: WorkHourType[] = [];
  // @AI-End Q3P8M 20260521 @@cc

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
  async getTasks(provider: DevOpsProvider, type: DevOpsTaskType): Promise<DevOpsTask[]> {
    const key = `${type}`;
    const items = await provider.fetchTasks(type);
    this.tasks.set(key, { cachedAt: Date.now(), items });
    return items;
  }
  // @AI-End T8K2M 20260518 @@cc

  // @AI-Begin Q3P8M 20260521 @@cc
  async getWorkHourTypes(provider: DevOpsProvider): Promise<WorkHourType[]> {
    if (this.ttlMs > 0 && Date.now() - this.workHourTypesCachedAt < this.ttlMs) {
      return this.workHourTypes;
    }

    this.workHourTypes = await provider.fetchWorkHourTypes!();
    this.workHourTypesCachedAt = Date.now();
    return this.workHourTypes;
  }
  // @AI-End Q3P8M 20260521 @@cc

  // @AI-Begin X9N7P 20260518 @@cc
  clear(): void {
    this.projects = [];
    this.projectsCachedAt = 0;
    this.tasks.clear();
    // @AI-Begin Q3P8M 20260521 @@cc
    this.workHourTypes = [];
    this.workHourTypesCachedAt = 0;
    // @AI-End Q3P8M 20260521 @@cc
  }
  // @AI-End X9N7P 20260518 @@cc
}
