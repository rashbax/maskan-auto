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

// ---------- Telegram login (widget -> /api/auth/telegram -> Supabase session) ----------
const TG_BOT_ID = "8834021236";

function telegramAuth() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    // never leave the caller pending forever if Telegram never completes the popup
    const timer = setTimeout(() => finish(null), 90000);
    // no request_access: we only need to identify the user, not DM them from the bot
    const trigger = () => window.Telegram.Login.auth({ bot_id: TG_BOT_ID }, (data) => finish(data || null));
    if (window.Telegram?.Login) return trigger();
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.onload = trigger;
    s.onerror = () => finish(null);
    document.body.appendChild(s);
  });
}

export async function signInWithTelegram() {
  const data = await telegramAuth();
  if (!data) return { error: "cancelled" };
  const res = await fetch("/api/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, redirectTo: window.location.origin }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok && j.url) {
    window.location.href = j.url; // Supabase verifies + redirects back signed-in
    return {};
  }
  return { error: j.error || "failed" };
}
