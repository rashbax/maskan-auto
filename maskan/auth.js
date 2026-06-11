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
  // magic-link sign-in reports provider "email"; detect Telegram by the id we stored instead
  const isTelegram = !!m.telegram_id;
  const provider = isTelegram ? "telegram" : (u.app_metadata?.provider || "email");
  const name = m.full_name || m.name || (u.email ? u.email.split("@")[0] : "Mehmon");
  // show @username for Telegram (the synthetic tg…@telegram.maskan email is internal only)
  const handle = isTelegram ? (m.user_name ? "@" + m.user_name : name) : (u.email || "");
  return {
    id: u.id,
    provider,
    name,
    handle,
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

// Telegram login is handled by the bot-nonce flow in TelegramLoginButton (maskan/telegram-button.jsx)
// + /api/auth/telegram/{start,poll} + the bot webhook — not from here.
