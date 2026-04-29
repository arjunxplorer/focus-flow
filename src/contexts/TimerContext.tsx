import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

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

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [remaining, setRemaining] = useState(0);
  const tickRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    setActive((cur) => {
      if (!cur) return cur;
      if (cur.paused) {
        setRemaining(cur.pausedRemaining ?? 0);
        return cur;
      }
      const r = Math.max(0, Math.round((cur.endsAt - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) {
        // Auto-complete
        void completeNaturally(cur);
        return null;
      }
      return cur;
    });
  }, []);

  useEffect(() => {
    tickRef.current = window.setInterval(tick, 250);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [tick]);

  const completeNaturally = async (t: ActiveTimer) => {
    if (!user) return;
    await supabase.from("tasks").update({
      completed: true,
      completed_at: new Date().toISOString(),
    }).eq("id", t.taskId);
    if (t.sessionId) {
      await supabase.from("focus_sessions").update({
        ended_at: new Date().toISOString(),
        duration_seconds: t.durationSeconds,
        completed: true,
      }).eq("id", t.sessionId);
    }
    toast.success("Session complete — well done.", {
      description: `“${t.taskTitle}” marked done.`,
    });
  };

  const start = async (taskId: string, title: string, minutes: number) => {
    if (!user) return;
    const seconds = minutes * 60;
    const { data: sess } = await supabase
      .from("focus_sessions")
      .insert({
        user_id: user.id,
        task_id: taskId,
        duration_seconds: 0,
        completed: false,
      })
      .select()
      .single();
    setActive({
      taskId,
      taskTitle: title,
      durationSeconds: seconds,
      endsAt: Date.now() + seconds * 1000,
      paused: false,
      sessionId: sess?.id,
    });
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
    setActive((cur) => {
      if (!cur) return cur;
      return { ...cur, paused: true, pausedRemaining: cur.durationSeconds, endsAt: Date.now() + cur.durationSeconds * 1000 };
    });
    setRemaining((r) => r);
  };

  const stop = async (markCompleted = false) => {
    const cur = active;
    if (!cur || !user) {
      setActive(null);
      return;
    }
    const elapsed = cur.paused
      ? cur.durationSeconds - (cur.pausedRemaining ?? 0)
      : cur.durationSeconds - Math.max(0, Math.round((cur.endsAt - Date.now()) / 1000));
    if (cur.sessionId) {
      await supabase.from("focus_sessions").update({
        ended_at: new Date().toISOString(),
        duration_seconds: Math.max(0, elapsed),
        completed: markCompleted,
      }).eq("id", cur.sessionId);
    }
    if (markCompleted) {
      await supabase.from("tasks").update({
        completed: true,
        completed_at: new Date().toISOString(),
      }).eq("id", cur.taskId);
      toast.success("Marked complete.");
    }
    setActive(null);
    setRemaining(0);
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
