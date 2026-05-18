-- Production security hardening: session bounds, invite rate limits, generic errors.

-- 1. Cap focus session duration (prevents client-side stat inflation).
CREATE OR REPLACE FUNCTION public.enforce_focus_session_bounds()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  max_seconds int := 14400; -- 4 hours per session
BEGIN
  IF NEW.duration_seconds < 0 OR NEW.duration_seconds > max_seconds THEN
    RAISE EXCEPTION 'INVALID_SESSION_DURATION' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'SESSION_USER_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS focus_sessions_bounds_insert ON public.focus_sessions;
CREATE TRIGGER focus_sessions_bounds_insert
BEFORE INSERT ON public.focus_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_focus_session_bounds();

DROP TRIGGER IF EXISTS focus_sessions_bounds_update ON public.focus_sessions;
CREATE TRIGGER focus_sessions_bounds_update
BEFORE UPDATE ON public.focus_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_focus_session_bounds();

REVOKE ALL ON FUNCTION public.enforce_focus_session_bounds() FROM PUBLIC, anon, authenticated;

-- 2. Rate-limit invite redemption (brute-force mitigation).
CREATE TABLE IF NOT EXISTS public.invite_redeem_attempts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_redeem_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS invite_redeem_attempts_user_time_idx
  ON public.invite_redeem_attempts (user_id, attempted_at DESC);

CREATE OR REPLACE FUNCTION public.redeem_invite(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _row public.invites%ROWTYPE;
  _redeemed_count int;
  _recent_attempts int;
  generic_error text := 'This invite code is invalid or has already been used.';
BEGIN
  IF _user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  SELECT count(*) INTO _recent_attempts
  FROM public.invite_redeem_attempts
  WHERE user_id = _user AND attempted_at > now() - interval '15 minutes';

  IF _recent_attempts >= 15 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many attempts. Please wait and try again.');
  END IF;

  INSERT INTO public.invite_redeem_attempts (user_id) VALUES (_user);

  IF EXISTS (SELECT 1 FROM public.invites WHERE used_by = _user) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  SELECT count(*) INTO _redeemed_count FROM public.invites WHERE used = true;
  IF _redeemed_count >= 300 THEN
    RETURN jsonb_build_object('ok', false, 'error', generic_error);
  END IF;

  SELECT * INTO _row FROM public.invites WHERE code = upper(trim(_code)) FOR UPDATE;

  IF NOT FOUND OR _row.used OR (_row.expires_at IS NOT NULL AND _row.expires_at < now()) THEN
    RETURN jsonb_build_object('ok', false, 'error', generic_error);
  END IF;

  UPDATE public.invites
  SET used = true, used_by = _user, used_at = now()
  WHERE code = _row.code;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;
