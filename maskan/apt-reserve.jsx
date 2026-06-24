"use client";
import { useState, useEffect, useRef } from "react";
import { MASKAN } from "./data";
import { Button } from "./ui";
import { AvailabilityCalendar, nightsBetween } from "./calendar";
import { Booking } from "./booking";
import { createClient } from "../lib/supabase/client";
import { fmtPrice, CURRENCY_CODES, defaultCurrencyFor } from "./money";
import { getRates, RATE_FALLBACK } from "./db";

function useLang() {
  const [lang, setLang] = useState("uz");
  useEffect(() => {
    const s = typeof window !== "undefined" ? localStorage.getItem("maskan_lang") : null;
    if (["uz", "ru", "en"].includes(s)) setLang(s);
  }, []);
  return lang;
}

// the apartment page is its own SSR route — read the display currency from localStorage
// (set on the catalog), falling back to the language default. Server render uses USD.
function useCurrency(lang) {
  const [cur, setCur] = useState("USD");
  useEffect(() => {
    const s = typeof window !== "undefined" ? localStorage.getItem("maskan_currency") : null;
    setCur(CURRENCY_CODES.includes(s) ? s : defaultCurrencyFor(lang));
  }, [lang]);
  return cur;
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
          {nights > 0 && <span className="ml-auto text-[14px] font-semibold text-green-700">{P(apt.price * nights)} · {STR[lang].night_n(nights)}</span>}
        </div>
        {currency !== "USD" && <div className="text-[11px] text-inksoft -mt-3 mb-3">{STR[lang].price_approx}</div>}
        <AvailabilityCalendar lang={lang} STR={STR} busy={busy} value={range} onChange={setRange} months={1} />
        <div className="mt-4">
          <Button full size="lg" icon="bolt" disabled={!nights} onClick={() => setBooking(true)}>
            {nights ? `${STR[lang].confirm_book} · ${P(apt.price * nights)}` : STR[lang].select_dates}
          </Button>
        </div>
        <p className="text-[12px] text-inksoft text-center mt-3">{STR[lang].nofees}</p>
      </div>

      {/* Mobile/tablet sticky reserve bar — the sidebar card is at the bottom of the page below lg,
          so this keeps the CTA reachable without scrolling all the way down. */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line px-4 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="shrink-0">
            <div className="font-bold text-[18px] tnum leading-none">{P(apt.price)}<span className="text-[13px] text-inksoft font-semibold"> / {STR[lang].night1}</span></div>
            {nights > 0 && <div className="text-[12px] text-green-700 font-semibold mt-1">{P(apt.price * nights)} · {STR[lang].night_n(nights)}</div>}
          </div>
          <div className="ml-auto">
            <Button size="lg" icon="bolt" onClick={onReserve}>
              <span className="whitespace-nowrap">{nights ? `${STR[lang].confirm_book} · ${P(apt.price * nights)}` : STR[lang].select_dates}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
