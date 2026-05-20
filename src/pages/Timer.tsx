import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pause, Play, RotateCcw, Check, Volume2, VolumeX } from "lucide-react";
import { isTimerSoundMuted, setTimerSoundMuted } from "@/lib/timerSound";
import { Button } from "@/components/ui/button";
import { useTimer, formatTime } from "@/contexts/TimerContext";
import { supabase } from "@/integrations/supabase/client";

export default function Timer() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { active, remaining, start, pause, resume, reset, stop } = useTimer();
  const [task, setTask] = useState<{ id: string; title: string; duration_minutes: number; section_id: string | null } | null>(null);
  const [sectionName, setSectionName] = useState<string | undefined>();
  const [soundMuted, setSoundMuted] = useState(() => isTimerSoundMuted());

  useEffect(() => {
    if (!taskId) return;
    supabase.from("tasks").select("id,title,duration_minutes,section_id").eq("id", taskId).maybeSingle().then(async ({ data }) => {
      if (!data) return;
      setTask(data);
      if (data.section_id) {
        const { data: s } = await supabase.from("sections").select("name").eq("id", data.section_id).maybeSingle();
        setSectionName(s?.name);
      }
    });
  }, [taskId]);

  const isThisTask = active?.taskId === taskId;
  const total = isThisTask ? active.durationSeconds : (task?.duration_minutes ?? 25) * 60;
  const display = isThisTask ? remaining : total;
  const progress = total > 0 ? 1 - display / total : 0;

  const SIZE = 280;
  const STROKE = 14;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;

  const handleStart = async () => {
    if (!task) return;
    await start(task.id, task.title, task.duration_minutes);
  };

  const handleStop = async () => {
    await stop(true);
    navigate("/");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate("/")} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-cream transition">
        <ArrowLeft className="h-4 w-4" />
        Back to tasks
      </button>

      <div className="rounded-3xl bg-card p-8 shadow-amber-lg">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {sectionName ?? "Focus"}
            </div>
            {isThisTask && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-cream"
                onClick={() => {
                  const next = !soundMuted;
                  setSoundMuted(next);
                  setTimerSoundMuted(next);
                }}
                aria-label={soundMuted ? "Unmute timer sound" : "Mute timer sound"}
              >
                {soundMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-cream">{task?.title ?? "…"}</h1>
        </div>

        <div className="my-8 flex justify-center">
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} className="-rotate-90">
              <circle
                cx={SIZE / 2} cy={SIZE / 2} r={R}
                stroke="hsl(var(--muted))" strokeWidth={STROKE} fill="none"
              />
              <circle
                cx={SIZE / 2} cy={SIZE / 2} r={R}
                stroke="hsl(var(--primary))"
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={C}
                strokeDashoffset={C * progress}
                style={{ transition: "stroke-dashoffset 0.4s linear", filter: "drop-shadow(0 0 12px hsl(38 92% 50% / 0.45))" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-mono text-6xl font-semibold tabular-nums text-cream">
                {formatTime(display)}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                {isThisTask ? (active.paused ? "Paused" : "Running") : "Ready"}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {!isThisTask ? (
            <Button onClick={handleStart} size="lg" className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-amber-lg px-8">
              <Play className="mr-1.5 h-4 w-4" /> Start
            </Button>
          ) : (
            <>
              {active.paused ? (
                <Button onClick={resume} size="lg" className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-amber px-8">
                  <Play className="mr-1.5 h-4 w-4" /> Resume
                </Button>
              ) : (
                <Button onClick={pause} size="lg" variant="secondary" className="rounded-2xl px-8">
                  <Pause className="mr-1.5 h-4 w-4" /> Pause
                </Button>
              )}
              <Button onClick={reset} size="lg" variant="ghost" className="rounded-2xl text-muted-foreground hover:text-cream">
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
              </Button>
              <Button onClick={handleStop} size="lg" variant="outline" className="rounded-2xl border-0 bg-secondary text-cream hover:bg-secondary/70">
                <Check className="mr-1.5 h-4 w-4" /> Mark complete
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
