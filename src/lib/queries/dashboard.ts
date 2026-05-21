import { supabase } from "@/integrations/supabase/client";
import { dashboardSessionCutoffIso, localDateKey } from "@/lib/dates";
import type { DashboardSessionRow, DashboardStats, SectionStat } from "./types";

export interface DashboardRpcRow {
  streak: number;
  total_tasks: number;
  completed_tasks: number;
  total_seconds: number;
  has_any: boolean;
  sessions: DashboardSessionRow[];
  per_section: SectionStat[];
  completion_dates?: string[];
}

function computeStreakFromCompletionDates(completionDates: string[]): number {
  const days = new Set(completionDates.map((iso) => localDateKey(new Date(iso))));
  let s = 0;
  const now = new Date();
  const today = localDateKey(now);
  const yesterday = localDateKey(new Date(now.getTime() - 86_400_000));
  let cursor = days.has(today)
    ? new Date(now)
    : days.has(yesterday)
      ? new Date(now.getTime() - 86_400_000)
      : null;

  while (cursor) {
    const key = localDateKey(cursor);
    if (days.has(key)) {
      s++;
      cursor = new Date(cursor.getTime() - 86_400_000);
    } else break;
  }
  return s;
}

function mapRpcToStats(row: DashboardRpcRow): DashboardStats {
  const completionDates = row.completion_dates ?? [];
  return {
    streak: computeStreakFromCompletionDates(completionDates),
    totalTasks: row.total_tasks,
    completedTasks: row.completed_tasks,
    totalSeconds: row.total_seconds,
    hasAny: row.has_any,
    sessions: row.sessions ?? [],
    perSection: row.per_section ?? [],
  };
}

/** Prefer server RPC; fall back to client aggregation if RPC unavailable. */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("get_dashboard_stats");

  if (!error && data) {
    return mapRpcToStats(data as DashboardRpcRow);
  }

  return fetchDashboardStatsFallback();
}

async function fetchDashboardStatsFallback(): Promise<DashboardStats> {
  const cutoff = dashboardSessionCutoffIso();

  const [tasksRes, sessionsRes, sectionsRes] = await Promise.all([
    supabase.from("tasks").select("id,section_id,completed,completed_at"),
    supabase
      .from("focus_sessions")
      .select("started_at,duration_seconds,task_id")
      .gte("started_at", cutoff),
    supabase.from("sections").select("id,name"),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (sessionsRes.error) throw sessionsRes.error;
  if (sectionsRes.error) throw sectionsRes.error;

  const tasks = tasksRes.data ?? [];
  const sessionRows = (sessionsRes.data ?? []) as DashboardSessionRow[];
  const sections = sectionsRes.data ?? [];

  const completionDates = tasks
    .filter((t) => t.completed_at)
    .map((t) => t.completed_at as string);

  const totalSeconds = sessionRows.reduce((acc, x) => acc + (x.duration_seconds ?? 0), 0);

  const taskSection = new Map<string, string | null>();
  tasks.forEach((t) => taskSection.set(t.id, t.section_id));

  const bySection = new Map<string, number>();
  sessionRows.forEach((sess) => {
    const sid = sess.task_id ? taskSection.get(sess.task_id) : null;
    if (!sid) return;
    bySection.set(sid, (bySection.get(sid) ?? 0) + (sess.duration_seconds ?? 0));
  });

  const perSection: SectionStat[] = sections
    .map((sec) => ({ id: sec.id, name: sec.name, seconds: bySection.get(sec.id) ?? 0 }))
    .sort((a, b) => b.seconds - a.seconds);

  return {
    streak: computeStreakFromCompletionDates(completionDates),
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => t.completed).length,
    totalSeconds,
    hasAny: tasks.length > 0 || sessionRows.length > 0,
    sessions: sessionRows,
    perSection,
  };
}
