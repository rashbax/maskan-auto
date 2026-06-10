# Maskan — Supabase setup

One-time setup to connect the app to a real database. ~5 minutes.

## 1. Create a free project
1. Go to [supabase.com](https://supabase.com) → **New project** (free plan).
2. Region: choose **EU Central (Frankfurt)** — lowest latency for Uzbekistan.
3. Set a strong database password (save it).

## 2. Copy the keys
Project → **Settings → API**. Copy three values:
- **Project URL**
- **anon public** key
- **service_role** key (secret)

Create a `.env.local` file in the project root (copy from `.env.example`) and paste them:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
`.env.local` is git-ignored — never commit it.

## 3. Create the tables
Project → **SQL Editor → New query**:
1. Paste all of `supabase/migrations/0001_init.sql` → **Run**.
2. Paste all of `supabase/seed.sql` → **Run**.

You should now see 6 apartments under **Table editor → apartments**.

## 4. Make yourself an admin (after first sign-in)
Sign in once through the app (Telegram/Google) so your profile row is created, then in SQL Editor:
```sql
update public.profiles set role = 'admin' where id = (
  select id from auth.users order by created_at desc limit 1
);
```

## 5. Tell the assistant
Once the keys are in `.env.local` and the SQL has run, say so (or paste the **Project URL + anon key**). The app will then be switched from mock data to live Supabase, and we'll test bookings, favorites, and reviews end-to-end.

---

### Alternative: Supabase CLI
If you prefer the CLI: `supabase link --project-ref <ref>` then `supabase db push` (applies migrations) — but the SQL Editor steps above are the simplest.
