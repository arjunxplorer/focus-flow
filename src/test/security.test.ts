import { describe, it, expect } from "vitest";
import { readRepoFile, listMigrationSql, listSourceFiles } from "./security-helpers";

const migrations = listMigrationSql();
const appSource = listSourceFiles().join("\n");
const gitignore = readRepoFile(".gitignore");
const envExample = readRepoFile(".env.example");

const USER_TABLES = ["profiles", "sections", "tasks", "focus_sessions", "invites"];

describe("security: secrets and client exposure", () => {
  it("does not embed service role or other server-only keys in source", () => {
    const forbidden = [
      /service_role/i,
      /SUPABASE_SERVICE_ROLE/,
      /sb_secret_/,
      /sk_live_/,
      /BEGIN (RSA |EC )?PRIVATE KEY/,
    ];
    for (const pattern of forbidden) {
      expect(appSource).not.toMatch(pattern);
    }
  });

  it("uses only Vite-prefixed public Supabase env vars in the client", () => {
    const client = readRepoFile("src/integrations/supabase/client.ts");
    expect(client).toMatch(/import\.meta\.env\.VITE_SUPABASE_URL/);
    expect(client).toMatch(/import\.meta\.env\.VITE_SUPABASE_PUBLISHABLE_KEY/);
    expect(client).not.toMatch(/import\.meta\.env\.(?!VITE_)/);
  });

  it("documents required env vars in .env.example without real secrets", () => {
    expect(envExample).toContain("VITE_SUPABASE_URL");
    expect(envExample).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(envExample).not.toMatch(/sb_publishable_[A-Za-z0-9_-]{10,}/);
    expect(envExample).not.toMatch(/lerpbahnaamzwwkbrpdo/);
  });

  it("ignores .env from version control", () => {
    expect(gitignore).toMatch(/(^|\n)\.env(\n|$)/);
  });
});

describe("security: database RLS and privileged functions", () => {
  it("enables RLS on every user-data table", () => {
    for (const table of USER_TABLES) {
      expect(migrations).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"),
      );
    }
  });

  it("scopes row access to auth.uid() for core tables", () => {
    expect(migrations).toMatch(/auth\.uid\(\)\s*=\s*user_id/);
    expect(migrations).toMatch(/auth\.uid\(\)\s*=\s*id/);
  });

  it("does not expose invite codes via broad SELECT policies", () => {
    expect(migrations).not.toMatch(
      /ON public\.invites FOR SELECT[\s\S]*?USING\s*\(\s*true\s*\)/i,
    );
    expect(migrations).toMatch(/used_by\s*=\s*auth\.uid\(\)/);
  });

  it("locks down invite code generation to admins only (no authenticated execute)", () => {
    expect(migrations).toMatch(
      /REVOKE ALL ON FUNCTION public\.generate_invite_codes\(int\) FROM PUBLIC, anon, authenticated/i,
    );
    expect(migrations).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.generate_invite_codes/i,
    );
  });

  it("allows only authenticated users to call redeem_invite", () => {
    expect(migrations).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.redeem_invite\(text\) TO authenticated/i,
    );
    expect(migrations).toMatch(
      /REVOKE ALL ON FUNCTION public\.redeem_invite\(text\) FROM PUBLIC, anon/i,
    );
  });

  it("implements redeem_invite as SECURITY DEFINER with fixed search_path", () => {
    expect(migrations).toMatch(
      /CREATE OR REPLACE FUNCTION public\.redeem_invite[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = public/i,
    );
  });

  it("uses row locking and generic failure messages for invite redemption", () => {
    expect(migrations).toMatch(/FOR UPDATE/);
    expect(migrations).toMatch(
      /invalid or has already been used/i,
    );
  });

  it("caps focus session duration server-side", () => {
    expect(migrations).toMatch(/enforce_focus_session_bounds/i);
  });

  it("rate-limits invite redemption attempts per user", () => {
    expect(migrations).toMatch(/invite_redeem_attempts/i);
    expect(migrations).toMatch(/too many attempts/i);
  });

  it("enforces invite redemption in RLS for user data writes", () => {
    expect(migrations).toMatch(/user_has_redeemed_invite/i);
    expect(migrations).toMatch(
      /user_has_redeemed_invite\(\)[\s\S]*sections/i,
    );
    expect(migrations).toMatch(
      /user_has_redeemed_invite\(\)[\s\S]*tasks/i,
    );
    expect(migrations).toMatch(
      /user_has_redeemed_invite\(\)[\s\S]*focus_sessions/i,
    );
  });

  it("validates task section_id belongs to the same user", () => {
    expect(migrations).toMatch(
      /section_id IN \(SELECT id FROM public\.sections WHERE user_id = auth\.uid\(\)\)/i,
    );
  });
});

describe("security: SQL audit expectations (migration review)", () => {
  it("documents user_has_redeemed_invite as SECURITY DEFINER callable by authenticated for RLS", () => {
    expect(migrations).toMatch(
      /CREATE OR REPLACE FUNCTION public\.user_has_redeemed_invite[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = public/i,
    );
    expect(migrations).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.user_has_redeemed_invite\(\) TO authenticated/i,
    );
    expect(migrations).toMatch(
      /REVOKE ALL ON FUNCTION public\.user_has_redeemed_invite\(\) FROM PUBLIC, anon/i,
    );
  });

  it("keeps invite_redeem_attempts without client-facing policies", () => {
    expect(migrations).toMatch(/invite_redeem_attempts/i);
    expect(migrations).not.toMatch(
      /ON public\.invite_redeem_attempts FOR (INSERT|UPDATE|DELETE|SELECT)/i,
    );
  });
});

describe("security: hosting headers", () => {
  it("sets CSP and related headers in vercel.json", () => {
    const vercel = readRepoFile("vercel.json");
    expect(vercel).toMatch(/Content-Security-Policy/i);
    expect(vercel).toMatch(/X-Frame-Options/i);
    expect(vercel).toMatch(/X-Content-Type-Options/i);
    expect(vercel).toMatch(/Referrer-Policy/i);
    expect(vercel).toMatch(/frame-ancestors 'none'/i);
  });
});

describe("security: application access control", () => {
  it("routes protected screens through AppLayout auth + invite gate", () => {
    const layout = readRepoFile("src/components/AppLayout.tsx");
    expect(layout).toMatch(/if \(!user\)/);
    expect(layout).toMatch(/inviteRedeemed === false/);
    expect(layout).toMatch(/InviteGate/);
  });

  it("requires invite code before email signup", () => {
    const auth = readRepoFile("src/pages/Auth.tsx");
    expect(auth).toMatch(/An invite code is required/);
    expect(auth).toMatch(/redeem_invite/);
  });

  it("enforces minimum password length on signup and reset", () => {
    const auth = readRepoFile("src/pages/Auth.tsx");
    const reset = readRepoFile("src/pages/ResetPassword.tsx");
    expect(auth).toMatch(/minLength=\{8\}/);
    expect(reset).toMatch(/password\.length < 8/);
  });

  it("does not use dangerouslySetInnerHTML with user-controlled data", () => {
    const chart = readRepoFile("src/components/ui/chart.tsx");
    expect(chart).toMatch(/dangerouslySetInnerHTML/);
    expect(appSource).not.toMatch(/dangerouslySetInnerHTML\s*=\s*\{\{\s*__html:\s*[^}]*user/i);
  });

  it("renders user content via JSX text, not raw HTML", () => {
    const tasks = readRepoFile("src/pages/Tasks.tsx");
    expect(tasks).toMatch(/\{task\.title\}/);
    expect(tasks).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("does not reflect invite query param into innerHTML", () => {
    const authCtx = readRepoFile("src/contexts/AuthContext.tsx");
    expect(authCtx).not.toMatch(/dangerouslySetInnerHTML/);
    expect(authCtx).toMatch(/URLSearchParams[\s\S]*\.get\(["']invite["']\)/);
  });
});
