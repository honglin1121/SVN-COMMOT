export type DevOpsTaskType = 'task' | 'bug';

export interface DevOpsProject {
  code: string;
  name: string;
}

export interface DevOpsTask {
  code: string;
  title: string;
  type: DevOpsTaskType;
  status: string;
  projectCode: string;
  estimatedHours?: string;
  usedHours?: string;
  currentProgress?: string;
  url?: string;
  id?: string;
}

export interface DevOpsCommitMetadata {
  project: DevOpsProject;
  task: DevOpsTask;
  commitType: string;
  subject: string;
  hours: string;
  progress: string;
}

export interface DevOpsProvider {
  readonly name: string;
  fetchProjects(): Promise<DevOpsProject[]>;
  fetchTasks(projectCode: string, type: DevOpsTaskType): Promise<DevOpsTask[]>;
  testConnection(): Promise<boolean>;
  addWorkHour?(
    taskId: string,
    createTime: string,
    spendTaskTime: number,
    dayCompletion: string,
    workContent: string
  ): Promise<void>;
}
