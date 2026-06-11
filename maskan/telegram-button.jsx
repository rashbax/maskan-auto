"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Icon } from "./ui";

// Bot-based Telegram login (t.me/<bot>?start=<nonce>) — bypasses the OAuth login widget
// (which Telegram's anti-phishing layer silently blocks for new bots on free domains).
// Click → open the bot deep link → user taps Start → the bot webhook confirms the nonce →
// THIS page keeps polling (it never navigates away until success) → redirect to a magic link.
const T = {
  idle: { uz: "Telegram bilan kirish", ru: "Войти через Telegram", en: "Continue with Telegram" },
  open: { uz: "Telegram'ni ochish", ru: "Открыть Telegram", en: "Open Telegram" },
  hint: { uz: "Telegram'da Start bosing, soʻng shu sahifaga qayting", ru: "Нажмите Start в Telegram и вернитесь сюда", en: "Tap Start in Telegram, then return here" },
  err: { uz: "Boʻlmadi. Qayta urinish", ru: "Не удалось. Повторить", en: "Failed. Try again" },
};

export function TelegramLoginButton({ lang = "uz", height = 52 }) {
  const [state, setState] = useState("idle"); // idle | waiting | error
  const [link, setLink] = useState(null);
  const nonceRef = useRef(null);
  const startedRef = useRef(0);
  const pollRef = useRef(null);
  const winRef = useRef(null); // the tab we opened to launch Telegram (closed on success)

  const stop = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const check = useCallback(async () => {
    const nonce = nonceRef.current;
    if (!nonce) return;
    if (Date.now() - startedRef.current > 5 * 60 * 1000) { stop(); setState("error"); return; }
    try {
      const j = await (await fetch(`/api/auth/telegram/poll?nonce=${nonce}`)).json();
      if (j.status === "confirmed" && j.url) {
        stop();
        // close the tab we opened for Telegram so focus returns to THIS (now signing-in) tab
        const w = winRef.current;
        if (w && !w.closed) { try { w.close(); } catch { /* cross-origin close is fine */ } }
        window.location.href = j.url;
      } else if (j.status === "expired" || j.status === "error") { stop(); setState("error"); }
    } catch { /* transient — keep polling */ }
  }, []);

  // poll immediately whenever the tab regains focus (returning from Telegram)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible" && pollRef.current) check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); stop(); };
  }, [check]);

  async function start() {
    setState("waiting");
    setLink(null);
    const win = window.open("", "_blank"); // best-effort open within the click gesture
    winRef.current = win;
    try {
      const { nonce, url } = await (await fetch("/api/auth/telegram/start", { method: "POST" })).json();
      if (!url) throw new Error("no_url");
      nonceRef.current = nonce;
      startedRef.current = Date.now();
      setLink(url);
      if (win) win.location.href = url; // else: popup blocked → user taps the manual link below
      stop();
      pollRef.current = setInterval(check, 2500);
    } catch {
      if (win) win.close();
      setState("error");
    }
  }

  const base = "inline-flex items-center justify-center gap-2.5 w-full rounded-full font-semibold text-[15px] transition active:scale-[.985]";

  if (state === "waiting") {
    return (
      <div className="space-y-2.5">
        <a href={link || undefined} target="_blank" rel="noopener noreferrer"
          className={`${base} bg-green-700 text-cream hover:bg-green-900 shadow-[0_6px_16px_rgba(20,64,47,.22)]`} style={{ height }}>
          <Icon name="tg" size={20} />{T.open[lang]}
        </a>
        <div className="flex items-center justify-center gap-2 text-center text-[12.5px] text-inksoft px-2">
          <span className="w-3.5 h-3.5 shrink-0 rounded-full border-2 border-green-700/30 border-t-green-700 animate-spin" />{T.hint[lang]}
        </div>
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
