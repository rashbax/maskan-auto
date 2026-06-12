import { createClient } from "@supabase/supabase-js";

// Cookieless anon client for PUBLIC, session-independent reads (apartment pages, sitemap).
// No cookies() → the route stays statically prerenderable + ISR-cacheable. RLS still applies.
export const publicDb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
