# Maskan

Multilingual (UZ / RU / EN) daily-rental catalog + booking app for Tashkent. Guests browse apartments, see real-time availability, and book instantly; the owner manages everything from an admin panel and gets a Telegram alert on every booking.

## Stack
- **Next.js 16** (App Router) + **React 19** + **Tailwind v4** — fonts: Manrope (sans) + Spectral (serif)
- **Supabase** — Postgres + RLS + Auth
- **Telegram bot** — owner booking notifications (server Route Handler)
- Images planned on **Cloudflare R2**; maps planned on **Yandex Maps**

## Local development
```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```
- App: `/` · Design system: `/design-system` · Admin: discreet button (real admin will live on a subdomain)

### Environment (`.env.local`)
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public client (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin tasks (never exposed to the browser) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_OWNER_CHAT_ID` | Owner booking notifications |

## Database
Run the SQL in `supabase/` against your project (SQL Editor), in order:
1. `migrations/0001_init.sql` — tables + RLS + signup trigger
2. `seed.sql` — sample apartments / reviews / bookings
3. `migrations/0002_busy.sql` — public availability RPC
4. `migrations/0003_security.sql` — security hardening (role lock, private address, booking-overlap guard, review eligibility)

## Scripts
- `npm run dev` / `build` / `start`
- `npm run typecheck` — `tsc --noEmit`
- `npm run check:data` — verifies the live Supabase data path
- `scripts/*.mjs` — dev verification helpers (run with `node --env-file=.env.local`)

## Structure
- `app/` — routes, layout, global CSS (design tokens via `@theme`), API route handlers
- `maskan/` — UI components + screens (catalog, detail, booking, admin, …) + data layer (`db.js`)
- `lib/supabase/` — browser / server / admin clients
- `supabase/` — SQL migrations + seed

## Deploy
Vercel (this repo) + Supabase + Cloudflare R2. Set the env vars above in the Vercel project settings.
