export const queryKeys = {
  sections: (userId: string | undefined) => ["sections", userId] as const,
  todayTasks: (userId: string | undefined) => ["tasks", "today", userId] as const,
  historyTasks: (userId: string | undefined) => ["tasks", "history", userId] as const,
  dashboard: (userId: string | undefined) => ["dashboard", userId] as const,
  task: (taskId: string | undefined) => ["task", taskId] as const,
};
