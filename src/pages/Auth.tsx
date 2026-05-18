import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  // Pre-fill invite from URL (?invite=BREW-XXXX)
  useEffect(() => {
    const fromUrl = searchParams.get("invite");
    if (fromUrl) setInvite(fromUrl.toUpperCase());
  }, [searchParams]);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else navigate("/");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite.trim()) {
      toast.error("An invite code is required to create an account.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    // If a session was returned (auto-confirm on), redeem immediately.
    if (data.session) {
      const res = await supabase.rpc("redeem_invite", { _code: invite.trim().toUpperCase() });
      setBusy(false);
      const out = res.data as { ok: boolean; error?: string } | null;
      if (res.error || !out?.ok) {
        toast.error(out?.error ?? "Could not redeem invite. You can try again from the next screen.");
      }
      navigate("/");
      return;
    }

    setBusy(false);
    toast.success("Check your inbox to confirm your email, then sign in to redeem your invite.");
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email first.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your inbox for a reset link.");
    setForgotMode(false);
  };

  const handleGoogle = async () => {
    setBusy(true);
    // Redirect to `/` (not `/auth`) so Vercel serves index.html without vercel.json rewrites.
    const redirectUrl = invite.trim()
      ? `${window.location.origin}/?invite=${encodeURIComponent(invite.trim().toUpperCase())}`
      : `${window.location.origin}/`;

    const isLocal =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const brokerUrl = import.meta.env.VITE_LOVABLE_OAUTH_BROKER_URL?.trim();
    const useLovableBroker = isLocal && Boolean(brokerUrl);

    if (useLovableBroker) {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectUrl });
      if (result.error) {
        setBusy(false);
        toast.error(result.error.message || "Could not sign in with Google.");
        return;
      }
      if (result.redirected) return;
      navigate("/");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
    if (error) {
      setBusy(false);
      const msg = error.message ?? "";
      if (
        msg.includes("OAuth secret") ||
        msg.includes("Unsupported provider") ||
        msg.includes("not enabled")
      ) {
        toast.error(
          "Enable Google under Supabase → Authentication → Providers and add your Google OAuth client ID and secret.",
          { duration: 12_000 },
        );
        return;
      }
      toast.error(msg || "Could not sign in with Google.");
      return;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-amber-lg">
            <Coffee className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-cream">Focus Flow</h1>
          <p className="text-sm text-muted-foreground">
            Pull up a chair. Brew a session. Keep the streak alive.
          </p>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-amber">
          <Tabs defaultValue="signin">
            <TabsList className="mb-5 grid w-full grid-cols-2 rounded-xl bg-secondary/60">
              <TabsTrigger value="signin" className="rounded-lg">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {forgotMode ? (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-forgot">Email</Label>
                    <Input id="email-forgot" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border-0 bg-secondary" />
                    <p className="text-xs text-muted-foreground">
                      We'll send a reset link to this address.
                    </p>
                  </div>
                  <Button type="submit" disabled={busy} className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-amber">
                    Send reset link
                  </Button>
                  <button
                    type="button"
                    onClick={() => setForgotMode(false)}
                    className="block w-full text-center text-xs text-muted-foreground hover:text-primary transition"
                  >
                    Back to sign in
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-in">Email</Label>
                    <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border-0 bg-secondary" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pw-in">Password</Label>
                      <button
                        type="button"
                        onClick={() => setForgotMode(true)}
                        className="text-xs text-muted-foreground hover:text-primary transition"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input id="pw-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border-0 bg-secondary" />
                  </div>
                  <Button type="submit" disabled={busy} className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-amber">
                    Sign in
                  </Button>
                </form>
              )}
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-up">Invite code</Label>
                  <Input
                    id="invite-up"
                    required
                    value={invite}
                    onChange={(e) => setInvite(e.target.value.toUpperCase())}
                    placeholder="BREW-XXXX"
                    className="rounded-xl border-0 bg-secondary font-mono tracking-wider"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border-0 bg-secondary" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw-up">Password</Label>
                  <Input id="pw-up" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border-0 bg-secondary" />
                </div>
                <Button type="submit" disabled={busy} className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-amber">
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={handleGoogle}
            className="w-full rounded-xl border-0 bg-secondary text-cream hover:bg-secondary/80"
          >
            Continue with Google
          </Button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            New here? Enter your invite code above before continuing with Google.
          </p>
        </div>
      </div>
    </div>
  );
}
