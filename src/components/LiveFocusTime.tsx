import { useMemo } from "react";
import { useTimerActive, useTimerRemaining } from "@/contexts/TimerContext";
import {
  getLiveFocusElapsedForScope,
  sumTodayFocusSeconds,
  type FocusSessionSlice,
} from "@/lib/focusStats";
import { formatFocusTime } from "@/lib/utils";

interface Props {
  todaySessions: FocusSessionSlice[];
  taskSectionById: Map<string, string | null>;
  sectionId?: string;
  sectionName?: string;
}

/** Isolated subscriber to timer ticks — parent page does not re-render every 250ms. */
export function TodayFocusLabel({ todaySessions, taskSectionById, sectionId, sectionName }: Props) {
  const active = useTimerActive();
  const remaining = useTimerRemaining();

  const todayFocusSeconds = useMemo(
    () =>
      sumTodayFocusSeconds(todaySessions, {
        sectionId,
        taskSection: taskSectionById,
      }),
    [todaySessions, sectionId, taskSectionById],
  );

  const liveElapsed = useMemo(
    () => getLiveFocusElapsedForScope(active, remaining, sectionId, taskSectionById),
    [active, remaining, sectionId, taskSectionById],
  );

  const label = formatFocusTime(todayFocusSeconds + liveElapsed);

  return (
    <span className="font-medium tabular-nums">{label}</span>
  );
}

export function DashboardTotalFocus({ baseSeconds }: { baseSeconds: number }) {
  const active = useTimerActive();
  const remaining = useTimerRemaining();
  const liveElapsed = active ? active.durationSeconds - remaining : 0;
  return <>{formatFocusTime(baseSeconds + liveElapsed)}</>;
}
