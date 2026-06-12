"use client";
import { useState, useEffect } from "react";
import { MASKAN } from "./data";
import { Button } from "./ui";
import { AvailabilityCalendar, nightsBetween } from "./calendar";
import { Booking } from "./booking";
import { createClient } from "../lib/supabase/client";

function useLang() {
  const [lang, setLang] = useState("uz");
  useEffect(() => {
    const s = typeof window !== "undefined" ? localStorage.getItem("maskan_lang") : null;
    if (["uz", "ru", "en"].includes(s)) setLang(s);
  }, []);
  return lang;
}

// Interactive booking island for the server-rendered apartment page: availability calendar +
// reserve, reusing the existing Booking flow (opened as an overlay). Content above is SSR.
export function AptReserve({ apt }) {
  const STR = MASKAN.STR;
  const lang = useLang();
  const [busy, setBusy] = useState(new Set());
  const [range, setRange] = useState({ from: null, to: null });
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    const sb = createClient();
    sb.rpc("busy_dates_for", { p_apartment_id: apt.id }).then(({ data }) => {
      setBusy(new Set((data || []).map((r) => r.d)));
    }).catch(() => {});
  }, [apt.id]);

  // lock background scroll while the booking overlay is open
  useEffect(() => {
    if (!booking) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [booking]);

  const nights = range.from && range.to ? nightsBetween(range.from, range.to) : 0;

  if (booking) {
    return (
      <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto">
        <Booking apt={apt} range={range} lang={lang} STR={STR} device="mobile"
          onBack={() => setBooking(false)} onHome={() => { window.location.href = "/"; }} onBooked={() => {}} />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-baseline gap-1.5 mb-4">
        <span className="font-bold text-[24px] tnum">${apt.price}</span>
        <span className="text-[14px] text-inksoft font-semibold">/ {STR[lang].night1}</span>
        {nights > 0 && <span className="ml-auto text-[14px] font-semibold text-green-700">${apt.price * nights} · {STR[lang].night_n(nights)}</span>}
      </div>
      <AvailabilityCalendar lang={lang} STR={STR} busy={busy} value={range} onChange={setRange} months={1} />
      <div className="mt-4">
        <Button full size="lg" icon="bolt" disabled={!nights} onClick={() => setBooking(true)}>
          {nights ? `${STR[lang].confirm_book} · $${apt.price * nights}` : STR[lang].select_dates}
        </Button>
      </div>
      <p className="text-[12px] text-inksoft text-center mt-3">{STR[lang].nofees}</p>
    </div>
  );
}
