"use client";
import { useState, useRef, useEffect } from "react";
import { Icon } from "./ui";

// Bot-based Telegram login (t.me/<bot>?start=<nonce>) — bypasses the OAuth login widget
// (which Telegram's anti-phishing layer silently blocks for new bots on free domains).
// Click → open the bot deep link (native app deep-link on mobile) → user taps Start →
// the bot webhook confirms the nonce → we poll → redirect to a Supabase magic link.
const T = {
  idle: { uz: "Telegram bilan kirish", ru: "Войти через Telegram", en: "Continue with Telegram" },
  wait: { uz: "Telegramda tasdiqlang…", ru: "Подтвердите в Telegram…", en: "Confirm in Telegram…" },
  hint: { uz: "Telegram ochilmadimi? Shu yerni bosing", ru: "Telegram не открылся? Нажмите здесь", en: "Telegram didn't open? Tap here" },
  err: { uz: "Boʻlmadi. Qayta urinish", ru: "Не удалось. Повторить", en: "Failed. Try again" },
};

export function TelegramLoginButton({ lang = "uz", height = 52 }) {
  const [state, setState] = useState("idle"); // idle | waiting | error
  const [link, setLink] = useState(null); // t.me deep link, for the manual fallback
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  async function start() {
    setState("waiting");
    setLink(null);
    // open a blank tab synchronously (inside the click) so popup blockers allow it
    const win = window.open("", "_blank");
    try {
      const { nonce, url } = await (await fetch("/api/auth/telegram/start", { method: "POST" })).json();
      if (!url) throw new Error("no_url");
      setLink(url);
      if (win) win.location.href = url; else window.location.href = url;

      const t0 = Date.now();
      clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        if (Date.now() - t0 > 5 * 60 * 1000) { clearInterval(pollRef.current); setState("error"); return; }
        try {
          const j = await (await fetch(`/api/auth/telegram/poll?nonce=${nonce}`)).json();
          if (j.status === "confirmed" && j.url) { clearInterval(pollRef.current); window.location.href = j.url; }
          else if (j.status === "expired" || j.status === "error") { clearInterval(pollRef.current); setState("error"); }
        } catch { /* transient — keep polling */ }
      }, 2000);
    } catch {
      if (win) win.close();
      setState("error");
    }
  }

  const base = "inline-flex items-center justify-center gap-2.5 w-full rounded-full font-semibold text-[15px] transition active:scale-[.985]";

  if (state === "waiting") {
    return (
      <div className="space-y-2">
        <div className={`${base} bg-green-700/90 text-cream`} style={{ height }}>
          <span className="w-4 h-4 rounded-full border-2 border-cream/40 border-t-cream animate-spin" />{T.wait[lang]}
        </div>
        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="block text-center text-[12.5px] text-inksoft underline">{T.hint[lang]}</a>}
      </div>
    );
  }
  if (state === "error") {
    return (
      <button type="button" onClick={start} className={`${base} bg-white border border-line text-ink hover:border-ink/30`} style={{ height }}>
        <Icon name="refresh" size={18} />{T.err[lang]}
      </button>
    );
  }
  return (
    <button type="button" onClick={start} className={`${base} bg-green-700 text-cream hover:bg-green-900 shadow-[0_6px_16px_rgba(20,64,47,.22)]`} style={{ height }}>
      <Icon name="tg" size={20} />{T.idle[lang]}
    </button>
  );
}
