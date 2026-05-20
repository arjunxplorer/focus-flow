import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";
import { playTimerCompleteSound } from "@/lib/timerSound";

interface ActiveTimer {
  taskId: string;
  taskTitle: string;
  durationSeconds: number;
  endsAt: number; // epoch ms
  paused: boolean;
  pausedRemaining?: number;
  sessionId?: string;
}

interface TimerContextValue {
  active: ActiveTimer | null;
  remaining: number; // seconds
  start: (taskId: string, title: string, minutes: number) => Promise<void>;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  stop: (markCompleted?: boolean) => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

/** Seconds actually spent on the timer (excludes remaining time). */
export function getWorkedSeconds(cur: ActiveTimer, remainingSeconds?: number): number {
  const remaining =
    remainingSeconds ??
    (cur.paused
      ? (cur.pausedRemaining ?? 0)
      : Math.max(0, Math.round((cur.endsAt - Date.now()) / 1000)));
  return Math.max(0, cur.durationSeconds - remaining);
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [remaining, setRemaining] = useState(0);

  // Refs that always hold the latest values — safe to read inside callbacks
  // without stale-closure issues.
  const activeRef = useRef<ActiveTimer | null>(null);
  const userRef = useRef(user);
  // Guards against the natural-completion handler firing more than once.
  const completingRef = useRef(false);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { activeRef.current = active; }, [active]);

  const completeNaturally = useCallback(async (t: ActiveTimer) => {
    if (!userRef.current) return;
    await supabase
      .from("tasks")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", t.taskId);
    if (t.sessionId) {
      await supabase
        .from("focus_sessions")
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: getWorkedSeconds(t, 0),
          completed: true,
        })
        .eq("id", t.sessionId);
    }
    playTimerCompleteSound();
    toast.success("Session complete — well done.", {
      description: `"${t.taskTitle}" marked done.`,
    });
  }, []);

  // Tick reads from activeRef so it never has a stale closure, and all state
  // updates happen outside the setActive updater (pure function requirement).
  const tick = useCallback(() => {
    const cur = activeRef.current;
    if (!cur) return;

    if (cur.paused) {
      setRemaining(cur.pausedRemaining ?? 0);
      return;
    }

    const r = Math.max(0, Math.round((cur.endsAt - Date.now()) / 1000));
    setRemaining(r);

    if (r === 0 && !completingRef.current) {
      completingRef.current = true;
      setActive(null);
      void completeNaturally(cur).finally(() => {
        completingRef.current = false;
      });
    }
  }, [completeNaturally]);

  useEffect(() => {
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [tick]);

  const start = async (taskId: string, title: string, minutes: number) => {
    if (!userRef.current) return;
    const seconds = minutes * 60;
    const { data: sess } = await supabase
      .from("focus_sessions")
      .insert({
        user_id: userRef.current.id,
        task_id: taskId,
        started_at: new Date().toISOString(),
        duration_seconds: 0,
        completed: false,
      })
      .select()
      .single();
    const timer: ActiveTimer = {
      taskId,
      taskTitle: title,
      durationSeconds: seconds,
      endsAt: Date.now() + seconds * 1000,
      paused: false,
      sessionId: sess?.id,
    };
    setActive(timer);
    setRemaining(seconds);
  };

  const pause = () => {
    setActive((cur) => {
      if (!cur || cur.paused) return cur;
      const r = Math.max(0, Math.round((cur.endsAt - Date.now()) / 1000));
      return { ...cur, paused: true, pausedRemaining: r };
    });
  };

  const resume = () => {
    setActive((cur) => {
      if (!cur || !cur.paused) return cur;
      const r = cur.pausedRemaining ?? 0;
      return { ...cur, paused: false, pausedRemaining: undefined, endsAt: Date.now() + r * 1000 };
    });
  };

  const reset = () => {
    const cur = activeRef.current;
    if (!cur) return;
    setActive({ ...cur, paused: true, pausedRemaining: cur.durationSeconds, endsAt: Date.now() + cur.durationSeconds * 1000 });
    setRemaining(cur.durationSeconds);
  };

  const stop = async (markCompleted = false) => {
    // Read from the ref so we always get the latest active, even if a
    // natural-completion tick just set the state version to null.
    const cur = activeRef.current;
    setActive(null);
    setRemaining(0);

    if (!cur || !userRef.current) return;

    const workedSeconds = getWorkedSeconds(cur);

    if (cur.sessionId) {
      await supabase
        .from("focus_sessions")
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: workedSeconds,
          completed: markCompleted,
        })
        .eq("id", cur.sessionId);
    }

    if (markCompleted) {
      await supabase
        .from("tasks")
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq("id", cur.taskId);
      playTimerCompleteSound();
      toast.success("Marked complete.");
    }
  };

  return (
    <TimerContext.Provider value={{ active, remaining, start, pause, resume, reset, stop }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}

export function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
