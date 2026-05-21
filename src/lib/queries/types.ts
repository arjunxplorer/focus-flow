export interface Section {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  duration_minutes: number;
  completed: boolean;
  section_id: string | null;
  created_at?: string;
  completed_at?: string | null;
}

export interface HistoryTask {
  id: string;
  title: string;
  duration_minutes: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  section_id: string | null;
}

export interface DashboardSessionRow {
  started_at: string | null;
  duration_seconds: number;
  task_id: string | null;
}

export interface SectionStat {
  id: string;
  name: string;
  seconds: number;
}

export interface DashboardStats {
  streak: number;
  totalTasks: number;
  completedTasks: number;
  totalSeconds: number;
  hasAny: boolean;
  sessions: DashboardSessionRow[];
  perSection: SectionStat[];
}

export interface TaskWithSection {
  id: string;
  title: string;
  duration_minutes: number;
  section_id: string | null;
  section_name: string | null;
}

export interface TodayTasksData {
  tasks: Task[];
  todaySessions: import("@/lib/focusStats").FocusSessionSlice[];
  taskSectionById: Map<string, string | null>;
}
