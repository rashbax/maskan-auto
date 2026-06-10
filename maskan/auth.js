"use client";
// Auth helpers (browser). Uses a single Supabase client instance so the
// auth listener and session stay consistent across the app.
import { createClient } from "../lib/supabase/client";

let _sb;
export function sb() {
  return (_sb ||= createClient());
}

// Map a Supabase user into the small shape the UI expects ({ provider, name, handle }).
export function mapUser(u) {
  if (!u) return null;
  const m = u.user_metadata || {};
  const provider = u.app_metadata?.provider || "email";
  const name = m.full_name || m.name || (u.email ? u.email.split("@")[0] : "Mehmon");
  return {
    id: u.id,
    provider,
    name,
    handle: u.email || m.user_name || "",
    avatar: m.avatar_url || null,
  };
}

export async function signInWithGoogle() {
  return sb().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  return sb().auth.signOut();
}
