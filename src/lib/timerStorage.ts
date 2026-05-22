import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "focus-flow-active-timer";

export interface ActiveTimer {
  taskId: string;
  taskTitle: string;
  durationSeconds: number;
  endsAt: number;
  paused: boolean;
  pausedRemaining?: number;
  sessionId?: string;
}

export interface PersistedTimer {
  userId: string;
  taskId: string;
  taskTitle: string;
  durationSeconds: number;
  endsAt: number;
  paused: boolean;
  pausedRemaining?: number;
  sessionId?: string;
}

export function getTimerRemainingSeconds(timer: ActiveTimer): number {
  if (timer.paused) return timer.pausedRemaining ?? 0;
  return Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
}

export function readPersistedTimer(): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedTimer;
    if (
      !parsed?.userId ||
      !parsed.taskId ||
      !parsed.taskTitle ||
      typeof parsed.durationSeconds !== "number" ||
      typeof parsed.endsAt !== "number" ||
      typeof parsed.paused !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePersistedTimer(timer: ActiveTimer, userId: string): void {
  try {
    const payload: PersistedTimer = {
      userId,
      taskId: timer.taskId,
      taskTitle: timer.taskTitle,
      durationSeconds: timer.durationSeconds,
      endsAt: timer.endsAt,
      paused: timer.paused,
      pausedRemaining: timer.pausedRemaining,
      sessionId: timer.sessionId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPersistedTimer(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function persistedToActive(timer: PersistedTimer): ActiveTimer {
  return {
    taskId: timer.taskId,
    taskTitle: timer.taskTitle,
    durationSeconds: timer.durationSeconds,
    endsAt: timer.endsAt,
    paused: timer.paused,
    pausedRemaining: timer.pausedRemaining,
    sessionId: timer.sessionId,
  };
}

export async function fetchActiveTimerFromDb(userId: string): Promise<ActiveTimer | null> {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("id, started_at, task_id, tasks(id, title, duration_minutes)")
    .eq("user_id", userId)
    .eq("completed", false)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.task_id) return null;

  const taskJoin = data.tasks as
    | { id: string; title: string; duration_minutes: number }
    | { id: string; title: string; duration_minutes: number }[]
    | null;
  const task = Array.isArray(taskJoin) ? taskJoin[0] : taskJoin;
  if (!task) return null;

  const durationSeconds = task.duration_minutes * 60;
  const elapsed = Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000);
  const remaining = Math.max(0, durationSeconds - elapsed);

  return {
    taskId: task.id,
    taskTitle: task.title,
    durationSeconds,
    endsAt: Date.now() + remaining * 1000,
    paused: false,
    sessionId: data.id,
  };
}
