## Plan: Invite codes, section cap, and a 12-week heatmap

Four changes, all aligned with your decisions. Pomodoro-only stays as-is — no manual logging is being added.

&nbsp;

**Issues worth fixing before you run this 🔴**

**1. The 300-user count check is in the wrong place**

sql

```sql
(SELECT count(*) FROM auth.users) > 300
```

`auth.users` is a privileged table. A SECURITY DEFINER function *can* read it, but it's fragile — Supabase occasionally changes `auth` schema access. Better to maintain your own counter:

sql

```sql
-- In invites table, add:
SELECT COUNT(*) FROM invites WHERE used = true > 300
```

This counts redeemed invites, which is exactly what you want, and stays entirely in your `public` schema.

**2. The heatmap grid math has an off-by-one risk**

"7-row × 12-column" = 84 cells. 12 weeks = 84 days exactly — but only if today is a Saturday. If today is Wednesday, the rightmost column is partial (only 4 cells filled, 3 empty future cells). The plan doesn't address how to handle future cells in the current week. They should render as empty/disabled with no tooltip, not as "0h today." Clarify this edge case explicitly before building.

**3. Google OAuth + sessionStorage invite code is fragile**

OAuth redirects can clear `sessionStorage` depending on the browser and whether it's a full redirect vs popup. Specifically Safari and Firefox in private mode will lose it. A safer pattern:

- Store the invite code in the URL as a query param: `/auth?invite=BREW-7K2X`
- After OAuth callback, Supabase returns to your redirect URL — append the invite code to that redirect URL so it survives the round-trip
- Read it from the URL on landing, then call `redeem-invite`

**4. No expiry on invite codes**

Right now codes never expire. For 300 users this is fine, but if someone shares a code publicly you have no way to invalidate it other than manually flipping `used = true` in Supabase. Add a `expires_at timestamptz` column (nullable for now, enforce later) so you have the lever available without a migration later.

**5. The** `redeem_invite` **rejection message leaks information**

If you return distinct errors for "code not found" vs "code already used" vs "user limit reached" — a bad actor can enumerate valid codes. Return a single generic message for all failure cases: *"This invite code is invalid or has already been used."* Only the "you already redeemed one" case can be specific since it's user-scoped.

---

**Minor things worth noting 🟡**

- The plan says "seeds 300 codes in the migration" — make sure you also add a way to generate *more* codes later (a simple SQL function `generate_invite_codes(n int)`) so you're not stuck editing migrations when you want to invite batch #2
- `SECTION_LIMIT_REACHED` using errcode `23505` is wrong — `23505` is the standard Postgres unique violation code. Use a custom errcode like `'P0001'` (raise exception) or your own `'FF001'` so the client can distinguish it from an actual unique constraint violation on section name
- The "invite gate" full-screen component needs a loading state — `inviteRedeemed === null` (still checking) should show a skeleton, not the gate, otherwise every user sees a flash of the gate on load

---

### 1. Invite-code gated signup (cap at 300)

**New table `invites**` (migration):

- `code text primary key` (short, human-friendly, e.g. `BREW-7K2X`)
- `used boolean not null default false`
- `used_by uuid` (the user that redeemed it)
- `used_at timestamptz`
- `created_at timestamptz default now()`
- RLS: no public select. Only the redemption path (a SECURITY DEFINER function) reads/updates rows.

**New edge function `redeem-invite**` (`verify_jwt = true`):

- Input: `{ code: string }`, validated with Zod.
- Uses the caller's JWT to identify `auth.uid()`.
- Wraps the redemption in a SECURITY DEFINER SQL function `public.redeem_invite(_code text, _user uuid)` that:
  1. Locks the row (`SELECT ... FOR UPDATE`).
  2. Rejects if missing, already used, or `_user` already redeemed one.
  3. Also rejects if `(SELECT count(*) FROM auth.users) > 300` as a hard belt-and-braces cap.
  4. Marks `used = true, used_by = _user, used_at = now()`.
- Returns `{ ok: true }` or a clean error.

**Signup flow change in `src/pages/Auth.tsx**`:

- Add an "Invite code" input on the **Create account** tab (also collected before "Continue with Google", stashed in `sessionStorage` so we can redeem after the OAuth round-trip).
- After a successful `signUp` / OAuth callback returns a session, immediately call the `redeem-invite` function.
- If redemption fails: sign the user out, delete the just-created account is not possible from the client — instead we keep the account but block app entry by showing a full-screen "Invite required" gate inside `AppLayout` for any user who has not redeemed. The gate shows a code input that calls `redeem-invite`. This avoids race conditions and fits Supabase's auth model cleanly.
- Track redemption status by a simple `SELECT 1 FROM invites WHERE used_by = auth.uid()` on app load (cached in `AuthContext`).

**Seeding 300 codes**: I'll generate them in the migration with `generate_series` + `gen_random_uuid()` slugified to a readable form, and you can export the list later via a `SELECT code FROM invites WHERE used = false` query. No external sharing is wired in.

---

### 2. Six-section maximum (server + client)

**Server**: Add a `BEFORE INSERT` trigger on `public.sections`:

```text
if (select count(*) from sections where user_id = NEW.user_id) >= 6
  raise exception 'SECTION_LIMIT_REACHED' using errcode = '23505';
```

Surfaces as a Postgres error the client can detect.

**Client (`AppSidebar.tsx`)**:

- When `sections.length >= 6`, replace the "+ New section" button with a disabled item wrapped in a Tooltip: "Maximum 6 sections reached".
- In `addSection()`, catch the `SECTION_LIMIT_REACHED` error and `toast.error("You can have at most 6 sections.")`.

---

### 3. Pomodoro-only — UI clarification only

No code logic changes. Add a small muted line on the Dashboard, under the "By section" header:

> "Hours are counted from completed timer sessions only."

---

### 4. 12-week amber heatmap on Dashboard

**Layout** (matches your sketch):

```text
[ Streak card ]    [ Total hours card ]
[ 12-week heatmap — amber intensity   ]
[ By section breakdown                ]
```

**New component `FocusHeatmap.tsx**`:

- Reads from `focus_sessions` (already loaded in Dashboard) — no new queries needed; we just group `duration_seconds` by local date.
- Renders a 7-row × 12-column grid (rows = Sun→Sat, columns = weeks, oldest left → today right), exactly like GitHub.
- 5 intensity buckets driven by hours that day: `0`, `<0.5h`, `<1h`, `<2h`, `>=2h`, mapping to:
  - empty: `bg-secondary/60`
  - L1: `bg-primary/15`
  - L2: `bg-primary/35`
  - L3: `bg-primary/65`
  - L4: `bg-primary` (full amber, with `shadow-amber`)
- Each cell is a rounded 12px square with `Tooltip` showing date + hours.
- Month labels along the top, "Less / More" legend in the bottom-right.
- Container: `rounded-3xl bg-card p-6 shadow-amber`, header "Last 12 weeks".

**Edge cases**: empty days render as the empty bucket so the grid always looks complete (avoids the "looks sad" problem by being a calm warm-gray field that fills with amber over time).

---

### Technical notes

- Migration: creates `invites` table + RLS + `redeem_invite()` function + sections-limit trigger + seeds 300 codes.
- Edge function: `supabase/functions/redeem-invite/index.ts` with CORS + Zod validation, calls `supabase.rpc('redeem_invite', ...)` using the user-scoped client.
- `AuthContext` gains `inviteRedeemed: boolean | null` and a `refreshInviteStatus()` method; `AppLayout` shows the invite gate when `user && inviteRedeemed === false`.
- Heatmap is pure presentation — uses the `focus_sessions` rows already fetched in `Dashboard.tsx`. I'll lift the existing queries unchanged and add the date-bucketing locally.
- No blue/cool tones introduced. Heatmap uses the existing `--primary` amber ramp via opacity.

Once you approve, I'll run the migration, deploy the edge function, and wire the UI.