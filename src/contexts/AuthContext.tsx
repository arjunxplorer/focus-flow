import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

  const checkInvite = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setInviteRedeemed(null);
      return;
    }
    setInviteRedeemed(null);
    const { data, error } = await supabase
      .from("invites")
      .select("code")
      .eq("used_by", userId)
      .maybeSingle();
    if (error) {
      setInviteRedeemed(false);
      return;
    }
    setInviteRedeemed(!!data);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
      // Defer to avoid deadlocks
      setTimeout(() => checkInvite(newSession?.user?.id), 0);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setLoading(false);
      checkInvite(existing?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, [checkInvite]);

  const refreshInviteStatus = useCallback(async () => {
    await checkInvite(session?.user?.id);
  }, [checkInvite, session]);

  const signOut = async () => {
    await supabase.auth.signOut();
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
