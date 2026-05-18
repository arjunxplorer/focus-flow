import { useEffect, useState, useCallback } from "react";
import { Flame, Clock, Coffee } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTimer } from "@/contexts/TimerContext";
import { supabase } from "@/integrations/supabase/client";
import { FocusHeatmap } from "@/components/FocusHeatmap";
import { SectionDonut } from "@/components/SectionDonut";
import { formatFocusTime } from "@/lib/utils";

interface SectionStat { id: string; name: string; seconds: number }
interface SessionRow { started_at: string | null; duration_seconds: number; task_id: string | null }

// Returns a YYYY-MM-DD string in the user's local timezone — matches FocusHeatmap's localDateKey.
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}


export default function Dashboard() {
  const { user } = useAuth();
  const { active, remaining } = useTimer();
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [perSection, setPerSection] = useState<SectionStat[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [hasAny, setHasAny] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [tasksRes, sessionsRes, sectionsRes] = await Promise.all([
      supabase.from("tasks").select("id,section_id,completed_at").eq("completed", true),
      supabase.from("focus_sessions").select("started_at,duration_seconds,task_id"),
      supabase.from("sections").select("id,name"),
    ]);
    const tasks = tasksRes.data ?? [];
    const sessionRows = (sessionsRes.data ?? []) as SessionRow[];
    const sections = sectionsRes.data ?? [];
    setSessions(sessionRows);

    setHasAny(tasks.length > 0 || sessionRows.length > 0);

    // Streak: count consecutive days ending today (or yesterday) with a completed task.
    // Uses local timezone dates so a task completed at 11 PM locally is counted for that
    // local day, not the next UTC day.
    const days = new Set<string>();
    tasks.forEach((t) => {
      if (t.completed_at) days.add(localDateKey(new Date(t.completed_at)));
    });
    let s = 0;
    const now = new Date();
    const today = localDateKey(now);
    const yesterday = localDateKey(new Date(now.getTime() - 86_400_000));
    let cursor = days.has(today) ? new Date(now) : days.has(yesterday) ? new Date(now.getTime() - 86_400_000) : null;
    while (cursor) {
      const key = localDateKey(cursor);
      if (days.has(key)) {
        s++;
        cursor = new Date(cursor.getTime() - 86_400_000);
      } else break;
    }
    setStreak(s);

    // Total seconds — includes all started sessions (elapsed time is real focus time).
    const total = sessionRows.reduce((acc, x) => acc + (x.duration_seconds ?? 0), 0);
    setTotalSeconds(total);

    // Per-section: map task_id -> section_id
    const taskSection = new Map<string, string | null>();
    const allTasksRes = await supabase.from("tasks").select("id,section_id");
    (allTasksRes.data ?? []).forEach((t) => taskSection.set(t.id, t.section_id));
    const bySection = new Map<string, number>();
    sessionRows.forEach((sess) => {
      const sid = sess.task_id ? taskSection.get(sess.task_id) : null;
      if (!sid) return;
      bySection.set(sid, (bySection.get(sid) ?? 0) + (sess.duration_seconds ?? 0));
    });
    const stats: SectionStat[] = sections
      .map((sec) => ({ id: sec.id, name: sec.name, seconds: bySection.get(sec.id) ?? 0 }))
      .sort((a, b) => b.seconds - a.seconds);
    setPerSection(stats);

    setLoading(false);
  }, [user]);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Live refresh: re-fetch whenever a focus session is inserted or updated
  // (covers natural completion, manual stop, and mark-complete).
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dashboard-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "focus_sessions" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sections" }, () => {
        void load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, load]);

  // Add elapsed time from any in-progress session. The DB row for that session
  // starts at duration_seconds=0, so this doesn't double-count.
  const liveElapsed = active ? active.durationSeconds - remaining : 0;
  const totalFocusLabel = formatFocusTime(totalSeconds + liveElapsed);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-32 rounded-3xl shimmer-warm" />
          <div className="h-32 rounded-3xl shimmer-warm" />
        </div>
        <div className="h-48 rounded-3xl shimmer-warm" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-cream">Dashboard</h1>
        <p className="text-sm text-muted-foreground">A look at your time at the counter.</p>
      </div>

      {!hasAny ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-card/60 px-6 py-16 text-center shadow-amber">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Coffee className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-cream">Nothing brewed yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Complete a focus session and your stats will start filling up here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <StatCard
              icon={<Flame className="h-5 w-5" />}
              label="Current streak"
              value={`${streak} ${streak === 1 ? "day" : "days"}`}
              hint="Complete a task today to keep it warm."
            />
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              label="Total focused"
              value={totalFocusLabel}
              hint="Across every session you've finished."
            />
          </div>

          <div className="mt-4">
            <FocusHeatmap sessions={sessions} />
          </div>

          <div className="mt-4 rounded-3xl bg-card p-6 shadow-amber">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-cream">By section</h2>
              <span className="text-xs text-muted-foreground">Hours focused</span>
            </div>
            <p className="mb-6 text-xs text-muted-foreground">
              Hours are counted from completed timer sessions only.
            </p>
            {perSection.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sections yet — create one in the sidebar.</p>
            ) : (
              <SectionDonut data={perSection} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-amber transition hover:bg-surface-raised">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </span>
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-4 text-4xl font-semibold text-cream">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
