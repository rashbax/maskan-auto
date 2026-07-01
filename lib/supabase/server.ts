import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cookie-backed Supabase client for Route Handlers. Reads the auth session from cookies and,
// when getUser() refreshes an expired-but-valid token, writes the new session back via setAll
// (a Route Handler can set cookies, so no middleware is needed to persist the refresh).
// NOTE: only used from Route Handlers today (there are no auth-gated Server Components). If you
// ever call this during a Server Component render, setAll can't write cookies there — you'd need
// a middleware token-refresh (the standard @supabase/ssr pattern) for the session to survive.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Cookie writes throw only during a Server Component render. This client is called
            // from Route Handlers (where setAll works), so this branch is not expected to run;
            // it's a guard so a stray SSR call degrades to a stale-but-readable session instead
            // of throwing. See the note on createClient above if you add auth-gated SSR pages.
          }
        },
      },
    },
  );
}
