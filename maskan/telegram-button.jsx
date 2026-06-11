"use client";
import { useEffect, useRef } from "react";

// Official Telegram Login Widget (data-auth-url flow). Telegram renders its own button;
// on confirm it redirects the whole browser to /api/auth/telegram?<auth fields>, which our
// GET handler verifies and bounces to a Supabase magic link. On mobile this deep-links
// straight into the Telegram app instead of waiting for a popup confirmation message.
export function TelegramLoginButton({ size = "large", radius = 22 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.setAttribute("data-telegram-login", "maskan_tashkentbot");
    s.setAttribute("data-size", size);
    s.setAttribute("data-radius", String(radius));
    s.setAttribute("data-auth-url", window.location.origin + "/api/auth/telegram");
    el.appendChild(s);
    return () => { el.innerHTML = ""; };
  }, [size, radius]);
  return <div ref={ref} className="tg-login flex justify-center min-h-[48px]" />;
}
