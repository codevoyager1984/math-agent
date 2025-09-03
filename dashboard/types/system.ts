export interface SystemConfig {
  data: {
    key: string;
    value: any;
    description: string;
  };
}

export interface TaskStatus {
  data: {
    total_active: number;
    max_total: number;
    tasks_by_type: Record<string, number>;
  };
}

export interface TaskConcurrencyConfig {
  data: {
    app_key: string;
    task_key: string;
    max_concurrent_tasks: number;
  };
}

export interface TaskConfigList {
  data: Array<{
    app_key: string;
    app_name: string;
    tasks: Array<{
      task_key: string;
      display_name: string;
      max_concurrent_tasks: number;
    }>;
  }>;
}
