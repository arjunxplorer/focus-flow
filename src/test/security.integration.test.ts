/**
 * Staging integration tests for RLS and access control.
 * Skipped unless SECURITY_TEST_* env vars are set (see docs/SECURITY.md).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const url = process.env.SECURITY_TEST_URL?.trim();
const anonKey = process.env.SECURITY_TEST_ANON_KEY?.trim();
const userAEmail = process.env.SECURITY_TEST_USER_A_EMAIL?.trim();
const userAPassword = process.env.SECURITY_TEST_USER_A_PASSWORD?.trim();
const userBEmail = process.env.SECURITY_TEST_USER_B_EMAIL?.trim();
const userBPassword = process.env.SECURITY_TEST_USER_B_PASSWORD?.trim();

const integrationEnabled = Boolean(
  url && anonKey && userAEmail && userAPassword && userBEmail && userBPassword,
);

async function signIn(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<User> {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(error?.message ?? "sign-in failed");
  return data.user;
}

describe.skipIf(!integrationEnabled)("security integration: access control", () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let userA: User;
  let userB: User;
  let taskBId: string | undefined;
  let sectionBId: string | undefined;

  beforeAll(async () => {
    clientA = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clientB = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    userA = await signIn(clientA, userAEmail!, userAPassword!);
    userB = await signIn(clientB, userBEmail!, userBPassword!);

    const { data: sections } = await clientB
      .from("sections")
      .select("id")
      .limit(1);
    sectionBId = sections?.[0]?.id;

    if (sectionBId) {
      const { data: task } = await clientB
        .from("tasks")
        .insert({
          user_id: userB.id,
          title: "security-test-task-b",
          section_id: sectionBId,
          duration_minutes: 25,
        })
        .select("id")
        .single();
      taskBId = task?.id;
    }
  }, 30_000);

  it("User A cannot read User B tasks by id (IDOR)", async () => {
    if (!taskBId) return;
    const { data } = await clientA.from("tasks").select("*").eq("id", taskBId);
    expect(data ?? []).toHaveLength(0);
  });

  it("User A cannot update User B tasks (IDOR)", async () => {
    if (!taskBId) return;
    const { data } = await clientA
      .from("tasks")
      .update({ title: "hacked" })
      .eq("id", taskBId)
      .select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("User A cannot attach a task to User B section (section_id cross-attach)", async () => {
    if (!sectionBId) return;
    const { error } = await clientA.from("tasks").insert({
      user_id: userA.id,
      title: "cross-section-attack",
      section_id: sectionBId,
      duration_minutes: 25,
    });
    expect(error).toBeTruthy();
  });

  it("rejects focus session duration above server cap", async () => {
    const { error } = await clientA.from("focus_sessions").insert({
      user_id: userA.id,
      duration_seconds: 999_999,
      completed: true,
      ended_at: new Date().toISOString(),
    });
    expect(error).toBeTruthy();
  });

  it("anon client cannot read tasks without JWT", async () => {
    const anon = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.from("tasks").select("id").limit(1);
    expect(error ?? data ?? []).toBeTruthy();
    if (!error) expect(data).toHaveLength(0);
  });
});

describe.skipIf(!integrationEnabled)(
  "security integration: invite bypass (no-invite user)",
  () => {
    const noInviteEmail = process.env.SECURITY_TEST_NO_INVITE_EMAIL?.trim();
    const noInvitePassword = process.env.SECURITY_TEST_NO_INVITE_PASSWORD?.trim();
    const skip = !noInviteEmail || !noInvitePassword;

    it.skipIf(skip)(
      "authenticated user without redeemed invite cannot insert tasks",
      async () => {
        const client = createClient(url!, anonKey!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const user = await signIn(client, noInviteEmail!, noInvitePassword!);

        const { data: invite } = await client
          .from("invites")
          .select("used_by")
          .eq("used_by", user.id)
          .maybeSingle();

        if (invite) return; // user already has invite; skip

        const { error } = await client.from("tasks").insert({
          user_id: user.id,
          title: "invite-bypass-probe",
          duration_minutes: 25,
        });
        expect(error).toBeTruthy();
      },
      20_000,
    );
  },
);
