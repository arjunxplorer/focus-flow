-- Composite indexes for date-scoped queries + dashboard stats RPC.

CREATE INDEX IF NOT EXISTS focus_sessions_user_started_idx
  ON public.focus_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS tasks_user_completed_idx
  ON public.tasks (user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_user_created_idx
  ON public.tasks (user_id, created_at DESC);

-- Aggregated dashboard payload (91-day session window; streak from all completions).
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cutoff timestamptz := date_trunc('day', now()) - interval '91 days';
  v_total_tasks int;
  v_completed_tasks int;
  v_total_seconds bigint;
  v_has_any boolean;
  v_sessions jsonb;
  v_per_section jsonb;
  v_completion_dates jsonb;
  v_streak int := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object(
      'streak', 0,
      'total_tasks', 0,
      'completed_tasks', 0,
      'total_seconds', 0,
      'has_any', false,
      'sessions', '[]'::jsonb,
      'per_section', '[]'::jsonb
    );
  END IF;

  IF NOT public.user_has_redeemed_invite() THEN
    RETURN jsonb_build_object(
      'streak', 0,
      'total_tasks', 0,
      'completed_tasks', 0,
      'total_seconds', 0,
      'has_any', false,
      'sessions', '[]'::jsonb,
      'per_section', '[]'::jsonb
    );
  END IF;

  SELECT count(*)::int, count(*) FILTER (WHERE completed)::int
  INTO v_total_tasks, v_completed_tasks
  FROM public.tasks
  WHERE user_id = uid;

  SELECT coalesce(sum(duration_seconds), 0)::bigint
  INTO v_total_seconds
  FROM public.focus_sessions
  WHERE user_id = uid
    AND started_at >= cutoff;

  SELECT EXISTS (
    SELECT 1 FROM public.tasks WHERE user_id = uid
    UNION ALL
    SELECT 1 FROM public.focus_sessions WHERE user_id = uid AND started_at >= cutoff
    LIMIT 1
  ) INTO v_has_any;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'started_at', started_at,
      'duration_seconds', duration_seconds,
      'task_id', task_id
    )
  ), '[]'::jsonb)
  INTO v_sessions
  FROM public.focus_sessions
  WHERE user_id = uid
    AND started_at >= cutoff;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object('id', s.id, 'name', s.name, 'seconds', coalesce(x.seconds, 0))
    ORDER BY coalesce(x.seconds, 0) DESC
  ), '[]'::jsonb)
  INTO v_per_section
  FROM public.sections s
  LEFT JOIN (
    SELECT t.section_id AS sid, sum(fs.duration_seconds)::bigint AS seconds
    FROM public.focus_sessions fs
    JOIN public.tasks t ON t.id = fs.task_id
    WHERE fs.user_id = uid
      AND fs.started_at >= cutoff
      AND t.section_id IS NOT NULL
    GROUP BY t.section_id
  ) x ON x.sid = s.id
  WHERE s.user_id = uid;

  SELECT coalesce(jsonb_agg(completed_at ORDER BY completed_at DESC), '[]'::jsonb)
  INTO v_completion_dates
  FROM public.tasks
  WHERE user_id = uid
    AND completed_at IS NOT NULL;

  RETURN jsonb_build_object(
    'streak', v_streak,
    'total_tasks', v_total_tasks,
    'completed_tasks', v_completed_tasks,
    'total_seconds', v_total_seconds,
    'has_any', v_has_any,
    'sessions', v_sessions,
    'per_section', v_per_section,
    'completion_dates', v_completion_dates
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
