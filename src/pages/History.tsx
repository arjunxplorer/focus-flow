import { useQuery } from "@tanstack/react-query";
import { Archive, Tag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSections } from "@/hooks/useSections";
import { queryKeys } from "@/lib/queries/keys";
import { fetchHistoryTasks, groupHistoryTasks } from "@/lib/queries/tasks";
import { dayKey } from "@/lib/dates";
import type { HistoryTask } from "@/lib/queries/types";

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
  const userId = user?.id;

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: queryKeys.historyTasks(userId),
    queryFn: fetchHistoryTasks,
    enabled: !!userId,
  });

  const { data: sections = [] } = useSections();

  const { groups, sortedKeys, today } = groupHistoryTasks(tasks);
  const yesterdayKey = dayKey(new Date(Date.now() - 86400000));

  const sectionName = (id: string | null) => sections.find((s) => s.id === id)?.name;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-cream">History</h1>
        <p className="text-sm text-muted-foreground">Every session you've brewed.</p>
      </div>

      {isLoading ? (
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

function HistoryCard({ task, section }: { task: HistoryTask; section?: string }) {
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
