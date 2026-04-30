-- 1. Invites table
CREATE TABLE public.invites (
  code text PRIMARY KEY,
  used boolean NOT NULL DEFAULT false,
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Users can check if THEY have redeemed (used to gate the app)
CREATE POLICY "Users see their own redeemed invite"
ON public.invites FOR SELECT
TO authenticated
USING (used_by = auth.uid());

-- Helper: generate a readable invite code like BREW-7K2X
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  s text := 'BREW-';
  i int;
BEGIN
  FOR i IN 1..4 LOOP
    s := s || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN s;
END;
$$;

-- Bulk generator (use later to add more codes)
CREATE OR REPLACE FUNCTION public.generate_invite_codes(_n int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted int := 0;
  attempt text;
  i int := 0;
BEGIN
  WHILE inserted < _n AND i < _n * 10 LOOP
    attempt := public.generate_invite_code();
    BEGIN
      INSERT INTO public.invites (code) VALUES (attempt);
      inserted := inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      -- collision, try again
    END;
    i := i + 1;
  END LOOP;
  RETURN inserted;
END;
$$;

-- Seed 300 codes
SELECT public.generate_invite_codes(300);

-- Redemption function
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
BEGIN
  IF _user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  -- User already redeemed? (specific message ok — user-scoped)
  IF EXISTS (SELECT 1 FROM public.invites WHERE used_by = _user) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  -- Hard cap on total redeemed invites
  SELECT count(*) INTO _redeemed_count FROM public.invites WHERE used = true;
  IF _redeemed_count >= 300 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Focus Flow is full right now. Please check back later.');
  END IF;

  -- Lock and validate the code
  SELECT * INTO _row FROM public.invites WHERE code = upper(trim(_code)) FOR UPDATE;

  IF NOT FOUND OR _row.used OR (_row.expires_at IS NOT NULL AND _row.expires_at < now()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This invite code is invalid or has already been used.');
  END IF;

  UPDATE public.invites
  SET used = true, used_by = _user, used_at = now()
  WHERE code = _row.code;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Allow authenticated users to call the redemption function
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;

-- 2. Section limit (max 6 per user)
CREATE OR REPLACE FUNCTION public.enforce_section_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.sections WHERE user_id = NEW.user_id) >= 6 THEN
    RAISE EXCEPTION 'SECTION_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sections_limit_trigger
BEFORE INSERT ON public.sections
FOR EACH ROW EXECUTE FUNCTION public.enforce_section_limit();

-- Re-attach the auto-profile trigger if missing (handle_new_user already exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();