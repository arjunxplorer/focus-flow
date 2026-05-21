import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queries/keys";

const DEBOUNCE_MS = 300;

/**
 * Single app-level Realtime subscription that debounces React Query invalidations
 * instead of full page refetches.
 */
export function useRealtimeSync() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const invalidate = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sections(userId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.todayTasks(userId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.historyTasks(userId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(userId) });
      }, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("app-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "focus_sessions" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "sections" }, invalidate)
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
