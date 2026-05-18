# Supabase CLI

Use this after you create a **new** project in the [Supabase dashboard](https://supabase.com/dashboard).

## One-time: CLI login

```bash
npm run supabase login
```

Opens the browser to authenticate the CLI to your Supabase account.

## Link this repo to your project

Your **project ref** is the subdomain in the dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`.

Use the **database password** you chose when creating the project (Settings → Database → reset if you forgot).

```bash
npm run db:link -- --project-ref YOUR_PROJECT_REF -p 'YOUR_DATABASE_PASSWORD'
```

This writes link state under `supabase/` (ignored by git). It does **not** change your app `.env`; do that separately with the project **URL** and **anon** key from **Settings → API**.

## Apply migrations to the remote database

```bash
npm run db:push
```

Runs everything in `supabase/migrations/` in order. Use `npm run db:push:dry` to preview.

## Authentication (required for this app)

Migrations only set up the database. **Auth providers** are configured in the dashboard:

- **Email** — Under **Authentication → Providers**, ensure **Email** is enabled (default on most projects). Use the **Sign in** tab with email + password.
- **Google** — If you use **Continue with Google** from localhost with direct Supabase OAuth, enable **Google** under **Authentication → Providers**, add **Client ID** and **Client secret** from [Google Cloud Console](https://console.cloud.google.com/apis/credentials), and add this **Authorized redirect URI** on the OAuth client: `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`. Also add your app URLs under **Authentication → URL configuration** (e.g. `http://localhost:8080`).

If Google is disabled or incomplete, sign-in with Google returns errors like `provider is not enabled`.

## Regenerate TypeScript types (optional)

After `db:push`, if you change the schema:

```bash
npm run db:types
```

## Local Postgres version

If `db:push` complains about Postgres version, open `supabase/config.toml`, find `[db]`, and set `major_version` to match **Settings → Database** for your project (for example `15` or `17`).
