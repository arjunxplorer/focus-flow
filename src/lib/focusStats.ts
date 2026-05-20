import { supabase } from "@/integrations/supabase/client";
import { localDateKey, startOfLocalDayIso, todayKey } from "@/lib/dates";

export interface FocusSessionSlice {
  id: string;
  task_id?: string | null;
  started_at: string | null;
  ended_at?: string | null;
  duration_seconds: number;
}

export interface CompletedTaskSlice {
  id: string;
  duration_minutes: number;
  completed: boolean;
  completed_at?: string | null;
  section_id?: string | null;
}

export interface SumTodayFocusOptions {
  day?: string;
  /** When set, only time for tasks in this section counts (unsectioned excluded). */
  sectionId?: string;
  taskSection?: Map<string, string | null>;
}

export function buildTaskSectionMap(
  tasks: Array<{ id: string; section_id?: string | null }>,
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const t of tasks) map.set(t.id, t.section_id ?? null);
  return map;
}

/** Resolve section_id for session task_ids not already in the map. */
export async function enrichTaskSectionMap(
  map: Map<string, string | null>,
  sessions: FocusSessionSlice[],
): Promise<Map<string, string | null>> {
  const missing: string[] = [];
  for (const s of sessions) {
    if (s.task_id && !map.has(s.task_id)) missing.push(s.task_id);
  }
  if (missing.length === 0) return map;

  const { data } = await supabase.from("tasks").select("id,section_id").in("id", missing);
  for (const t of data ?? []) map.set(t.id, t.section_id ?? null);
  return map;
}

function sessionCountsForScope(
  session: FocusSessionSlice,
  day: string,
  sectionId: string | undefined,
  taskSection: Map<string, string | null> | undefined,
): boolean {
  if (!sessionCountsOnLocalDay(session, day)) return false;
  if (sectionId === undefined) return true;
  if (!session.task_id || !taskSection) return false;
  return taskSection.get(session.task_id) === sectionId;
}

function taskCountsForScope(
  task: CompletedTaskSlice,
  sectionId: string | undefined,
): boolean {
  if (sectionId === undefined) return true;
  return task.section_id === sectionId;
}

/** True if any focus time from this session counts toward the given local calendar day */
export function sessionCountsOnLocalDay(
  session: FocusSessionSlice,
  day: string = todayKey(),
): boolean {
  if (session.started_at && localDateKey(new Date(session.started_at)) === day) return true;
  if (session.ended_at && localDateKey(new Date(session.ended_at)) === day) return true;
  return false;
}

export function sumFocusSecondsForLocalDay(
  sessions: FocusSessionSlice[],
  day: string = todayKey(),
): number {
  return sessions.reduce((acc, s) => {
    if (!sessionCountsOnLocalDay(s, day)) return acc;
    return acc + (s.duration_seconds ?? 0);
  }, 0);
}

/** Today's focused time from timer sessions only (matches Dashboard). */
export function sumTodayFocusSeconds(
  sessions: FocusSessionSlice[],
  options: SumTodayFocusOptions = {},
): number {
  const day = options.day ?? todayKey();
  const { sectionId, taskSection } = options;

  return sessions.reduce((acc, s) => {
    if (!sessionCountsForScope(s, day, sectionId, taskSection)) return acc;
    return acc + (s.duration_seconds ?? 0);
  }, 0);
}

/** Tasks marked complete today (tick or timer); does not add focus minutes. */
export function countTasksDoneToday(
  tasks: CompletedTaskSlice[],
  options: Pick<SumTodayFocusOptions, "day" | "sectionId"> = {},
): number {
  const day = options.day ?? todayKey();
  const { sectionId } = options;

  return tasks.reduce((acc, t) => {
    if (!taskCountsForScope(t, sectionId)) return acc;
    if (!t.completed || !t.completed_at) return acc;
    if (localDateKey(new Date(t.completed_at)) !== day) return acc;
    return acc + 1;
  }, 0);
}

/** In-progress timer time not yet persisted on the session row */
export function getLiveFocusElapsed(
  active: { durationSeconds: number } | null,
  remaining: number,
): number {
  return active ? Math.max(0, active.durationSeconds - remaining) : 0;
}

/** Live timer elapsed; zero when viewing a section the active task does not belong to. */
export function getLiveFocusElapsedForScope(
  active: { taskId: string; durationSeconds: number } | null,
  remaining: number,
  sectionId: string | undefined,
  taskSection: Map<string, string | null>,
): number {
  if (!active) return 0;
  const elapsed = getLiveFocusElapsed(active, remaining);
  if (sectionId === undefined) return elapsed;
  return taskSection.get(active.taskId) === sectionId ? elapsed : 0;
}

/**
 * Load focus sessions that may count toward a local day (started or ended since midnight).
 * Uses separate filters to avoid fragile PostgREST .or() strings.
 */
export async function fetchFocusSessionsForLocalDay(day = new Date()) {
  const startIso = startOfLocalDayIso(day);

  const [startedRes, endedRes] = await Promise.all([
    supabase
      .from("focus_sessions")
      .select("id,task_id,started_at,ended_at,duration_seconds")
      .gte("started_at", startIso),
    supabase
      .from("focus_sessions")
      .select("id,task_id,started_at,ended_at,duration_seconds")
      .gte("ended_at", startIso)
      .not("ended_at", "is", null)
      .lt("started_at", startIso),
  ]);

  const error = startedRes.error ?? endedRes.error ?? null;
  const byId = new Map<string, FocusSessionSlice>();
  for (const row of [...(startedRes.data ?? []), ...(endedRes.data ?? [])]) {
    byId.set(row.id, row);
  }

  return { sessions: Array.from(byId.values()), error };
}
