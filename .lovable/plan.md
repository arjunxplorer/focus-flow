# Focus Flow — Pomodoro Time-Tracker

A warm, dimly-lit Pomodoro app for focused study sessions. Per-task custom durations, sections (categories), streak tracking, and a dashboard — all synced to your account via Lovable Cloud.

## Visual Design System

**Palette** (set as HSL tokens in `index.css`)
- Background `#1a1410` · Surface `#2a2118` · Surface raised `#332a1e`
- Primary amber `#f59e0b` · Amber deep `#d97706`
- Text cream `#fef3c7` · Muted warm gray for secondary text
- No blues, no cool tones anywhere

**Type**: Inter, loaded from Google Fonts. Body line-height ~1.6.

**Shape & motion**
- Border radius 16–20px on cards, buttons, inputs
- Shadow: `0 4px 24px rgba(245,158,11,0.08)` on cards; intensified glow on the active timer banner
- Hover/focus transitions: 150ms ease, background-color shifts (no harsh borders)
- Shimmer skeletons in warm amber tones

## App Shell

```text
┌────────────┬────────────────────────────────────────┐
│            │  [Active timer banner — when running]  │
│  SIDEBAR   ├────────────────────────────────────────┤
│            │                                        │
│ Focus Flow │             MAIN AREA                  │
│            │       (Tasks  or  Dashboard)           │
│ — Nav —    │                                        │
│ Tasks      │                                        │
│ Dashboard  │                                        │
│            │                                        │
│ — Sections│                                        │
│ • Reading  │                                        │
│ • Coding   │                                        │
│ + New      │                                        │
│            │                                        │
│ avatar ⏻  │                                        │
└────────────┴────────────────────────────────────────┘
```

- **Sidebar** (shadcn Sidebar, collapsible to icon strip): Tasks / Dashboard nav, then a "Sections" group listing user-created study categories with a "+ New section" action. Selecting a section filters the task list. Footer shows user avatar + sign out.
- **Top banner**: only renders when a timer is active. Sticky across both pages, shows task title + live countdown + quick pause/stop, with a soft amber glow pulse.

## Pages

### Tasks
- Header: page title, section filter chip, "+ New task" button.
- Task cards (heavily rounded, surface bg, amber-tinted shadow):
  - Title · section tag · duration badge (e.g. `25 min`)
  - Right side: ▶ Start timer · ✓ Complete · 🗑 Delete
  - Completed tasks render muted with strikethrough title
- New task dialog: title, section (select), duration (15 / 25 / 45 / 60 + custom minutes).
- **Empty state**: warm illustration vibe (coffee cup glyph in amber), copy like "No tasks yet — brew your first focus session."
- **Loading**: skeleton cards with warm amber shimmer.

### Timer view (opens when ▶ pressed, or via banner click)
- Large circular countdown SVG, amber ring depleting against a muted track
- Task title + section underneath
- Controls: Start / Pause / Reset · "Mark complete" finishes early and counts toward streak
- On natural completion: task auto-marks complete, soft toast, returns to list

### Dashboard
- **Streak card**: 🔥 flame icon + "X day streak" (any completed task today extends streak)
- **Total hours card**: cumulative focus hours
- **Per-section breakdown**: list of sections with hours and a slim amber progress bar (relative to top section)
- All cards use the same rounded surface + amber-tint shadow language

## States Checklist
- Empty (no tasks, no sections, no history on dashboard)
- Active timer (banner glow, ring animating)
- Completed task (muted + strikethrough)
- Loading skeletons (warm shimmer)
- Auth: sign-in / sign-up screens in the same café aesthetic

## Auth & Data (Lovable Cloud)

Email/password + Google sign-in. Auth pages styled to match.

**Tables** (all RLS-protected to `auth.uid() = user_id`)
- `profiles` — id (→ auth.users), display_name, created_at; auto-created via trigger on signup
- `sections` — id, user_id, name, color_hint, created_at
- `tasks` — id, user_id, section_id (nullable), title, duration_minutes, completed, completed_at, created_at
- `focus_sessions` — id, user_id, task_id, started_at, ended_at, duration_seconds, completed (bool) — powers dashboard hours + streak

Streak = count of consecutive days (ending today or yesterday) with ≥1 row in `tasks` where `completed_at::date = day`.

## Technical Notes
- React + Vite + Tailwind + shadcn/ui (existing stack)
- Routes: `/auth`, `/` (Tasks), `/dashboard`, `/timer/:taskId`; protected by a session guard
- Global timer state via a `TimerProvider` context so the banner persists across route changes; uses `requestAnimationFrame`/interval with `Date.now()` anchoring so it stays accurate if the tab is backgrounded
- Design tokens defined as HSL CSS variables; Tailwind config extended with `cafe.bg`, `cafe.surface`, `cafe.amber`, `cafe.cream`, etc., plus a custom `shadow-amber` and `animate-warm-shimmer`
- Inter loaded via `<link>` in `index.html`; base body styles updated in `index.css`
- Supabase client + `useAuth` hook with `onAuthStateChange` listener set up before `getSession`

## Out of Scope
Anything not in the brief: no breaks/long-break cycle, no notifications, no sounds, no sharing, no theming toggle, no tags beyond sections.