"use client";
import { useState, useEffect, useRef } from "react";
import { MASKAN } from "./data";

// ---------------- Icons (stroke, currentColor) ----------------
const PATHS = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm9 2-4.3-4.3",
  cal: "M7 3v3M17 3v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 8v-1a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11",
  pin: "M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z M12 10a2 2 0 1 0 0 0.01",
  star: "M12 3.5l2.6 5.27 5.8.85-4.2 4.1 1 5.78L12 16.77 6.99 19.5l1-5.78-4.2-4.1 5.8-.85L12 3.5z",
  chevL: "M15 18l-6-6 6-6", chevR: "M9 18l6-6-6-6", chevD: "M6 9l6 6 6-6", chevU: "M18 15l-6-6-6 6",
  x: "M18 6 6 18M6 6l12 12", plus: "M12 5v14M5 12h14", minus: "M5 12h14",
  check: "M20 6 9 17l-5-5", heart: "M12 21s-7.5-4.6-10-9.3C-0.2 7.4 2.5 3.5 6.2 4.3 8.4 4.8 12 8 12 8s3.6-3.2 5.8-3.7c3.7-.8 6.4 3.1 4.2 7.4C19.5 16.4 12 21 12 21z",
  shield: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z M9 12l2 2 4-4",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  tg: "M21.5 4.3 2.8 11.5c-1 .4-1 1.8.1 2.1l4.7 1.5 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.8 3.5c.7.5 1.7.1 1.9-.7L23 5.6c.2-1-.7-1.7-1.5-1.3z M8 14.5l9-5.6-7 6.4",
  wa: "M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3z M9 8.4c.3 0 .5.1.6.4l.6 1.4c.1.3 0 .5-.2.7l-.4.4c-.1.2-.2.3 0 .6.4.7 1.2 1.5 2 1.9.3.1.4 0 .6-.1l.4-.5c.2-.2.4-.2.6-.1l1.4.6c.3.1.4.4.4.6 0 1-.9 1.6-1.8 1.6-2.7 0-5.4-2.7-5.4-5.4 0-.9.5-1.7 1.6-1.7z",
  arrowR: "M5 12h14M13 5l7 7-7 7", arrowL: "M19 12H5M11 19l-7-7 7-7",
  sliders: "M4 6h11M19 6h1M4 12h7M15 12h5M4 18h14M4 18h0M22 18h-3M9 4v4M17 10v4M13 16v4",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8z", grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  home: "M3 11l9-8 9 8M5 9.5V21h14V9.5", plusbox: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M12 9v6M9 12h6",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01", logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  // amenities
  wifi: "M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01 M2 9a15 15 0 0 1 20 0",
  ac: "M3 7h18v6H3zM6 17v2M10 17v3M14 17v2M18 17v3M7 10h10",
  kitchen: "M8 3v7a4 4 0 0 0 8 0V3 M12 14v7 M8 3v4M16 3v4",
  washer: "M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M7 6h.01M10 6h.01",
  parking: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M9 17V7h4a3 3 0 0 1 0 6H9",
  tv: "M3 5h18v12H3zM8 21h8M12 17v4", elevator: "M6 3h12v18H6zM12 3v18M9 8l1.5-2 1.5 2M9 16l1.5 2 1.5-2",
  heating: "M4 21V8a4 4 0 0 1 8 0v0a4 4 0 0 0 8 0V3 M2 21h20", workspace: "M3 4h18v12H3zM3 16l3 4M21 16l-3 4M9 20h6",
  balcony: "M3 10h18M5 10V21M19 10V21M9 14v7M15 14v7M5 10l7-6 7 6", selfcheckin: "M15 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3 M12 3v9m0 0 3-3m-3 3-3-3",
  water: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  user: "M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  mail: "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z M3.4 7l8.6 6 8.6-6",
  lock: "M6 11V8a6 6 0 1 1 12 0v3 M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0",
  reply: "M9 17l-5-5 5-5 M4 12h11a5 5 0 0 1 5 5v2",
  eyeoff: "M9.9 4.2A9 9 0 0 1 21 12a9 9 0 0 1-1.3 2.3 M6.6 6.6A9 9 0 0 0 3 12a9 9 0 0 0 9 5 8.6 8.6 0 0 0 3.5-.8 M3 3l18 18 M9.9 9.9a3 3 0 0 0 4.2 4.2",
  bookmark: "M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z",
  ticket: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7z M14 5v14",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8 M21 4v4h-4",
  trash: "M4 7h16 M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  clipboard: "M9 3h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2",
  truck: "M3 6h11v9H3z M14 9h4l3 3v3h-7V9z M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  pencil: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z",
};

export function Icon({ name, size = 22, sw = 1.6, className = "", fill = "none" }) {
  const d = PATHS[name] || "";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {d.split(" M").map((seg, i) => <path key={i} d={(i ? "M" : "") + seg} />)}
    </svg>
  );
}

// ---------------- Brand mark ----------------
export function Logo({ size = 30, withWord = true }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <img src="/maskan-mark.png" alt="Maskan" draggable="false" style={{ height: size, width: "auto", display: "block" }} />
      {withWord && (
        <div className="leading-none">
          <div className="font-serif tracking-tight text-ink" style={{ fontSize: Math.round(size * 0.66) }}>Maskan</div>
          <div className="font-semibold text-green-600" style={{ fontSize: Math.max(7.5, size * 0.28), letterSpacing: "0.3em", marginTop: 2 }}>TASHKENT</div>
        </div>
      )}
    </div>
  );
}

// ---------------- Buttons ----------------
export function Button({ children, variant = "primary", size = "md", full, className = "", icon, ...rest }) {
  const sizes = { sm: "h-9 px-3.5 text-[13px]", md: "h-12 px-5 text-[15px]", lg: "h-14 px-6 text-[16px]" };
  const variants = {
    primary: "bg-green-700 text-cream hover:bg-green-900 active:scale-[.985] shadow-[0_6px_16px_rgba(20,64,47,.22)]",
    dark: "bg-ink text-cream hover:bg-black active:scale-[.985]",
    outline: "bg-transparent text-ink border border-line hover:border-ink/40 hover:bg-black/[.02]",
    ghost: "bg-transparent text-ink hover:bg-black/[.04]",
    soft: "bg-green-50 text-green-700 hover:bg-green-100",
  };
  return (
    <button className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 ${sizes[size]} ${variants[variant]} ${full ? "w-full" : ""} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 17 : 19} />}
      {children}
    </button>
  );
}

export function Chip({ children, active, onClick, icon }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13.5px] font-semibold whitespace-nowrap transition-colors border ${active ? "bg-ink text-cream border-ink" : "bg-white text-ink border-line hover:border-ink/30"}`}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = "cream", icon }) {
  const tones = {
    cream: "bg-white/92 text-ink backdrop-blur",
    green: "bg-green-700 text-cream",
    soft: "bg-green-50 text-green-700",
    ink: "bg-ink/82 text-cream backdrop-blur",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-[12px] font-bold ${tones[tone]}`}>
      {icon && <Icon name={icon} size={13} sw={2} />}
      {children}
    </span>
  );
}

export function Stars({ rating, reviews, lang, STR }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-ink">
      <Icon name="star" size={15} fill="#1B5E40" className="text-green-600" sw={0} />
      <span className="tnum">{rating.toFixed(2)}</span>
      {reviews != null && <span className="text-inksoft font-medium">· {STR[lang].reviews_n(reviews)}</span>}
    </span>
  );
}

// ---------------- Photo placeholder w/ blur-up ----------------
export function Photo({ tone, idx = 0, label = "apartment photo", className = "", rounded = "", eager = false, showLabel = true, src }) {
  const T = MASKAN.TONES[tone] || MASKAN.TONES.stone;
  const [sharp, setSharp] = useState(eager);
  const ref = useRef(null);
  useEffect(() => {
    if (eager) { const t = setTimeout(() => setSharp(true), 220 + (idx % 5) * 90); return () => clearTimeout(t); }
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { setTimeout(() => setSharp(true), 200 + (idx % 6) * 120); io.disconnect(); } });
    }, { rootMargin: "120px" });
    io.observe(el); return () => io.disconnect();
  }, [eager, idx]);
  const stripe = `repeating-linear-gradient(135deg, ${T.a} 0 14px, ${T.b} 14px 28px)`;
  return (
    <div ref={ref} className={`relative overflow-hidden ${rounded} ${className}`} style={{ background: T.b }}>
      {/* blurred base layer (instant) */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 120% at 30% 20%, ${T.a}, ${T.b})` }} />
      {/* sharp striped layer fades/sharpens in */}
      <div className="absolute inset-0 transition-all duration-[600ms]" style={{ background: stripe, opacity: sharp ? 1 : 0, filter: sharp ? "blur(0px)" : "blur(14px)", transform: sharp ? "scale(1)" : "scale(1.06)" }} />
      {src && <img src={src} alt={label} loading={eager ? "eager" : "lazy"} className="absolute inset-0 w-full h-full object-cover" />}
      {showLabel && !src && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-mono text-[10.5px] tracking-tight px-2 py-1 rounded-md backdrop-blur-sm" style={{ color: T.ink, background: "rgba(255,255,255,.42)" }}>{label}</span>
        </div>
      )}
    </div>
  );
}

// skeleton box
export function Sk({ className = "", rounded = "rounded-xl" }) { return <div className={`skeleton ${rounded} ${className}`} />; }

// ---------------- Guest stepper ----------------
export function Stepper({ value, min = 1, max = 12, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-10 h-10 grid place-items-center rounded-full border border-line text-ink disabled:opacity-30 hover:border-ink/40 transition">
        <Icon name="minus" size={18} /></button>
      <span className="w-7 text-center text-[17px] font-bold tnum">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="w-10 h-10 grid place-items-center rounded-full border border-line text-ink disabled:opacity-30 hover:border-ink/40 transition">
        <Icon name="plus" size={18} /></button>
    </div>
  );
}

// ---------------- Bottom sheet / modal ----------------
export function Sheet({ open, onClose, children, title, desktop, footer }) {
  // While the sheet is open, freeze the page behind it: without this the booking list scrolls
  // under the sheet, and a pull-up gesture rubber-bands the body so the sheet's bottom detaches.
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevOverscroll = body.style.overscrollBehavior;
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      body.style.overflow = prevOverflow;
      body.style.overscrollBehavior = prevOverscroll;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-none" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/45 pop-in" />
      <div onClick={(e) => e.stopPropagation()}
        className={`relative w-full bg-canvas sheet-up ${desktop ? "max-w-md rounded-3xl m-auto" : "rounded-t-3xl"} shadow-pop max-h-[90%] flex flex-col min-h-0`}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <div className="font-serif text-[19px]">{title}</div>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-full hover:bg-black/5"><Icon name="x" size={20} /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain no-scrollbar px-5 pb-5 flex-1 min-h-0">{children}</div>
        {footer && <div className="shrink-0 px-5 pt-3 pb-4 border-t border-line bg-canvas">{footer}</div>}
      </div>
    </div>
  );
}

// amenity icon name resolver (data key -> icon name)
export const AMENITY_ICON = { wifi: "wifi", ac: "ac", kitchen: "kitchen", washer: "washer", parking: "parking", tv: "tv", elevator: "elevator", heating: "heating", workspace: "workspace", balcony: "balcony", selfcheckin: "selfcheckin", water: "water" };

// ---------------- Contact channel button (WhatsApp / Telegram) ----------------
export const waHref = (text) => `https://wa.me/${MASKAN.CONTACT.wa}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
// Telegram contact routing:
//  - bookingId → via bot, start=book_<bookingId>_<lang> (post-booking: keys/address, full context)
//  - aptId     → via bot, start=<aptId>_<lang>          (apartment enquiry: greet by name)
//  - neither   → straight to the personal Telegram      (general question, no context to capture)
export const tgHref = (aptId, lang, bookingId) =>
  bookingId
    ? `https://t.me/${MASKAN.CONTACT.bot}?start=book_${bookingId}_${lang || "uz"}`
    : aptId
      ? `https://t.me/${MASKAN.CONTACT.bot}?start=${aptId}_${lang || "uz"}`
      : `https://t.me/${MASKAN.CONTACT.tg}`;

export function ChannelBtn({ channel, lang, STR, variant = "outline", full, size = "md", text, aptId, bookingId, children }) {
  const isWa = channel === "whatsapp";
  const href = isWa ? waHref(text) : tgHref(aptId, lang, bookingId);
  const label = children || (isWa ? STR[lang].chat_whatsapp : STR[lang].chat_telegram);
  const sizes = { sm: "h-10 px-4 text-[13.5px]", md: "h-12 px-5 text-[15px]", lg: "h-14 px-6 text-[16px]" };
  const variants = {
    solid: "bg-green-700 text-cream hover:bg-green-900 shadow-[0_6px_16px_rgba(20,64,47,.22)]",
    outline: "bg-white text-ink border border-line hover:border-ink/30",
    soft: "bg-green-50 text-green-700 hover:bg-green-100",
  };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[.985] ${sizes[size]} ${variants[variant]} ${full ? "w-full" : ""}`}>
      <Icon name={isWa ? "wa" : "tg"} size={size === "sm" ? 17 : 19} />{label}
    </a>
  );
}

// Google "G" glyph for login buttons
export function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.3a14.5 14.5 0 0 1 0-8.6l-7.8-6.1a24 24 0 0 0 0 20.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.8-3.8-13.7-9.3l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

