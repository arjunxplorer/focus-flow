-- RLS policies call user_has_redeemed_invite(); authenticated users need EXECUTE.
-- (SECURITY DEFINER still runs the function as owner; only invocation requires grant.)

GRANT EXECUTE ON FUNCTION public.user_has_redeemed_invite() TO authenticated;
