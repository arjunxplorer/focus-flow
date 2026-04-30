-- Set search_path on the helper that was missing it
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
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

-- Lock down: revoke public/authenticated execute on internal helpers
REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_invite_codes(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_section_limit() FROM PUBLIC, anon, authenticated;

-- redeem_invite stays callable by authenticated users only
REVOKE ALL ON FUNCTION public.redeem_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;