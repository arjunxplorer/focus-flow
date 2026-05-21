import { useQuery } from "@tanstack/react-query";
import { Flame, Clock, Coffee, ListChecks } from "lucide-react";
import { DashboardTotalFocus } from "@/components/LiveFocusTime";
import { FocusHeatmap } from "@/components/FocusHeatmap";
import { SectionDonut } from "@/components/SectionDonut";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queries/keys";
import { fetchDashboardStats } from "@/lib/queries/dashboard";

export default function Dashboard() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dashboard(userId),
    queryFn: fetchDashboardStats,
    enabled: !!userId,
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-28 rounded-3xl shimmer-warm" />
          <div className="h-28 rounded-3xl shimmer-warm" />
          <div className="h-28 rounded-3xl shimmer-warm" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-h-[320px] rounded-3xl shimmer-warm" />
          <div className="min-h-[320px] rounded-3xl shimmer-warm" />
        </div>
      </div>
    );
  }

  const {
    streak,
    totalTasks,
    completedTasks,
    totalSeconds,
    hasAny,
    sessions,
    perSection,
  } = data;

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              icon={<Flame className="h-5 w-5" />}
              label="Current streak"
              value={`${streak} ${streak === 1 ? "day" : "days"}`}
              hint="Complete a task today to keep it warm."
            />
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              label="Total focused"
              value={<DashboardTotalFocus baseSeconds={totalSeconds} />}
              hint="Across every session you've finished."
            />
            <StatCard
              icon={<ListChecks className="h-5 w-5" />}
              label="Tasks completed"
              value={`${completedTasks}/${totalTasks}`}
              hint="Done out of all tasks you've created."
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
            <FocusHeatmap sessions={sessions} />

            <div className="flex h-full min-h-[320px] flex-col rounded-3xl bg-card p-6 shadow-amber">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-cream">By section</h2>
                <span className="text-xs text-muted-foreground">Hours focused</span>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Hours are counted from completed timer sessions only.
              </p>
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                {perSection.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    No sections yet — create one in the sidebar.
                  </p>
                ) : (
                  <SectionDonut data={perSection} />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-amber transition hover:bg-surface-raised">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </span>
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums text-cream sm:text-4xl">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
