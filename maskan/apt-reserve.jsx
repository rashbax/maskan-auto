"use client";
import { useState, useEffect, useRef } from "react";
import { MASKAN } from "./data";
import { Button, Icon, CurrencyMenu } from "./ui";
import { AvailabilityCalendar, nightsBetween } from "./calendar";
import { Booking, PriceBreakdown } from "./booking";
import { createClient } from "../lib/supabase/client";
import { fmtPrice, CURRENCY_CODES, defaultCurrencyFor } from "./money";
import { directTotal, WEBSITE_DISCOUNT_PCT } from "../lib/pricing";
import { getRates, RATE_FALLBACK } from "./db";

// The apartment page is a SEPARATE SSR route with independent client islands (the header currency
// picker and the reserve card). They sync the chosen display currency through localStorage + a
// same-tab custom event so switching in the header re-prices the reserve card instantly.
const CURRENCY_EVT = "maskan:currency";
function readCurrency(lang) {
  const s = typeof window !== "undefined" ? localStorage.getItem("maskan_currency") : null;
  return CURRENCY_CODES.includes(s) ? s : defaultCurrencyFor(lang);
}

function useLang() {
  const [lang, setLang] = useState("uz");
  useEffect(() => {
    const s = typeof window !== "undefined" ? localStorage.getItem("maskan_lang") : null;
    if (["uz", "ru", "en"].includes(s)) setLang(s);
  }, []);
  return lang;
}

// read the display currency from localStorage (set on the catalog or the header picker below),
// falling back to the language default. Server render uses USD. Re-reads on the sync event.
function useCurrency(lang) {
  const [cur, setCur] = useState("USD");
  useEffect(() => {
    setCur(readCurrency(lang));
    const onCur = (e) => setCur(e.detail);
    window.addEventListener(CURRENCY_EVT, onCur);
    return () => window.removeEventListener(CURRENCY_EVT, onCur);
  }, [lang]);
  return cur;
}

// Standalone currency picker for the SSR apartment-page header. Writes localStorage and broadcasts
// the sync event so the reserve island (a separate client root) re-prices without a reload.
export function AptCurrencyMenu({ lang }) {
  const [currency, setCur] = useState("USD");
  useEffect(() => {
    setCur(readCurrency(lang));
    const onCur = (e) => setCur(e.detail);
    window.addEventListener(CURRENCY_EVT, onCur);
    return () => window.removeEventListener(CURRENCY_EVT, onCur);
  }, [lang]);
  const setCurrency = (c) => {
    setCur(c);
    try { localStorage.setItem("maskan_currency", c); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(CURRENCY_EVT, { detail: c }));
  };
  return <CurrencyMenu currency={currency} setCurrency={setCurrency} lang={lang} />;
}

// Interactive booking island for the server-rendered apartment page: availability calendar +
// reserve, reusing the existing Booking flow (opened as an overlay). Content above is SSR.
export function AptReserve({ apt, lang: langProp }) {
  const STR = MASKAN.STR;
  const langLocal = useLang();
  const lang = langProp || langLocal;
  const currency = useCurrency(lang);
  const [rates, setRates] = useState(RATE_FALLBACK);
  useEffect(() => { getRates().then(setRates).catch(() => {}); }, []);
  const P = (usd) => fmtPrice(usd, currency, rates); // USD → display currency
  const [busy, setBusy] = useState(() => new Set(apt.busyDates || []));
  const [range, setRange] = useState({ from: null, to: null });
  const [booking, setBooking] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false); // anonymous bookings can't be tracked in-app
  const cardRef = useRef(null);

  useEffect(() => {
    const sb = createClient();
    sb.rpc("busy_dates_for", { p_apartment_id: apt.id }).then(({ data }) => {
      setBusy(new Set((data || []).map((r) => r.d)));
    }).catch(() => {});
    sb.auth.getSession().then(({ data }) => setLoggedIn(!!data.session)).catch(() => {});
  }, [apt.id]);

  // Match the booking overlay's layout to the screen (centered card on desktop, full-bleed on phone).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // lock background scroll while the booking overlay is open
  useEffect(() => {
    if (!booking) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [booking]);

  const nights = range.from && range.to ? nightsBetween(range.from, range.to) : 0;
  // Sticky bar (mobile/tablet): with dates → open booking; without → scroll up to the date picker.
  const onReserve = () => (nights ? setBooking(true) : cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));

  if (booking) {
    return (
      <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
        <Booking apt={apt} range={range} lang={lang} STR={STR} device={desktop ? "desktop" : "mobile"} loggedIn={loggedIn} currency={currency} rates={rates}
          onBack={() => setBooking(false)} onHome={() => { window.location.href = "/"; }} onBooked={() => {}} />
      </div>
    );
  }

  return (
    <>
      <div ref={cardRef} className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="flex items-baseline gap-1.5 mb-4">
          <span className="font-bold text-[24px] tnum">{P(apt.price)}</span>
          <span className="text-[14px] text-inksoft font-semibold">/ {STR[lang].night1}</span>
          <span className="ml-auto self-center inline-flex items-center gap-1 px-2 h-6 rounded-full bg-green-50 text-green-700 text-[11.5px] font-bold"><Icon name="ticket" size={13} />{STR[lang].disc_badge(WEBSITE_DISCOUNT_PCT)}</span>
        </div>
        {currency !== "USD" && <div className="text-[11px] text-inksoft -mt-3 mb-3">{STR[lang].price_approx}</div>}
        {nights === 0 && <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-green-700 mb-3"><Icon name="ticket" size={14} />{STR[lang].disc_hint(WEBSITE_DISCOUNT_PCT)}</div>}
        <AvailabilityCalendar lang={lang} STR={STR} busy={busy} value={range} onChange={setRange} months={1} />
        {nights > 0 && <div className="mt-4"><PriceBreakdown perNightUsd={apt.price} nights={nights} currency={currency} rates={rates} lang={lang} STR={STR} /></div>}
        <div className="mt-4">
          <Button full size="lg" icon="bolt" disabled={!nights} onClick={() => setBooking(true)}>
            {nights ? `${STR[lang].confirm_book} · ${P(directTotal(apt.price * nights))}` : STR[lang].select_dates}
          </Button>
        </div>
        {/* secondary: let the guest clear a started/finished selection back to an empty calendar
            (picking can only re-set the start otherwise — there was no way back to zero) */}
        {range.from && (
          <button onClick={() => setRange({ from: null, to: null })}
            className="w-full mt-2 inline-flex items-center justify-center gap-1.5 h-10 text-[13.5px] font-semibold text-inksoft hover:text-ink transition">
            <Icon name="x" size={15} />{STR[lang].clear}
          </button>
        )}
        <p className="text-[12px] text-inksoft text-center mt-3">{STR[lang].nofees}</p>
      </div>

      {/* Mobile/tablet sticky reserve bar — the sidebar card is at the bottom of the page below lg,
          so this keeps the CTA reachable without scrolling all the way down. */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line px-4 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="shrink-0">
            <div className="font-bold text-[18px] tnum leading-none">{P(apt.price)}<span className="text-[13px] text-inksoft font-semibold"> / {STR[lang].night1}</span></div>
            {nights > 0
              ? <div className="text-[12px] text-green-700 font-semibold mt-1">{P(directTotal(apt.price * nights))} · {STR[lang].night_n(nights)}</div>
              : <div className="text-[12px] text-green-700 font-semibold mt-1">{STR[lang].disc_badge(WEBSITE_DISCOUNT_PCT)}</div>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {range.from && (
              <button onClick={() => setRange({ from: null, to: null })} aria-label={STR[lang].clear} title={STR[lang].clear}
                className="w-14 h-14 shrink-0 grid place-items-center rounded-full border border-line text-inksoft hover:text-ink hover:border-ink/30 transition">
                <Icon name="x" size={20} />
              </button>
            )}
            <Button size="lg" icon="bolt" onClick={onReserve}>
              <span className="whitespace-nowrap">{nights ? `${STR[lang].confirm_book} · ${P(directTotal(apt.price * nights))}` : STR[lang].select_dates}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
