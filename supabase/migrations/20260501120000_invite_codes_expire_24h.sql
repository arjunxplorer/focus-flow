-- New rows that omit expires_at get 24 hours from insert time.
ALTER TABLE public.invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

-- Bulk generator: explicit expiry at insert time (same policy).
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
      INSERT INTO public.invites (code, expires_at)
      VALUES (attempt, now() + interval '24 hours');
      inserted := inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      -- collision, try again
    END;
    i := i + 1;
  END LOOP;
  RETURN inserted;
END;
$$;
