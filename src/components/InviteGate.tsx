import { useState } from "react";
import { Coffee, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function InviteGate() {
  const { user, signOut, refreshInviteStatus } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_invite", {
      _code: code.trim().toUpperCase(),
    });
    setBusy(false);
    if (error) {
      toast.error("Could not redeem code. Please try again.");
      return;
    }
    const result = data as { ok: boolean; error?: string } | null;
    if (result?.ok) {
      toast.success("You're in. Welcome to the café.");
      await refreshInviteStatus();
    } else {
      toast.error(result?.error ?? "This invite code is invalid or has already been used.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-amber-lg">
            <Coffee className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-cream">Invite required</h1>
          <p className="text-sm text-muted-foreground">
            Focus Flow is in a small early access group. Enter your invite code to take a seat.
          </p>
        </div>

        <form onSubmit={submit} className="rounded-3xl bg-card p-6 shadow-amber space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-code">Invite code</Label>
            <Input
              id="invite-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BREW-XXXX"
              className="rounded-xl border-0 bg-secondary font-mono tracking-wider"
            />
          </div>
          <Button
            type="submit"
            disabled={busy || !code.trim()}
            className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-amber"
          >
            Redeem
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">Signed in as {user?.email}</span>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:text-cream transition"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
