export type DevOpsTaskType = 'task' | 'bug';

export interface DevOpsProject {
  code: string;
  name: string;
}

// @AI-Begin R2S5T 20260519 @@cc
export interface DevOpsTask {
  code: string;
  title: string;
  type: DevOpsTaskType;
  status: string;
  projectCode: string;
  projectName?: string;
  estimatedHours?: string;
  usedHours?: string;
  currentProgress?: string;
  url?: string;
  id?: string;
}
// @AI-End R2S5T 20260519 @@cc

// @AI-Begin A1B2C 20260518 @@cc
export interface WorkHourRecord {
  taskWorkhourId: string;
  spendTaskTime: number;
  workContent: string;
  taskWorkhourDate: string;
  dayCompletion: string;
}
// @AI-End A1B2C 20260518 @@cc

// @AI-Begin Z9Y8X 20260521 @@cc
export interface WorkHourType {
  eleId: string;
  eleCode: string;
  eleName: string;
}
// @AI-End Z9Y8X 20260521 @@cc

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
  // @AI-Begin W6V7U 20260521 @@cc
  workHourTypeCode: string;
  // @AI-End W6V7U 20260521 @@cc
  workHourTypeName: string;
}

export interface DevOpsProvider {
  readonly name: string;
  fetchProjects(): Promise<DevOpsProject[]>;
  fetchTasks(type: DevOpsTaskType): Promise<DevOpsTask[]>;
  testConnection(): Promise<boolean>;
  // @AI-Begin A1B2C 20260518 @@cc
  fetchWorkHours?(taskId: string): Promise<WorkHourRecord[]>;
  // @AI-End A1B2C 20260518 @@cc
  // @AI-Begin T5S4R 20260521 @@cc
  fetchWorkHourTypes?(): Promise<WorkHourType[]>;
  // @AI-End T5S4R 20260521 @@cc
  addWorkHour?(
    taskId: string,
    createTime: string,
    spendTaskTime: number,
    dayCompletion: string,
    workContent: string,
    taskWorkhourType: string
  ): Promise<void>;
  // @AI-Begin A1B2C 20260518 @@cc
  modifyWorkHour?(
    taskWorkhourId: string,
    taskId: string,
    createTime: string,
    spendTaskTime: number,
    dayCompletion: string,
    workContent: string,
    taskWorkhourType: string
  ): Promise<void>;
  // @AI-End A1B2C 20260518 @@cc
}
