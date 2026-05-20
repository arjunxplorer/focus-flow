import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Session {
  started_at?: string | null;
  duration_seconds: number;
}

interface Props {
  sessions: Session[];
}

const WEEKS = 52;
const DAY_MS = 86400000;

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function bucket(hours: number): 0 | 1 | 2 | 3 | 4 {
  if (hours <= 0) return 0;
  if (hours < 0.5) return 1;
  if (hours < 1) return 2;
  if (hours < 2) return 3;
  return 4;
}

const BUCKET_CLASS: Record<number, string> = {
  0: "bg-secondary/60",
  1: "bg-primary/15",
  2: "bg-primary/35",
  3: "bg-primary/65",
  4: "bg-primary shadow-amber",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function FocusHeatmap({ sessions }: Props) {
  const { columns, monthLabels } = useMemo(() => {
    // Aggregate hours per local date
    const perDay = new Map<string, number>();
    sessions.forEach((s) => {
      if (!s.started_at) return;
      const key = localDateKey(new Date(s.started_at));
      perDay.set(key, (perDay.get(key) ?? 0) + (s.duration_seconds ?? 0) / 3600);
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayDow = now.getDay(); // 0=Sun..6=Sat

    // Find the Sunday that anchors the rightmost column (this week's Sunday).
    const lastSunday = new Date(now.getTime() - todayDow * DAY_MS);
    // Start: WEEKS-1 weeks before lastSunday, so we have WEEKS columns total.
    const start = new Date(lastSunday.getTime() - (WEEKS - 1) * 7 * DAY_MS);

    type Cell = { date: Date; key: string; hours: number; future: boolean } | null;
    const columns: Cell[][] = [];
    const monthLabels: (string | null)[] = [];

    for (let w = 0; w < WEEKS; w++) {
      const col: Cell[] = [];
      let firstNonFutureDate: Date | null = null;
      for (let d = 0; d < 7; d++) {
        const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
        const future = date.getTime() > now.getTime();
        const key = localDateKey(date);
        const hours = perDay.get(key) ?? 0;
        col.push({ date, key, hours, future });
        if (!future && !firstNonFutureDate) firstNonFutureDate = date;
      }
      columns.push(col);
      // Month label = month of the first day of this column, shown only when month changes
      const firstOfCol = col[0]!.date;
      const prev = w > 0 ? columns[w - 1][0]!.date : null;
      monthLabels.push(!prev || prev.getMonth() !== firstOfCol.getMonth() ? MONTH_NAMES[firstOfCol.getMonth()] : null);
    }

    return { columns, monthLabels };
  }, [sessions]);

  return (
    <div className="rounded-3xl bg-card p-6 shadow-amber">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-cream">Past year</h2>
        <span className="text-xs text-muted-foreground">Hours per day</span>
      </div>

      <TooltipProvider delayDuration={100}>
        <div className="overflow-x-auto">
          <div className="inline-block">
            {/* Month labels row */}
            <div className="mb-1.5 ml-6 flex gap-1.5">
              {monthLabels.map((m, i) => (
                <div key={i} className="w-3 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                  {m ?? ""}
                </div>
              ))}
            </div>

            <div className="flex gap-1.5">
              {/* Day-of-week labels */}
              <div className="mr-1 flex flex-col gap-1.5 text-[10px] text-muted-foreground/70">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="flex h-3 items-center">{i % 2 === 1 ? d : ""}</div>
                ))}
              </div>

              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-1.5">
                  {col.map((cell, ri) => {
                    if (!cell) return <div key={ri} className="h-3 w-3" />;
                    if (cell.future) {
                      return <div key={ri} className="h-3 w-3 rounded-[3px] bg-secondary/20" />;
                    }
                    const b = bucket(cell.hours);
                    return (
                      <Tooltip key={ri}>
                        <TooltipTrigger asChild>
                          <div
                            className={`h-3 w-3 rounded-[3px] transition-transform hover:scale-110 ${BUCKET_CLASS[b]}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="rounded-lg bg-popover text-cream">
                          <div className="text-xs">
                            <div className="font-medium">
                              {cell.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            </div>
                            <div className="text-muted-foreground">
                              {cell.hours === 0 ? "No focus" : `${cell.hours.toFixed(1)}h focused`}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </TooltipProvider>

      <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((b) => (
          <div key={b} className={`h-3 w-3 rounded-[3px] ${BUCKET_CLASS[b]}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
