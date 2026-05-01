import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Supabase auto-creates a recovery session from the URL hash and fires
    // a PASSWORD_RECOVERY event. We listen for that as our signal of validity.
    const hash = window.location.hash || "";
    const looksLikeRecovery = hash.includes("type=recovery");

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Fallback: if there's no hash at all and no event after a tick, mark invalid.
    const t = setTimeout(() => {
      if (!looksLikeRecovery) {
        setInvalid(true);
      } else {
        // If we saw the hash but no event yet, still allow the form.
        setReady(true);
      }
    }, 600);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    navigate("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-amber-lg">
            <Coffee className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-cream">Set a new password</h1>
          <p className="text-sm text-muted-foreground">
            Choose something memorable. You'll be signed in right after.
          </p>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-amber">
          {invalid && !ready ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or has expired.
              </p>
              <Button
                onClick={() => navigate("/auth")}
                className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-amber"
              >
                Back to sign in
              </Button>
            </div>
          ) : !ready ? (
            <div className="h-32 rounded-2xl shimmer-warm" />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pw-new">New password</Label>
                <Input
                  id="pw-new"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl border-0 bg-secondary"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-confirm">Confirm password</Label>
                <Input
                  id="pw-confirm"
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="rounded-xl border-0 bg-secondary"
                />
              </div>
              {err && <p className="text-xs text-destructive">{err}</p>}
              <Button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-amber"
              >
                Update password
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
