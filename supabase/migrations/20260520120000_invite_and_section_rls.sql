-- Enforce invite redemption and section ownership at the database layer (F1, F2).

CREATE OR REPLACE FUNCTION public.user_has_redeemed_invite()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invites
    WHERE used_by = auth.uid() AND used = true
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_redeemed_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_redeemed_invite() TO authenticated;

-- Sections: require redeemed invite for all operations.
DROP POLICY IF EXISTS "Users manage own sections select" ON public.sections;
DROP POLICY IF EXISTS "Users manage own sections insert" ON public.sections;
DROP POLICY IF EXISTS "Users manage own sections update" ON public.sections;
DROP POLICY IF EXISTS "Users manage own sections delete" ON public.sections;

CREATE POLICY "Users manage own sections select" ON public.sections
  FOR SELECT USING (auth.uid() = user_id AND public.user_has_redeemed_invite());

CREATE POLICY "Users manage own sections insert" ON public.sections
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.user_has_redeemed_invite());

CREATE POLICY "Users manage own sections update" ON public.sections
  FOR UPDATE USING (auth.uid() = user_id AND public.user_has_redeemed_invite());

CREATE POLICY "Users manage own sections delete" ON public.sections
  FOR DELETE USING (auth.uid() = user_id AND public.user_has_redeemed_invite());

-- Tasks: invite required; section_id must belong to the same user (or be null).
DROP POLICY IF EXISTS "Users tasks select" ON public.tasks;
DROP POLICY IF EXISTS "Users tasks insert" ON public.tasks;
DROP POLICY IF EXISTS "Users tasks update" ON public.tasks;
DROP POLICY IF EXISTS "Users tasks delete" ON public.tasks;

CREATE POLICY "Users tasks select" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id AND public.user_has_redeemed_invite());

CREATE POLICY "Users tasks insert" ON public.tasks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.user_has_redeemed_invite()
    AND (
      section_id IS NULL
      OR section_id IN (SELECT id FROM public.sections WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users tasks update" ON public.tasks
  FOR UPDATE
  USING (auth.uid() = user_id AND public.user_has_redeemed_invite())
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_has_redeemed_invite()
    AND (
      section_id IS NULL
      OR section_id IN (SELECT id FROM public.sections WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users tasks delete" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id AND public.user_has_redeemed_invite());

-- Focus sessions: require redeemed invite.
DROP POLICY IF EXISTS "Users sessions select" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users sessions insert" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users sessions update" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users sessions delete" ON public.focus_sessions;

CREATE POLICY "Users sessions select" ON public.focus_sessions
  FOR SELECT USING (auth.uid() = user_id AND public.user_has_redeemed_invite());

CREATE POLICY "Users sessions insert" ON public.focus_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.user_has_redeemed_invite());

CREATE POLICY "Users sessions update" ON public.focus_sessions
  FOR UPDATE USING (auth.uid() = user_id AND public.user_has_redeemed_invite());

CREATE POLICY "Users sessions delete" ON public.focus_sessions
  FOR DELETE USING (auth.uid() = user_id AND public.user_has_redeemed_invite());
