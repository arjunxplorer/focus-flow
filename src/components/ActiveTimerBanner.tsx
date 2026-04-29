import { Pause, Play, X, Coffee } from "lucide-react";
import { useTimer, formatTime } from "@/contexts/TimerContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function ActiveTimerBanner() {
  const { active, remaining, pause, resume, stop } = useTimer();
  const navigate = useNavigate();
  if (!active) return null;

  return (
    <div className="sticky top-0 z-40 px-4 pt-3">
      <div
        className="flex items-center gap-3 rounded-2xl bg-card/95 backdrop-blur px-4 py-3 animate-amber-pulse cursor-pointer"
        onClick={() => navigate(`/timer/${active.taskId}`)}
        role="button"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Coffee className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {active.paused ? "Paused" : "Focusing on"}
          </div>
          <div className="truncate text-sm font-medium text-cream">{active.taskTitle}</div>
        </div>
        <div className="font-mono text-2xl font-semibold tabular-nums text-primary">
          {formatTime(remaining)}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-xl text-cream hover:bg-secondary"
          onClick={(e) => { e.stopPropagation(); active.paused ? resume() : pause(); }}
          aria-label={active.paused ? "Resume" : "Pause"}
        >
          {active.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-secondary hover:text-cream"
          onClick={(e) => { e.stopPropagation(); stop(false); }}
          aria-label="Stop"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
