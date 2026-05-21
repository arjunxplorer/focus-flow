import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import {
  isAuthError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  type Session,
  type User,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface CheckInviteOptions {
  /** Show the app-wide loader while checking (first load or new user). */
  resetLoading?: boolean;
  /** Re-query even if this user was already checked (e.g. after redeeming an invite). */
  force?: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  inviteRedeemed: boolean | null; // null = checking
  refreshInviteStatus: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteRedeemed, setInviteRedeemed] = useState<boolean | null>(null);
  const inviteCheckedForUserId = useRef<string | null>(null);
  const inviteCheckInFlight = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const verifyInFlight = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const checkInvite = useCallback(async (
    userId: string | undefined,
    { resetLoading = true, force = false }: CheckInviteOptions = {},
  ) => {
    if (!userId) {
      inviteCheckedForUserId.current = null;
      inviteCheckInFlight.current = null;
      setInviteRedeemed(null);
      return;
    }

    if (!force && inviteCheckedForUserId.current === userId) return;
    if (!force && inviteCheckInFlight.current === userId) return;

    const isNewUser = inviteCheckedForUserId.current !== userId;
    inviteCheckInFlight.current = userId;
    if (resetLoading || isNewUser) setInviteRedeemed(null);

    try {
      const { data, error } = await supabase
        .from("invites")
        .select("code")
        .eq("used_by", userId)
        .maybeSingle();
      if (error) {
        console.error("invite check failed:", error);
        inviteCheckedForUserId.current = userId;
        setInviteRedeemed(false);
        return;
      }
      inviteCheckedForUserId.current = userId;
      setInviteRedeemed(!!data);
    } catch (err) {
      console.error("invite check failed:", err);
      inviteCheckedForUserId.current = userId;
      setInviteRedeemed(false);
    } finally {
      if (inviteCheckInFlight.current === userId) {
        inviteCheckInFlight.current = null;
      }
    }
  }, []);

  /** Server-side JWT check on tab focus — no loaders, no state churn for valid sessions. */
  const verifySessionWithServer = useCallback(async () => {
    if (!sessionRef.current?.user || verifyInFlight.current) return;

    verifyInFlight.current = true;
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        if (isAuthRetryableFetchError(error)) return;
        // Session missing: getUser() already clears storage and emits SIGNED_OUT.
        if (isAuthSessionMissingError(error)) return;
        if (isAuthError(error)) await supabase.auth.signOut();
        return;
      }

      if (!user) {
        if (sessionRef.current) await supabase.auth.signOut();
        return;
      }

      // Same user — leave React session as-is to avoid refetch/flash cascades.
      if (sessionRef.current.user.id === user.id) return;

      // Different user (rare): sync session without invite/loading UI.
      const { data: { session: refreshed } } = await supabase.auth.getSession();
      setSession(refreshed);
      void checkInvite(user.id, { resetLoading: false, force: true });
    } catch (err) {
      if (isAuthRetryableFetchError(err)) return;
      console.error("background session verify failed:", err);
    } finally {
      verifyInFlight.current = false;
    }
  }, [checkInvite]);

  // After Google OAuth, redeem invite from ?invite= on `/` (avoids /auth 404 on Vercel without rewrites).
  useEffect(() => {
    if (!session?.user) return;
    const code = new URLSearchParams(window.location.search).get("invite");
    if (!code?.trim()) return;

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc("redeem_invite", {
        _code: code.trim().toUpperCase(),
      });
      if (cancelled) return;
      const out = data as { ok: boolean } | null;
      if (!error && out?.ok) {
        await checkInvite(session.user.id, { resetLoading: false, force: true });
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user, checkInvite]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setLoading(false);

      if (event === "SIGNED_OUT") {
        setSession(null);
        void checkInvite(undefined);
        return;
      }

      // Tab focus recovery refreshes the token without changing the user.
      if (event === "TOKEN_REFRESHED") return;

      setSession((prev) => {
        const nextUserId = newSession?.user?.id;
        if (!nextUserId) return newSession;
        if (event === "USER_UPDATED") return newSession;
        if (prev?.user?.id === nextUserId) return prev;
        return newSession;
      });

      const userId = newSession?.user?.id;
      if (!userId) {
        void checkInvite(undefined);
        return;
      }

      // Defer to avoid deadlocks. Skip if already verified (tab focus fires SIGNED_IN).
      setTimeout(() => {
        void checkInvite(userId, { resetLoading: false });
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setLoading(false);
      void checkInvite(existing?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, [checkInvite]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void verifySessionWithServer();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [verifySessionWithServer]);

  const refreshInviteStatus = useCallback(async () => {
    await checkInvite(session?.user?.id, { resetLoading: false, force: true });
  }, [checkInvite, session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    inviteCheckedForUserId.current = null;
    inviteCheckInFlight.current = null;
    setInviteRedeemed(null);
  };

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      session,
      loading,
      inviteRedeemed,
      refreshInviteStatus,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
