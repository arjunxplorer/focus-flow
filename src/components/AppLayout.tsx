import { ReactNode, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ActiveTimerBanner } from "./ActiveTimerBanner";
import { InviteGate } from "./InviteGate";

export function AppLayout({ children }: { children?: ReactNode }) {
  const { user, loading, inviteRedeemed } = useAuth();
  useRealtimeSync();
  const location = useLocation();
  const [inviteCheckTimedOut, setInviteCheckTimedOut] = useState(false);

  useEffect(() => {
    if (!user || inviteRedeemed !== null) {
      setInviteCheckTimedOut(false);
      return;
    }
    const id = window.setTimeout(() => setInviteCheckTimedOut(true), 8_000);
    return () => window.clearTimeout(id);
  }, [user, inviteRedeemed]);

  const waitingOnInvite = user && inviteRedeemed === null && !inviteCheckTimedOut;

  if (loading || waitingOnInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary/30" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (inviteRedeemed === false) {
    return <InviteGate />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-2 px-4">
            <SidebarTrigger className="rounded-xl text-muted-foreground hover:text-cream" />
          </header>
          <ActiveTimerBanner />
          <main className="flex-1 px-6 pb-10 pt-2 md:px-8">
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
