import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Check your inbox to confirm your email.");
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Could not sign in with Google.");
      return;
    }
    if (result.redirected) return;
    navigate("/");
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
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email-in">Email</Label>
                  <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border-0 bg-secondary" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw-in">Password</Label>
                  <Input id="pw-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border-0 bg-secondary" />
                </div>
                <Button type="submit" disabled={busy} className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-amber">
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
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
        </div>
      </div>
    </div>
  );
}
