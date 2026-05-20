import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { localDateKey } from "@/lib/dates";

interface Session {
  started_at?: string | null;
  duration_seconds: number;
}

interface Props {
  sessions: Session[];
}

/** ~3 months of weekly columns (GitHub-style, Sunday-start). */
const WEEKS = 13;
const DAY_MS = 86400000;
/** Matches Tailwind h-4 w-4 + gap-2 */
const COL_STRIDE_PX = 24;
const DAY_LABEL_OFFSET_PX = 28;

function bucket(hours: number): 0 | 1 | 2 | 3 | 4 {
  if (hours <= 0) return 0;
  if (hours < 0.5) return 1;
  if (hours < 1) return 2;
  if (hours < 2) return 3;
  return 4;
}

const BUCKET_CLASS: Record<number, string> = {
  0: "bg-secondary/60",
  1: "bg-primary/25",
  2: "bg-primary/45",
  3: "bg-primary/70",
  4: "bg-primary shadow-amber",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function FocusHeatmap({ sessions }: Props) {
  const { columns, monthMarkers } = useMemo(() => {
    const perDay = new Map<string, number>();
    sessions.forEach((s) => {
      if (!s.started_at) return;
      const key = localDateKey(new Date(s.started_at));
      perDay.set(key, (perDay.get(key) ?? 0) + (s.duration_seconds ?? 0) / 3600);
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayDow = now.getDay();

    const lastSunday = new Date(now.getTime() - todayDow * DAY_MS);
    const start = new Date(lastSunday.getTime() - (WEEKS - 1) * 7 * DAY_MS);

    type Cell = { date: Date; key: string; hours: number; future: boolean };
    const columns: Cell[][] = [];
    const monthMarkers: { weekIndex: number; label: string }[] = [];

    for (let w = 0; w < WEEKS; w++) {
      const col: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
        const future = date.getTime() > now.getTime();
        const key = localDateKey(date);
        const hours = perDay.get(key) ?? 0;
        col.push({ date, key, hours, future });
      }
      columns.push(col);

      const firstOfCol = col[0].date;
      const prev = w > 0 ? columns[w - 1][0].date : null;
      if (!prev || prev.getMonth() !== firstOfCol.getMonth()) {
        monthMarkers.push({ weekIndex: w, label: MONTH_NAMES[firstOfCol.getMonth()] });
      }
    }

    return { columns, monthMarkers };
  }, [sessions]);

  const gridWidthPx = columns.length * COL_STRIDE_PX - 8;

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-3xl bg-card p-6 shadow-amber">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-cream">Last 3 months</h2>
        <span className="text-xs text-muted-foreground">Timer sessions</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Hours focused per day</p>

      <div className="flex min-h-0 flex-1 items-center">
        <TooltipProvider delayDuration={100}>
          <div className="w-full overflow-x-auto">
            <div className="inline-block min-w-0">
              <div
                className="relative mb-2 h-4 text-[10px] uppercase tracking-wider text-muted-foreground/80"
                style={{ marginLeft: DAY_LABEL_OFFSET_PX, width: gridWidthPx }}
              >
                {monthMarkers.map(({ weekIndex, label }) => (
                  <span
                    key={`${label}-${weekIndex}`}
                    className="absolute whitespace-nowrap"
                    style={{ left: weekIndex * COL_STRIDE_PX }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <div
                  className="mr-1 flex flex-col gap-2 text-[10px] text-muted-foreground/70"
                  style={{ width: DAY_LABEL_OFFSET_PX - 8 }}
                >
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i} className="flex h-4 items-center">
                      {i % 2 === 1 ? d : ""}
                    </div>
                  ))}
                </div>

                {columns.map((col, ci) => (
                  <div key={ci} className="flex flex-col gap-2">
                    {col.map((cell, ri) => {
                      if (cell.future) {
                        return <div key={ri} className="h-4 w-4 rounded-[4px] bg-secondary/20" />;
                      }
                      const b = bucket(cell.hours);
                      return (
                        <Tooltip key={ri}>
                          <TooltipTrigger asChild>
                            <div
                              className={`h-4 w-4 rounded-[4px] transition-transform hover:scale-110 ${BUCKET_CLASS[b]}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="rounded-lg bg-popover text-cream">
                            <div className="text-xs">
                              <div className="font-medium">
                                {cell.date.toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
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
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((b) => (
          <div key={b} className={`h-3.5 w-3.5 rounded-[3px] ${BUCKET_CLASS[b]}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
