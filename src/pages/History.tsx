import { useEffect, useState } from "react";
import { Archive, Tag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { dayKey, todayKey as getTodayKey } from "@/lib/dates";

interface TaskRow {
  id: string;
  title: string;
  duration_minutes: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  section_id: string | null;
}
interface Section { id: string; name: string }

function formatGroupLabel(key: string, today: string, yesterdayKey: string) {
  if (key === today) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function History() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const [t, s] = await Promise.all([
        supabase
          .from("tasks")
          .select("id,title,duration_minutes,completed,completed_at,created_at,section_id")
          .order("created_at", { ascending: false }),
        supabase.from("sections").select("id,name"),
      ]);
      setTasks((t.data ?? []) as TaskRow[]);
      setSections(s.data ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  const now = new Date();
  const today = getTodayKey(now);
  const yesterdayKey = dayKey(new Date(now.getTime() - 86400000));

  // Completed tasks move here after local midnight; today's completed stay on Tasks.
  // Incomplete tasks from earlier days stay here until you finish them.
  const historyTasks = tasks.filter((t) => {
    if (t.completed && t.completed_at) {
      return dayKey(new Date(t.completed_at)) < today;
    }
    const createdKey = dayKey(new Date(t.created_at));
    return createdKey < today;
  });

  // Group by completion date when completed, otherwise by creation date.
  // This correctly buckets a task created at 11:58pm and finished at 12:02am
  // under the day it was finished.
  const groups = new Map<string, TaskRow[]>();
  historyTasks.forEach((t) => {
    const refDate = t.completed && t.completed_at ? t.completed_at : t.created_at;
    const key = dayKey(new Date(refDate));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  });
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : -1));

  const sectionName = (id: string | null) => sections.find((s) => s.id === id)?.name;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-cream">History</h1>
        <p className="text-sm text-muted-foreground">Every session you've brewed.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[78px] rounded-2xl shimmer-warm" />
          ))}
        </div>
      ) : sortedKeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-card/60 px-6 py-16 text-center shadow-amber">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Archive className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-cream">Nothing here yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Completed tasks from earlier days appear here after midnight.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedKeys.map((key) => (
            <section key={key}>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {formatGroupLabel(key, today, yesterdayKey)}
              </h2>
              <div className="space-y-3">
                {groups.get(key)!.map((t) => (
                  <HistoryCard key={t.id} task={t} section={sectionName(t.section_id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ task, section }: { task: TaskRow; section?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card/70 px-4 py-3.5 shadow-amber opacity-90">
      <div className="min-w-0 flex-1">
        <div className={`truncate font-medium ${task.completed ? "text-cream" : "text-muted-foreground"}`}>
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {section && (
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5">
              <Tag className="h-3 w-3" />
              {section}
            </span>
          )}
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-primary">
            {task.duration_minutes} min
          </span>
          {task.completed && task.completed_at ? (
            <span className="inline-flex items-center rounded-md bg-secondary/60 px-2 py-0.5">
              {formatTime(task.completed_at)}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md bg-secondary/40 px-2 py-0.5 italic">
              Not completed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
