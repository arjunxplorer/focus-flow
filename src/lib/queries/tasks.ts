import { supabase } from "@/integrations/supabase/client";
import { startOfLocalDayIso, todayKey, localDateKey } from "@/lib/dates";
import {
  buildTaskSectionMap,
  enrichTaskSectionMap,
  fetchFocusSessionsForLocalDay,
} from "@/lib/focusStats";
import type { HistoryTask, Task, TodayTasksData } from "./types";

const TASK_SELECT =
  "id,title,duration_minutes,completed,section_id,created_at,completed_at" as const;

export async function fetchTodayTasksData(): Promise<TodayTasksData> {
  const startIso = startOfLocalDayIso();

  const [createdTodayRes, completedEarlierRes, sessionsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_SELECT)
      .gte("created_at", startIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select(TASK_SELECT)
      .eq("completed", true)
      .gte("completed_at", startIso)
      .lt("created_at", startIso)
      .order("created_at", { ascending: false }),
    fetchFocusSessionsForLocalDay(),
  ]);

  if (createdTodayRes.error) throw createdTodayRes.error;
  if (completedEarlierRes.error) throw completedEarlierRes.error;
  if (sessionsResult.error) throw sessionsResult.error;

  const byId = new Map<string, Task>();
  for (const t of [...(createdTodayRes.data ?? []), ...(completedEarlierRes.data ?? [])]) {
    byId.set(t.id, t);
  }
  const tasks = Array.from(byId.values()).sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  );

  const sectionMap = buildTaskSectionMap(tasks);
  await enrichTaskSectionMap(sectionMap, sessionsResult.sessions);

  return {
    tasks,
    todaySessions: sessionsResult.sessions,
    taskSectionById: sectionMap,
  };
}

const HISTORY_LIMIT = 200;

export async function fetchHistoryTasks(): Promise<HistoryTask[]> {
  const startIso = startOfLocalDayIso();

  const [incompleteRes, completedRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,duration_minutes,completed,completed_at,created_at,section_id")
      .eq("completed", false)
      .lt("created_at", startIso)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("tasks")
      .select("id,title,duration_minutes,completed,completed_at,created_at,section_id")
      .eq("completed", true)
      .not("completed_at", "is", null)
      .lt("completed_at", startIso)
      .order("completed_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  if (incompleteRes.error) throw incompleteRes.error;
  if (completedRes.error) throw completedRes.error;

  const byId = new Map<string, HistoryTask>();
  for (const t of [...(incompleteRes.data ?? []), ...(completedRes.data ?? [])]) {
    byId.set(t.id, t as HistoryTask);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aRef = a.completed && a.completed_at ? a.completed_at : a.created_at;
    const bRef = b.completed && b.completed_at ? b.completed_at : b.created_at;
    return new Date(bRef).getTime() - new Date(aRef).getTime();
  });
}

export function groupHistoryTasks(tasks: HistoryTask[]) {
  const today = todayKey();
  const groups = new Map<string, HistoryTask[]>();

  for (const t of tasks) {
    const refDate = t.completed && t.completed_at ? t.completed_at : t.created_at;
    const key = localDateKey(new Date(refDate));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const sortedKeys = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : -1));
  return { groups, sortedKeys, today };
}
