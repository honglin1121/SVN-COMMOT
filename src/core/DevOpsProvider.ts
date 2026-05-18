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

// @AI-Begin A1B2C 20260518 @@cc
export interface WorkHourRecord {
  taskWorkhourId: string;
  spendTaskTime: number;
  workContent: string;
  taskWorkhourDate: string;
  dayCompletion: string;
}
// @AI-End A1B2C 20260518 @@cc

export interface DevOpsCommitMetadata {
  project: DevOpsProject;
  task: DevOpsTask;
  commitType: string;
  subject: string;
  hours: string;
  progress: string;
  // @AI-Begin A1B2C 20260518 @@cc
  todayWorkHour?: WorkHourRecord;
  // @AI-End A1B2C 20260518 @@cc
}

export interface DevOpsProvider {
  readonly name: string;
  fetchProjects(): Promise<DevOpsProject[]>;
  fetchTasks(projectCode: string, type: DevOpsTaskType): Promise<DevOpsTask[]>;
  testConnection(): Promise<boolean>;
  // @AI-Begin A1B2C 20260518 @@cc
  fetchWorkHours?(taskId: string): Promise<WorkHourRecord[]>;
  // @AI-End A1B2C 20260518 @@cc
  addWorkHour?(
    taskId: string,
    createTime: string,
    spendTaskTime: number,
    dayCompletion: string,
    workContent: string
  ): Promise<void>;
  // @AI-Begin A1B2C 20260518 @@cc
  modifyWorkHour?(
    taskWorkhourId: string,
    taskId: string,
    createTime: string,
    spendTaskTime: number,
    dayCompletion: string,
    workContent: string
  ): Promise<void>;
  // @AI-End A1B2C 20260518 @@cc
}
