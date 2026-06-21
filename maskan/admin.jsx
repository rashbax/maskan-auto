"use client";
import { useState, useEffect, useRef, createRef } from "react";
import { MASKAN } from "./data";
import { Icon, Logo, Button, Chip, Badge, Photo, Stepper, AMENITY_ICON, GoogleG, Sheet } from "./ui";
import { calMonths, calWD } from "./calendar";
import { fmtRange } from "./catalog";
import { StarRow } from "./reviews";
import { getApartments, getAllBookings, cancelBooking, deleteBooking, shortenBooking, createManualBooking, getAllBlocks, getAllReviews, setReviewHidden, setReviewReply, saveApartment, deleteApartment, requestUploadUrl, addPhoto, getPhotos, deletePhoto, setPhotoOrder } from "./db";
import { MapPicker } from "./maps";
import { TelegramLoginButton } from "./telegram-button";
import { PropertyFilesSection } from "./property-file";
import { SuppliersSection } from "./suppliers";
import { CalManager } from "./admin-calendar";

const SRC = {
  website: { color: "#1B5E40", bg: "#EAF1EC", key: "src_website" },
  booking: { color: "#2A5B8C", bg: "#E7EEF6", key: "src_booking" },
  manual: { color: "#9A6A1E", bg: "#F6EEDD", key: "src_manual" },
};

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="text-[12.5px] font-bold tracking-wide uppercase text-inksoft">{label}</div>
      <div className={`font-serif text-[30px] mt-1 ${accent ? "text-green-700" : "text-ink"} tnum`}>{value}</div>
      {sub && <div className="text-[12.5px] text-inksoft mt-0.5">{sub}</div>}
    </div>
  );
}

function NumF({ label, value, set, min = 0, max = 999 }) {
  const cur = Number(value) || min;
  return (
    <div>
      <div className="text-[12px] font-bold text-inksoft mb-1.5">{label}</div>
      <div className="flex items-center rounded-xl border border-line bg-white h-11 overflow-hidden">
        <button type="button" onClick={() => set(Math.max(min, cur - 1))} className="w-10 h-full grid place-items-center text-inksoft hover:bg-black/[.03]"><Icon name="minus" size={16} /></button>
        <input value={value} inputMode="numeric"
          onChange={(e) => set(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={(e) => set(Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min)))}
          className="flex-1 w-full text-center text-[15px] font-bold tnum outline-none bg-transparent" />
        <button type="button" onClick={() => set(Math.min(max, cur + 1))} className="w-10 h-full grid place-items-center text-inksoft hover:bg-black/[.03]"><Icon name="plus" size={16} /></button>
      </div>
    </div>
  );
}

function aptById(id) { return MASKAN.APARTMENTS.find((a) => a.id === id); }

// ---- dashboard ----
function Dashboard({ lang, STR, bookings, apartments, onOpenDetail }) {
  const M = MASKAN;
  const [blocks, setBlocks] = useState({}); // { [apartmentId]: Set<isoDate> } — for the occupancy denominator
  useEffect(() => { getAllBlocks().then(setBlocks); }, []);
  const today = M.iso(M.TODAY);
  const list = bookings || [];
  const todays = list.filter((b) => b.from === today);
  // currently staying: checked in earlier and not yet checked out (would otherwise vanish from
  // the dashboard the day after check-in, since it's neither "today" nor "upcoming")
  const staying = list.filter((b) => b.from < today && b.to > today && b.status === "active");
  const upcoming = list.filter((b) => b.from > today && b.status === "active");
  // real occupancy + revenue for THIS month: only the booked nights that fall inside the month;
  // revenue is prorated per night so a stay spanning months counts only its in-month nights
  const y = M.TODAY.getFullYear(), mo = M.TODAY.getMonth();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const mStart = new Date(y, mo, 1), mEnd = new Date(y, mo + 1, 1);
  let bookedNights = 0, monthRevenue = 0;
  for (const b of list) {
    if (b.status === "cancelled") continue;
    const s = Math.max(new Date(b.from).getTime(), mStart.getTime());
    const e = Math.min(new Date(b.to).getTime(), mEnd.getTime());
    if (e <= s) continue;
    const nim = Math.round((e - s) / 86400000);
    bookedNights += nim;
    const bNights = b.nights || Math.round((new Date(b.to) - new Date(b.from)) / 86400000) || 1;
    if (b.total) monthRevenue += (b.total / bNights) * nim;
  }
  // owner-blocked days aren't "available" inventory, so exclude them from the denominator
  // (occupancy = sold nights / available nights, not / total capacity)
  const mStartIso = M.iso(mStart), mEndIso = M.iso(mEnd);
  let blockedNights = 0;
  for (const a of apartments || []) {
    const set = blocks[a.id];
    if (set) for (const d of set) if (d >= mStartIso && d < mEndIso) blockedNights++;
  }
  const totalNights = Math.max(0, (apartments || []).length * daysInMonth - blockedNights);
  const occupancy = totalNights > 0 ? Math.round((bookedNights / totalNights) * 100) : 0;
  const revenue = Math.round(monthRevenue);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={STR[lang].a_today} value={todays.length} sub={STR[lang].search_city} accent />
        <StatCard label={STR[lang].a_upcoming} value={upcoming.length} />
        <StatCard label={STR[lang].a_occupancy} value={occupancy + "%"} sub={calMonths[lang][M.TODAY.getMonth()]} />
        <StatCard label={STR[lang].a_revenue} value={"$" + revenue} sub={calMonths[lang][M.TODAY.getMonth()]} accent />
      </div>
      <div>
        <h3 className="font-serif text-[19px] mb-3">{STR[lang].a_today}</h3>
        {todays.length === 0 ? <div className="text-[14px] text-inksoft py-6 text-center border border-dashed border-line rounded-2xl">—</div> : (
          <div className="space-y-2">{todays.map((b) => <BookingRow key={b.id} b={b} lang={lang} STR={STR} apartments={apartments} onOpen={onOpenDetail} />)}</div>
        )}
      </div>
      {staying.length > 0 && (
        <div>
          <h3 className="font-serif text-[19px] mb-3">{STR[lang].a_staying}</h3>
          <div className="space-y-2">{staying.map((b) => <BookingRow key={b.id} b={b} lang={lang} STR={STR} apartments={apartments} onOpen={onOpenDetail} />)}</div>
        </div>
      )}
      <div>
        <h3 className="font-serif text-[19px] mb-3">{STR[lang].a_upcoming}</h3>
        <div className="space-y-2">{upcoming.map((b) => <BookingRow key={b.id} b={b} lang={lang} STR={STR} apartments={apartments} onOpen={onOpenDetail} />)}</div>
      </div>
    </div>
  );
}

function SourceTag({ src, lang, STR }) {
  const s = SRC[src];
  return <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[11.5px] font-bold" style={{ color: s.color, background: s.bg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{STR[lang][s.key]}</span>;
}

function BookingRow({ b, lang, STR, onOpen, apartments }) {
  const apt = (apartments || []).find((a) => a.id === b.apt) || aptById(b.apt);
  if (!apt) return null;
  const open = onOpen ? () => onOpen(b) : undefined;
  const st = bkStatusMeta(b.status, STR, lang);
  return (
    <div role={open ? "button" : undefined} tabIndex={open ? 0 : undefined}
      onClick={open} onKeyDown={open ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } : undefined}
      className={`flex items-center gap-3 p-3 rounded-xl border border-line bg-white ${open ? "cursor-pointer hover:bg-black/[.02] transition" : ""}`}>
      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0"><Photo tone={apt.tone} idx={0} eager showLabel={false} src={apt.photoUrls?.[0]} className="w-full h-full" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-[14px] truncate max-w-full">{b.guest}</span>
          <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10.5px] font-bold shrink-0" style={{ color: st.color, background: st.bg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{st.label}</span>
          <SourceTag src={b.source} lang={lang} STR={STR} />
        </div>
        <div className="text-[12.5px] text-inksoft truncate mt-0.5"><span className="font-mono text-inksoft/70 select-all">#{b.apt}</span> · {apt.title[lang]}</div>
        <div className="text-[12px] text-inksoft flex items-center gap-1.5 mt-0.5"><Icon name="cal" size={13} className="shrink-0" /><span className="truncate">{fmtRange(new Date(b.from), new Date(b.to), lang)} · {STR[lang].night_n(b.nights || 0)}</span></div>
      </div>
      <div className="font-bold text-[15px] tnum shrink-0">${b.total}</div>
      {open && <Icon name="chevR" size={16} className="text-inksoft/45 shrink-0" />}
    </div>
  );
}

// ---- booking detail bottom-sheet (shared by the dashboard + bookings list rows) ----
function bkStatusMeta(status, STR, lang) {
  if (status === "cancelled") return { label: STR[lang].bd_cancelled, color: "#9a4a3c", bg: "#fbeae6" };
  if (status === "checked-out" || status === "past") return { label: STR[lang].bd_past, color: "#5a5750", bg: "#eceae5" };
  return { label: STR[lang].bd_active, color: "#1B5E40", bg: "#EAF1EC" };
}

function MetaRow({ icon, label, value, href }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
      <Icon name={icon} size={16} className="text-inksoft shrink-0" />
      <span className="text-[12.5px] text-inksoft shrink-0">{label}</span>
      {href
        ? <a href={href} onClick={(e) => e.stopPropagation()} className="text-[13.5px] font-semibold text-green-700 truncate hover:underline ml-auto">{value}</a>
        : <span className="text-[13.5px] font-semibold text-ink truncate ml-auto select-all">{value}</span>}
    </div>
  );
}

function BookingDetailSheet({ booking, lang, STR, desktop, apartments, onClose, onCancel, onDelete, onShorten }) {
  const b = booking;
  const apt = b ? ((apartments || []).find((a) => a.id === b.apt) || aptById(b.apt)) : null;
  const fmtDay = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso.length > 10 ? iso : iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return `${calWD[lang][(d.getDay() + 6) % 7]}, ${d.getDate()} ${calMonths[lang][d.getMonth()]}`;
  };
  const st = b ? bkStatusMeta(b.status, STR, lang) : null;
  const tg = b?.tg ? b.tg.replace(/^@/, "") : "";
  const canShorten = b && b.status === "active" && b.nights > 1 && b.source !== "booking" && onShorten;
  const act = "flex-1 min-w-0 h-12 rounded-2xl font-bold text-[13.5px] transition flex items-center justify-center gap-1.5";
  return (
    <Sheet open={!!b} onClose={onClose} desktop={desktop} title={b ? b.guest : ""}
      footer={b ? (
        <div className="space-y-2">
          {(b.phone || tg) && (
            <div className="flex items-center gap-2">
              {b.phone && <a href={`tel:${b.phone}`} onClick={(e) => e.stopPropagation()} className={`${act} border border-line bg-white text-ink hover:border-ink/30`}><Icon name="phone" size={16} />{STR[lang].bd_call}</a>}
              {tg && <a href={`https://t.me/${tg}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`${act} border border-line bg-white text-ink hover:border-ink/30`}><Icon name="tg" size={16} />Telegram</a>}
            </div>
          )}
          {(canShorten || (b.status === "active" && onCancel) || onDelete) && (
            <div className="flex items-center gap-2">
              {canShorten && <button onClick={() => onShorten(b)} className={`${act} border border-green-600/40 text-green-700 hover:bg-green-50`}><Icon name="clock" size={16} />{lang === "ru" ? "Ранний выезд" : lang === "uz" ? "Erta chiqish" : "Early checkout"}</button>}
              {b.status === "active" && onCancel && <button onClick={() => onCancel(b)} className={`${act} bg-red-600 text-white hover:bg-red-700`}><Icon name="x" size={16} />{STR[lang].a_cancel}</button>}
              {onDelete && <button onClick={() => onDelete(b)} aria-label={lang === "ru" ? "Удалить" : lang === "uz" ? "Oʻchirish" : "Delete"} title={lang === "ru" ? "Удалить" : lang === "uz" ? "Oʻchirish" : "Delete"} className="w-12 h-12 shrink-0 grid place-items-center rounded-2xl border border-line text-inksoft hover:text-red-600 hover:bg-red-50 transition"><Icon name="trash" size={16} /></button>}
            </div>
          )}
        </div>
      ) : null}>
      {b && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[11.5px] font-bold" style={{ color: st.color, background: st.bg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{st.label}</span>
            <SourceTag src={b.source} lang={lang} STR={STR} />
          </div>
          {apt && (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0"><Photo tone={apt.tone} idx={0} eager showLabel={false} src={apt.photoUrls?.[0]} className="w-full h-full" /></div>
              <div className="min-w-0 text-[13.5px] text-inksoft">{apt.title[lang]} <span className="font-mono text-inksoft/70">#{b.apt}</span></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-cream border border-line p-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-inksoft">{STR[lang].from}</div>
              <div className="text-[14px] font-bold mt-0.5">{fmtDay(b.from)}</div>
            </div>
            <div className="rounded-xl bg-cream border border-line p-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-inksoft">{STR[lang].to}</div>
              <div className="text-[14px] font-bold mt-0.5">{fmtDay(b.to)}</div>
            </div>
          </div>
          <div className="text-[12.5px] text-inksoft text-center -mt-1">{STR[lang].night_n(b.nights || 0)}</div>
          <div className="rounded-xl border border-line px-3.5">
            {b.phone && <MetaRow icon="phone" label={STR[lang].bd_phone} value={b.phone} href={`tel:${b.phone}`} />}
            {tg && <MetaRow icon="tg" label="Telegram" value={"@" + tg} href={`https://t.me/${tg}`} />}
            {b.email && <MetaRow icon="mail" label="Email" value={b.email} href={`mailto:${b.email}`} />}
            <MetaRow icon="clipboard" label={STR[lang].bd_ref} value={b.otaRef || b.id} />
            {b.created && <MetaRow icon="cal" label={STR[lang].bd_booked} value={fmtDay(b.created)} />}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="font-serif text-[16px]">{STR[lang].total}</span>
            <span className="font-bold text-[20px] tnum">${b.total ?? "—"}</span>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ---- manual booking form (external: verbal / OLX / Booking.com) ----
function ManualBookingForm({ lang, STR, apartments, onDone }) {
  const apts = apartments || [];
  const [aptId, setAptId] = useState(apts[0]?.id || "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [guest, setGuest] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("manual");
  const [nightly, setNightly] = useState(""); // PER-NIGHT price (blank = use the listing's nightly)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const apt = apts.find((a) => a.id === aptId);
  const nights = from && to ? Math.round((new Date(to) - new Date(from)) / 86400000) : 0;
  const price = nightly !== "" ? +nightly : (apt?.price || 0); // per night
  const total = nights > 0 ? price * nights : 0;               // total_usd = per night × nights
  const fld = "mt-1.5 w-full h-12 px-4 rounded-xl bg-white border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[15px]";
  const T = (ru, uz, en) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const msgs = { required: T("Заполните квартиру и даты", "Kvartira va sanalarni toʻldiring", "Fill apartment and dates"), dates: T("Выезд должен быть позже заезда", "Ketish kelishdan keyin boʻlsin", "Check-out must be after check-in"), overlap: T("Эти даты уже заняты", "Bu sanalar allaqachon band", "These dates are already taken"), fail: T("Не удалось", "Boʻlmadi", "Failed") };
  async function submit() {
    setErr("");
    if (!aptId || !from || !to) { setErr("required"); return; }
    if (nights <= 0) { setErr("dates"); return; }
    setBusy(true);
    try {
      await createManualBooking({ apartmentId: aptId, guestName: guest, phone, from, to, total, source });
      onDone();
    } catch (e) {
      setBusy(false);
      setErr(/exclusion|overlap|conflicting/i.test(e.message || "") ? "overlap" : "fail");
    }
  }
  return (
    <div className="space-y-4 pb-2">
      <label className="block"><span className="text-[13px] font-bold">{T("Квартира", "Kvartira", "Apartment")}</span>
        <select value={aptId} onChange={(e) => setAptId(e.target.value)} className={fld}>
          {apts.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.title[lang]}</option>)}
        </select></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-[13px] font-bold">{STR[lang].checkin}</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fld} /></label>
        <label className="block"><span className="text-[13px] font-bold">{STR[lang].checkout}</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fld} /></label>
      </div>
      <label className="block"><span className="text-[13px] font-bold">{STR[lang].a_guest}</span><input value={guest} onChange={(e) => setGuest(e.target.value)} placeholder={STR[lang].name_ph} className={fld} /></label>
      <label className="block"><span className="text-[13px] font-bold">{STR[lang].phone}</span>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-inksoft font-semibold pointer-events-none">+</span>
          <input value={phone.replace(/^\+/, "")} inputMode="tel" placeholder="998 90 123 45 67" className={fld + " pl-8"}
            onChange={(e) => setPhone("+" + e.target.value.replace(/[^\d\s\-()]/g, ""))}
            onBlur={() => setPhone((p) => { const d = p.replace(/\D/g, ""); return d.length === 9 ? "+998" + d : p; })} />
        </div></label>
      <div>
        <span className="text-[13px] font-bold">{STR[lang].a_source}</span>
        <div className="grid grid-cols-2 gap-2.5 mt-1.5">
          {[["manual", STR[lang].src_manual], ["booking", STR[lang].src_booking]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setSource(k)} className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-[14px] font-semibold transition ${source === k ? "border-green-600 bg-green-50 text-green-700" : "border-line bg-white text-ink"}`}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: SRC[k].color }} />{label}
            </button>
          ))}
        </div>
      </div>
      <label className="block"><span className="text-[13px] font-bold">{STR[lang].a_price} ($)</span>
        <input type="number" value={nightly} onChange={(e) => setNightly(e.target.value)} placeholder={apt ? String(apt.price) : "0"} className={fld + " tnum"} />
        {nights > 0 && <div className="text-[12px] text-inksoft mt-1.5">${price} × {STR[lang].night_n(nights)} = <b className="text-ink tnum">${total}</b></div>}
      </label>
      {err && <div className="text-[13px] text-[#9a4a3c] bg-red-50 rounded-lg p-3">{msgs[err]}</div>}
      <Button full size="lg" icon="check" onClick={submit} disabled={busy} className={busy ? "opacity-60 pointer-events-none" : ""}>{busy ? "…" : T("Добавить бронь", "Bron qoʻshish", "Add booking")}</Button>
    </div>
  );
}

// ---- early checkout: shorten a stay, prorate the total, show the guest refund ----
function EarlyCheckoutForm({ lang, STR, b, onDone }) {
  const M = MASKAN;
  const T = (ru, uz, en) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const shift = (iso, n) => M.iso(M.addDays(new Date(iso), n));
  const minDate = shift(b.from, 1);
  const maxDate = shift(b.to, -1);
  const todayIso = M.iso(M.TODAY);
  const [date, setDate] = useState(todayIso < minDate ? minDate : todayIso > maxDate ? maxDate : todayIso);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const oldNights = b.nights || Math.round((new Date(b.to) - new Date(b.from)) / 86400000) || 1;
  const newNights = date ? Math.max(0, Math.round((new Date(date) - new Date(b.from)) / 86400000)) : 0;
  const newTotal = b.total != null ? Math.round((b.total / oldNights) * newNights) : null;
  const refund = b.total != null && newTotal != null ? b.total - newTotal : null;
  const valid = date && date >= minDate && date <= maxDate && newNights >= 1;
  const fld = "mt-1.5 w-full h-12 px-4 rounded-xl bg-white border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[15px]";
  async function submit() {
    setBusy(true); setErr("");
    try { onDone(await shortenBooking(b.id, date)); }
    catch (e) { setErr(e.message || "fail"); setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <div className="text-[13px] text-inksoft">{b.guest} · {fmtRange(new Date(b.from), new Date(b.to), lang)} · {STR[lang].night_n(oldNights)} · ${b.total ?? "—"}</div>
      <label className="block">
        <span className="text-[12px] font-bold text-inksoft">{T("Новая дата выезда", "Yangi chiqish sanasi", "New checkout date")}</span>
        <input type="date" value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} className={fld + " tnum"} />
      </label>
      <div className="rounded-xl bg-cream border border-line p-3.5 text-[13.5px] space-y-1.5">
        <div className="flex justify-between"><span className="text-inksoft">{T("Ночей", "Kechalar", "Nights")}</span><span className="font-semibold tnum">{oldNights} → {newNights}</span></div>
        <div className="flex justify-between"><span className="text-inksoft">{T("Новая сумма", "Yangi summa", "New total")}</span><span className="font-semibold tnum">${newTotal ?? "—"}</span></div>
        <div className="flex justify-between text-green-700 border-t border-line pt-1.5"><span className="font-semibold">{T("К возврату гостю", "Mehmonga qaytariladi", "Refund to guest")}</span><span className="font-bold tnum">${refund ?? "—"}</span></div>
      </div>
      {err && <div className="text-[13px] text-[#9a4a3c] bg-red-50 rounded-lg p-3">{err}</div>}
      <Button full size="lg" icon="check" onClick={submit} disabled={busy || !valid} className={busy || !valid ? "opacity-60 pointer-events-none" : ""}>
        {busy ? "…" : T("Подтвердить ранний выезд", "Erta chiqishni tasdiqlash", "Confirm early checkout")}
      </Button>
    </div>
  );
}

// ---- bookings list ----
function BookingsList({ lang, STR, bookings, apartments, onChanged, onOpenDetail }) {
  const T = (ru, uz, en) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("active"); // default: just active bookings (keeps the list short)
  const [source, setSource] = useState("all");     // all | website | booking | manual
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(25);           // grow via "show more" so the page never gets huge
  const list = bookings || [];

  const aptTitle = (id) => { const a = (apartments || []).find((x) => x.id === id); return a ? a.title[lang] : ""; };
  const matchStatus = (b, s) => s === "all" || (s === "done" ? (b.status === "past" || b.status === "checked-out") : b.status === s);
  const matchSource = (b, k) => k === "all" || b.source === k;
  const q = query.trim().toLowerCase();
  const matchQuery = (b) => !q || [b.guest, b.id, b.phone, aptTitle(b.apt)].some((v) => (v || "").toLowerCase().includes(q));
  const filtered = list.filter((b) => matchStatus(b, status) && matchSource(b, source) && matchQuery(b));
  const shown = filtered.slice(0, limit);
  // counts stay contextual to the other dimensions + the search
  const statusCount = (s) => list.filter((b) => matchSource(b, source) && matchQuery(b) && matchStatus(b, s)).length;
  const sourceCount = (k) => list.filter((b) => matchStatus(b, status) && matchQuery(b) && matchSource(b, k)).length;
  useEffect(() => { setLimit(25); }, [status, source, query]); // a new filter/search resets the window

  const statusOpts = [["all", STR[lang].a_all], ["active", STR[lang].tab_active], ["cancelled", STR[lang].tab_cancelled], ["done", STR[lang].st_completed]];
  const sourceOpts = [["all", STR[lang].a_all, null], ["website", STR[lang].src_website, SRC.website.color], ["booking", STR[lang].src_booking, SRC.booking.color], ["manual", STR[lang].src_manual, SRC.manual.color]];

  return (
    <div>
      {/* sticky controls: search + add, then status / source filter rows */}
      <div className="sticky top-0 z-20 bg-canvas pt-1 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1 min-w-0">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inksoft pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={T("Поиск: гость, №, квартира, телефон", "Qidiruv: mehmon, №, kvartira, telefon", "Search: guest, no., apartment, phone")}
              className="w-full h-11 pl-9 pr-3 rounded-xl bg-white border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[14px]" />
          </div>
          <Button icon="plusbox" onClick={() => setAdding(true)} className="shrink-0">{T("Добавить", "Qoʻshish", "Add")}</Button>
        </div>
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {statusOpts.map(([k, label]) => (
              <Chip key={k} active={status === k} onClick={() => setStatus(k)}>
                <span>{label}</span><span className="tnum text-[11px] opacity-55">{statusCount(k)}</span>
              </Chip>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {sourceOpts.map(([k, label, color]) => (
              <Chip key={k} active={source === k} onClick={() => setSource(k)}>
                {color && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
                <span>{label}</span><span className="tnum text-[11px] opacity-55">{sourceCount(k)}</span>
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {shown.length === 0
          ? <div className="text-[14px] text-inksoft py-8 text-center border border-dashed border-line rounded-2xl">—</div>
          : shown.map((b) => <BookingRow key={b.id} b={b} lang={lang} STR={STR} onOpen={onOpenDetail} apartments={apartments} />)}
      </div>
      {filtered.length > shown.length && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + 25)}>{T("Показать ещё", "Yana koʻrsatish", "Show more")} ({filtered.length - shown.length})</Button>
        </div>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title={lang === "ru" ? "Ручная бронь" : lang === "uz" ? "Qoʻlda bron" : "Manual booking"} desktop>
        <ManualBookingForm lang={lang} STR={STR} apartments={apartments} onDone={() => { setAdding(false); onChanged && onChanged(); }} />
      </Sheet>
    </div>
  );
}

// ---- listings ----
function Listings({ lang, STR, onEdit, apartments }) {
  const M = MASKAN;
  const apts = apartments || [];
  return (
    <div>
      <div className="flex justify-end mb-4"><Button icon="plusbox" onClick={() => onEdit("new")}>{STR[lang].a_add}</Button></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {apts.map((a) => (
          <button key={a.id} onClick={() => onEdit(a.id)} className="text-left rounded-2xl border border-line bg-white overflow-hidden hover:shadow-card transition group">
            <div className="aspect-[16/10] relative"><Photo tone={a.tone} idx={0} eager showLabel={false} src={a.photoUrls?.[0]} className="w-full h-full group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute top-2.5 right-2.5"><Badge tone="cream">${a.price}</Badge></div></div>
            <div className="p-3.5">
              <div className="font-serif text-[15px] leading-snug truncate">{a.title[lang]}</div>
              <div className="text-[12.5px] text-inksoft mt-1">{M.DISTRICTS[a.district][lang]} · {STR[lang].sleeps(a.sleeps)}</div>
              {/* admin-only: apartment id (left) + copy button (right) — for the Beds24 room mapping */}
              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-[11px] font-mono text-inksoft/80 truncate"><span className="text-inksoft/55">ID:</span> <span className="select-all">{a.id}</span></span>
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(a.id); }}
                  title={lang === "ru" ? "Скопировать ID" : lang === "uz" ? "ID nusxa olish" : "Copy ID"}
                  className="shrink-0 w-6 h-6 grid place-items-center rounded text-inksoft hover:text-ink hover:bg-black/[.06] cursor-pointer">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- add/edit with photo uploader ----
function EditApt({ lang, STR, id, onBack, apartments, onSaved }) {
  const M = MASKAN;
  const apt = id === "new" ? null : (apartments || []).find((a) => a.id === id);
  const tone = apt ? apt.tone : "sage";
  const count = apt ? apt.photos : 6;
  const [cover, setCover] = useState(0);
  const [dragIdx, setDragIdx] = useState(null);
  function reorderPhotos(from, to) {
    if (from == null || to == null || from === to) return;
    const next = photos.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPhotos(next);
    setPhotoOrder(next.map((p, i) => ({ id: p.id, sort: i, is_cover: i === 0 }))).catch((e) => console.error("reorder failed:", e));
  }
  const [titleI18n, setTitleI18n] = useState(apt ? { uz: apt.title?.uz || "", ru: apt.title?.ru || "", en: apt.title?.en || "" } : { uz: "", ru: "", en: "" });
  const [blurbI18n, setBlurbI18n] = useState(apt ? { uz: apt.blurb?.uz || "", ru: apt.blurb?.ru || "", en: apt.blurb?.en || "" } : { uz: "", ru: "", en: "" });
  const [nearI18n, setNearI18n] = useState(apt ? { uz: apt.near?.uz || "", ru: apt.near?.ru || "", en: apt.near?.en || "" } : { uz: "", ru: "", en: "" });
  const [editLang, setEditLang] = useState(lang);
  const [saving, setSaving] = useState(false);
  // New apartments get a human-friendly 6-digit numeric id (no letters), unique among
  // the loaded list; the DB primary key is the final guard. Existing ones keep their id.
  const [aptId] = useState(() => {
    if (apt?.id) return apt.id;
    const taken = new Set((apartments || []).map((a) => a.id));
    let n; do { n = String(100000 + Math.floor(Math.random() * 900000)); } while (taken.has(n));
    return n;
  });
  const [photos, setPhotos] = useState([]);
  const fileRef = useRef(null);
  const createdRef = useRef(false); // becomes true once the new apartment row is inserted
  useEffect(() => { if (apt?.id) getPhotos(apt.id).then(setPhotos); }, []);
  const [price, setPrice] = useState(apt ? apt.price : 35);
  const [amen, setAmen] = useState(apt ? apt.amenities : ["wifi", "ac", "kitchen"]);
  const [guests, setGuests] = useState(apt ? (apt.sleeps ?? 2) : 2);
  const [beds, setBeds] = useState(apt ? apt.beds : 1);
  const [livingRooms, setLivingRooms] = useState(apt ? (apt.livingRooms ?? 0) : 0);
  const [baths, setBaths] = useState(apt ? apt.baths : 1);
  const [size, setSize] = useState(apt ? apt.size : 40);
  const [district, setDistrict] = useState(apt ? apt.district : "mirobod");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState(apt?.lat ?? null);
  const [lng, setLng] = useState(apt?.lng ?? null);
  const [checkIn, setCheckIn] = useState(apt?.checkInTime || "14:00");
  const [checkOut, setCheckOut] = useState(apt?.checkOutTime || "12:00");
  const [beds24Room, setBeds24Room] = useState(apt?.beds24RoomId || "");
  const [beds24Prop, setBeds24Prop] = useState(apt?.beds24PropId || "");
  const allAmen = Object.keys(M.AMENITIES);
  const fld = "mt-1.5 w-full h-12 px-4 rounded-xl bg-white border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[15px]";
  const langTabs = (
    <div className="flex gap-1">
      {[["uz", "UZ"], ["ru", "RU"], ["en", "EN"]].map(([k, label]) => (
        <button key={k} type="button" onClick={() => setEditLang(k)} className={`h-7 px-2.5 rounded-full text-[11.5px] font-bold transition ${editLang === k ? "bg-ink text-cream" : "bg-black/[.04] text-inksoft hover:text-ink"}`}>{label}</button>
      ))}
    </div>
  );
  function buildRow() {
    return { id: aptId, tone, price_usd: Number(price) || 0, district, sleeps: Number(guests) || 1, beds: Number(beds) || 0, living_rooms: Number(livingRooms) || 0, baths: Number(baths) || 1, size_m2: Number(size) || 0, lat, lng, check_in_time: checkIn || "14:00", check_out_time: checkOut || "12:00", beds24_room_id: beds24Room.trim() || null, beds24_prop_id: beds24Prop.trim() || null, host: apt?.host || "Maskan", title: titleI18n, blurb: blurbI18n, near: nearI18n, amenities: amen, photos_count: photos.length || count, status: "active" };
  }
  async function persistApartment() {
    // First write of a NEW apartment uses insert so a colliding 6-digit id errors
    // instead of silently overwriting another apartment; later writes (and edits of an
    // existing apartment) upsert.
    await saveApartment(buildRow(), address, { create: !apt && !createdRef.current });
    createdRef.current = true;
  }
  async function save() {
    setSaving(true);
    try { await persistApartment(); if (onSaved) await onSaved(); onBack(); }
    catch (e) { console.error("saveApartment failed:", e); setSaving(false); }
  }
  async function resizeImage(file, maxW = 1600, quality = 0.82) {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    return await new Promise((res) => c.toBlob(res, "image/webp", quality));
  }
  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSaving(true);
    try {
      await persistApartment(); // ensure the apartment row exists (FK)
      let sort = photos.length;
      for (const f of files) {
        const blob = await resizeImage(f);
        const { url, publicUrl } = await requestUploadUrl(aptId, "image/webp");
        const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: blob });
        if (!put.ok) throw new Error("put_failed");
        await addPhoto(aptId, publicUrl, sort, sort === 0);
        sort++;
      }
      setPhotos(await getPhotos(aptId));
    } catch (err) { console.error("upload failed:", err); }
    setSaving(false);
    if (fileRef.current) fileRef.current.value = "";
  }
  async function removePhoto(p) { await deletePhoto(p.id); setPhotos(await getPhotos(aptId)); }
  async function remove() {
    const msg = lang === "ru" ? "Удалить квартиру и все её фото и брони?" : lang === "uz" ? "Kvartira va uning barcha rasm/bronlari oʻchirilsinmi?" : "Delete this apartment and all its photos/bookings?";
    if (!window.confirm(msg)) return;
    setSaving(true);
    try { await deleteApartment(apt.id); if (onSaved) await onSaved(); onBack(); }
    catch (e) { console.error("delete failed:", e); setSaving(false); }
  }
  return (
    <div className="max-w-3xl">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-inksoft mb-4 hover:text-ink"><Icon name="arrowL" size={16} />{STR[lang].a_listings}</button>
      {/* photo uploader */}
      <div className="mb-7">
        <div className="text-[13px] font-bold uppercase tracking-wide text-inksoft mb-3">{STR[lang].a_photos}</div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {photos.map((p, k) => (
            <div key={p.id}
              draggable
              onDragStart={() => setDragIdx(k)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); reorderPhotos(dragIdx, k); setDragIdx(null); }}
              onDragEnd={() => setDragIdx(null)}
              className={`relative aspect-square rounded-xl overflow-hidden group border cursor-move transition [&_img]:pointer-events-none ${dragIdx === k ? "opacity-40 ring-2 ring-green-600 border-green-600" : "border-line"}`}>
              <Photo tone={tone} idx={k} src={p.url} eager showLabel={false} className="w-full h-full" />
              {k === 0 && <div className="absolute top-1.5 left-1.5"><Badge tone="green">{STR[lang].a_cover}</Badge></div>}
              <button onClick={() => removePhoto(p)} className="absolute top-1.5 right-1.5 w-7 h-7 rounded-md bg-white/90 grid place-items-center text-[#9a4a3c] opacity-0 group-hover:opacity-100"><Icon name="trash" size={14} /></button>
            </div>
          ))}
          <button onClick={() => fileRef.current?.click()} disabled={saving} className="aspect-square rounded-xl border-2 border-dashed border-line grid place-items-center text-inksoft hover:border-green-600 hover:text-green-700 transition disabled:opacity-50">
            <div className="text-center px-2"><Icon name={saving ? "refresh" : "plus"} size={22} className={`mx-auto ${saving ? "animate-spin" : ""}`} /><div className="text-[10.5px] font-semibold mt-1 leading-tight">{saving ? "…" : STR[lang].a_drop}</div></div>
          </button>
        </div>
        <p className="text-[12px] text-inksoft mt-2">{lang === "ru" ? "Перетащите фото мышкой, чтобы изменить порядок. Первое фото — обложка. Авто-сжатие (WebP) → R2." : lang === "uz" ? "Tartibni o'zgartirish uchun rasmni sichqoncha bilan suring. Birinchi rasm — muqova. Avto-siqish (WebP) → R2." : "Drag photos to reorder. The first photo is the cover. Auto-compressed (WebP) → R2."}</p>
      </div>
      {/* title (3 languages) */}
      <label className="block mb-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold">{lang === "ru" ? "Название" : lang === "uz" ? "Nomi" : "Title"}</span>
          {langTabs}
        </div>
        <textarea rows={2} value={titleI18n[editLang]} onChange={(e) => setTitleI18n({ ...titleI18n, [editLang]: e.target.value })} placeholder={lang === "ru" ? "Напр. Светлая студия в центре" : lang === "uz" ? "Masalan, Markazdagi yorug studiya" : "e.g. Bright studio in the centre"}
          className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[15px] resize-y leading-snug" />
      </label>
      {/* basics */}
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <label className="block"><span className="text-[13px] font-bold">{STR[lang].a_price} ($)</span>
          <input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} className={fld + " tnum"} /></label>
        <label className="block"><span className="text-[13px] font-bold">{STR[lang].district}</span>
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className={fld}>
            {Object.keys(M.DISTRICTS).map((k) => <option key={k} value={k}>{M.DISTRICTS[k][lang]}</option>)}</select></label>
      </div>

      {/* capacity */}
      <div className="rounded-2xl border border-line bg-white p-4 mb-5">
        <div className="flex items-center justify-between">
          <div><div className="text-[14px] font-bold">{STR[lang].a_guests_field}</div><div className="text-[12px] text-inksoft">{lang === "ru" ? "Всего мест (взрослые + дети)" : lang === "uz" ? "Jami sigʻim (kattalar + bolalar)" : "Total capacity (adults + children)"}</div></div>
          <Stepper value={guests} min={1} max={16} onChange={setGuests} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-line">
          <NumF label={STR[lang].a_beds} value={beds} set={setBeds} min={0} />
          <NumF label={STR[lang].a_living} value={livingRooms} set={setLivingRooms} min={0} />
          <NumF label={STR[lang].a_baths} value={baths} set={setBaths} min={1} />
          <NumF label={STR[lang].a_size} value={size} set={setSize} min={10} max={500} />
        </div>
      </div>

      {/* house rules — check-in / check-out times (local property time) */}
      <div className="rounded-2xl border border-line bg-white p-4 mb-5">
        <div className="text-[14px] font-bold mb-3">{STR[lang].house_rules}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[13px] font-bold">{STR[lang].checkin}</span>
            <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={fld + " tnum"} /></label>
          <label className="block"><span className="text-[13px] font-bold">{STR[lang].checkout}</span>
            <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={fld + " tnum"} /></label>
        </div>
      </div>

      {/* description (3 languages) */}
      <label className="block mb-6">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold">{STR[lang].a_desc}</span>
          {langTabs}
        </div>
        <textarea rows={10} value={blurbI18n[editLang]} onChange={(e) => setBlurbI18n({ ...blurbI18n, [editLang]: e.target.value })} placeholder={STR[lang].a_desc_ph}
          className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[15px] resize-y min-h-[140px] leading-relaxed" />
        <div className="text-[11.5px] text-inksoft mt-1 text-right tnum">{(blurbI18n[editLang] || "").length} {lang === "ru" ? "символов" : lang === "uz" ? "belgi" : "chars"}</div>
      </label>

      {/* near / landmark — public, shown next to the pin in the catalog */}
      <label className="block mb-6">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold">{STR[lang].a_near}</span>
          {langTabs}
        </div>
        <input value={nearI18n[editLang]} onChange={(e) => setNearI18n({ ...nearI18n, [editLang]: e.target.value })} placeholder={STR[lang].a_near_ph} className={fld} />
      </label>

      {/* location pick + exact address */}
      <div className="mb-6">
        <div className="text-[13px] font-bold mb-2">{STR[lang].a_location}</div>
        <MapPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
        <p className="text-[12px] text-inksoft mt-2">{STR[lang].a_location_help}</p>

        <label className="block mt-4">
          <span className="text-[13px] font-bold flex items-center gap-1.5"><Icon name="shield" size={15} className="text-green-700" />{STR[lang].a_address}</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={STR[lang].a_address_ph} className={fld} />
          <div className="flex items-start gap-2 mt-2 text-[12px] text-green-900 bg-green-50 rounded-lg p-2.5"><Icon name="shield" size={14} className="text-green-700 shrink-0 mt-0.5" /><span>{STR[lang].a_address_help}</span></div>
        </label>
      </div>

      {/* amenities */}
      <div className="mb-7">
        <div className="text-[13px] font-bold mb-2.5">{STR[lang].amenities}</div>
        <div className="flex flex-wrap gap-2">
          {allAmen.map((a) => <Chip key={a} active={amen.includes(a)} icon={AMENITY_ICON[a]} onClick={() => setAmen(amen.includes(a) ? amen.filter((x) => x !== a) : [...amen, a])}>{M.AMENITIES[a][lang]}</Chip>)}
        </div>
      </div>

      {/* Beds24 channel mapping (optional; for two-way OTA sync) */}
      <div className="rounded-2xl border border-line bg-white p-4 mb-7">
        <div className="text-[14px] font-bold mb-0.5">Beds24</div>
        <div className="text-[12px] text-inksoft mb-3">{lang === "ru" ? "ID для синхронизации с Beds24 (необязательно)" : lang === "uz" ? "Beds24 sinxroni uchun ID (ixtiyoriy)" : "IDs for Beds24 sync (optional)"}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[13px] font-bold">Room ID</span>
            <input inputMode="numeric" value={beds24Room} onChange={(e) => setBeds24Room(e.target.value.replace(/\D/g, ""))} placeholder="693405" className={fld + " tnum"} /></label>
          <label className="block"><span className="text-[13px] font-bold">Property ID</span>
            <input inputMode="numeric" value={beds24Prop} onChange={(e) => setBeds24Prop(e.target.value.replace(/\D/g, ""))} placeholder="334998" className={fld + " tnum"} /></label>
        </div>
      </div>

      <div className="flex gap-3 items-center"><Button onClick={save} disabled={saving} className={saving ? "opacity-60 pointer-events-none" : ""}>{STR[lang].a_save}</Button><Button variant="ghost" onClick={onBack}>{STR[lang].back}</Button>{apt && <button onClick={remove} className="ml-auto inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#9a4a3c] hover:bg-red-50 h-10 px-3 rounded-full"><Icon name="trash" size={16} />{lang === "ru" ? "Удалить" : lang === "uz" ? "Oʻchirish" : "Delete"}</button>}</div>
    </div>
  );
}

// ---- 404 (what non-admins see) ----
function Admin404({ lang, STR, onBack }) {
  return (
    <div className="min-h-screen bg-canvas grid place-items-center px-5 relative">
      <div className="text-center fade-up max-w-sm">
        <div className="font-serif text-[72px] text-green-900/15 leading-none">404</div>
        <h1 className="font-serif text-[24px] mt-1">{STR[lang].a_404}</h1>
        <p className="text-inksoft text-[14px] mt-2">{STR[lang].a_404_sub}</p>
        <button onClick={onBack} className="mt-7 text-[12.5px] font-semibold text-inksoft hover:text-ink underline underline-offset-2">← admin login (prototype)</button>
      </div>
    </div>
  );
}

// ---- Telegram sign-in alert (owner notification concept) ----
function LoginAlert({ lang, STR, onClose }) {
  return (
    <div className="fixed top-4 right-4 z-50 w-[310px] rounded-2xl bg-ink text-cream shadow-pop p-3.5 flex gap-3 pop-in">
      <div className="w-9 h-9 rounded-full bg-[#229ED9] grid place-items-center shrink-0"><Icon name="tg" size={19} className="text-white" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold">{STR[lang].a_alert_title}</div>
        <div className="text-[12px] opacity-80 mt-0.5 leading-snug">{STR[lang].a_alert_sub}</div>
        <div className="text-[11px] opacity-55 mt-1.5">Maskan Security bot · {lang === "ru" ? "сейчас" : lang === "uz" ? "hozir" : "now"}</div>
      </div>
      <button onClick={onClose} className="shrink-0 w-6 h-6 grid place-items-center rounded-full hover:bg-white/10 opacity-70"><Icon name="x" size={15} /></button>
    </div>
  );
}

// ---- login (email + password + 2FA) ----
function AdminLogin({ lang, STR, onLogin, onExit }) {
  const [step, setStep] = useState("creds");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [refs] = useState(() => Array.from({ length: 6 }, () => createRef()));
  const [show404, setShow404] = useState(false);
  const fld = "mt-1.5 w-full h-12 px-4 rounded-xl bg-canvas border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[15px]";

  function setDigit(i, v) {
    if (!/^\d?$/.test(v)) return;
    const next = [...code]; next[i] = v; setCode(next);
    if (v && i < 5) refs[i + 1].current && refs[i + 1].current.focus();
    if (next.every((c) => c)) setTimeout(onLogin, 300);
  }

  if (show404) return <Admin404 lang={lang} STR={STR} onBack={() => setShow404(false)} />;

  return (
    <div className="min-h-screen bg-canvas grid place-items-center px-5">
      <div className="w-full max-w-sm fade-up">
        <div className="flex justify-center mb-6"><Logo size={40} /></div>
        <div className="rounded-3xl border border-line bg-white p-7 shadow-card">
          <div className="flex items-center justify-center gap-1.5 mb-1"><Icon name="lock" size={15} className="text-green-700" /><span className="text-[11px] font-bold tracking-[0.12em] uppercase text-green-700">{STR[lang].a_secure}</span></div>
          {step === "creds" ? (
            <>
              <h1 className="font-serif text-[23px] text-center">{STR[lang].admin_login}</h1>
              <p className="text-[13px] text-inksoft text-center mt-1 mb-6">admin.maskan.uz</p>
              <label className="block mb-4"><span className="text-[13px] font-bold">{STR[lang].a_email}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@maskan.uz" className={fld} /></label>
              <label className="block"><span className="text-[13px] font-bold">{STR[lang].password}</span>
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setStep("2fa")} placeholder="••••••••" className={fld} /></label>
              <div className="mt-6"><Button full size="lg" icon="arrowR" onClick={() => setStep("2fa")}>{STR[lang].a_signin}</Button></div>
            </>
          ) : (
            <div className="fade-up text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-700 grid place-items-center mx-auto mb-3"><Icon name="shield" size={26} /></div>
              <h1 className="font-serif text-[22px]">{STR[lang].a_2fa_title}</h1>
              <p className="text-[13px] text-inksoft mt-1.5 mb-5">{STR[lang].a_2fa_sub}</p>
              <div className="flex justify-center gap-2">
                {code.map((c, i) => (
                  <input key={i} ref={refs[i]} value={c} onChange={(e) => setDigit(i, e.target.value)} inputMode="numeric" maxLength={1}
                    className="w-11 h-14 text-center text-[22px] font-bold rounded-xl bg-canvas border-2 border-line focus:border-green-600 outline-none tnum" />
                ))}
              </div>
              <div className="mt-6"><Button full size="lg" onClick={onLogin}>{STR[lang].a_signin}</Button></div>
              <button onClick={() => setStep("creds")} className="mt-3 text-[13px] font-semibold text-inksoft hover:text-ink">← {STR[lang].back}</button>
            </div>
          )}
        </div>
        {/* security note */}
        <div className="flex items-start gap-2.5 mt-4 px-1 text-[11.5px] text-inksoft leading-snug">
          <Icon name="bell" size={15} className="text-green-700 shrink-0 mt-0.5" /><span>{STR[lang].a_alert_sub}</span>
        </div>
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={onExit} className="text-[12.5px] font-semibold text-inksoft hover:text-ink">← {STR[lang].catalog}</button>
          <span className="text-line">·</span>
          <button onClick={() => setShow404(true)} className="text-[12.5px] font-semibold text-inksoft/70 hover:text-ink">{lang === "ru" ? "Что видят гости" : lang === "uz" ? "Mehmonlar nimani ko‘radi" : "What guests see"}</button>
        </div>
      </div>
    </div>
  );
}

// ---- reviews moderation (soft-hide + audit + reply) ----
function ReviewsModeration({ lang, STR, apartments }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    getAllReviews().then((rows) => {
      const apts = apartments || [];
      setItems(rows.map((r) => ({
        ...r,
        _apt: apts.find((a) => a.id === r.apartment_id) || { title: { [lang]: r.apartment_id } },
        _id: r.id,
        hidden: r.hidden,
        reply: r.host_reply || "",
      })));
    });
  }, [apartments, lang]);
  const [audit, setAudit] = useState([]);
  const [hideFor, setHideFor] = useState(null);
  const [replyFor, setReplyFor] = useState(null);
  const [replyText, setReplyText] = useState("");

  const now = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const log = (e) => setAudit((a) => [{ ...e, when: now(), who: "Dilnoza (admin)" }, ...a]);

  async function doHide(it, reason) {
    setItems((xs) => xs.map((x) => x._id === it._id ? { ...x, hidden: true } : x));
    log({ action: STR[lang].a_hide, reason, target: `${it.name} · ${it._apt.title[lang].slice(0, 24)}…` });
    setHideFor(null);
    await setReviewHidden(it._id, true, reason);
  }
  async function unhide(it) {
    setItems((xs) => xs.map((x) => x._id === it._id ? { ...x, hidden: false } : x));
    log({ action: STR[lang].a_unhide, reason: "—", target: `${it.name} · ${it._apt.title[lang].slice(0, 24)}…` });
    await setReviewHidden(it._id, false);
  }
  async function saveReply(it) {
    const txt = replyText;
    setItems((xs) => xs.map((x) => x._id === it._id ? { ...x, reply: txt } : x));
    log({ action: STR[lang].a_reply, reason: "—", target: `${it.name} · ${it._apt.title[lang].slice(0, 24)}…` });
    setReplyFor(null); setReplyText("");
    await setReviewReply(it._id, txt);
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
      <div className="space-y-3 max-w-2xl">
        <div className="flex items-center gap-2 text-[12.5px] text-inksoft mb-1"><Icon name="lock" size={14} className="text-green-700" />{STR[lang].cannot_edit}</div>
        {items.map((it) => (
          <div key={it._id} className={`rounded-2xl border bg-white p-4 transition ${it.hidden ? "border-line opacity-60" : "border-line"}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-700 text-cream grid place-items-center font-serif text-[14px] shrink-0">{it.name[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-[13.5px]">{it.name}</span>
                  {it.hidden && <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-inksoft/12 text-inksoft text-[10.5px] font-bold"><Icon name="eyeoff" size={11} />{STR[lang].a_hidden}</span>}
                </div>
                <div className="text-[11.5px] text-inksoft truncate">{it._apt.title[lang]}</div>
              </div>
              <StarRow value={it.rating} size={12} />
            </div>
            {it.cons && <div className="text-[12.5px] text-[#9a4a3c] mt-2"><b>{STR[lang].minuses}:</b> {it.cons}</div>}
            <p className={`text-[13.5px] mt-1.5 ${it.hidden ? "line-through text-inksoft" : "text-ink/85"}`}>{it.text}</p>

            {it.reply && (
              <div className="mt-3 ml-4 pl-3 border-l-2 border-green-600/40">
                <div className="text-[11.5px] font-bold text-green-700 flex items-center gap-1.5"><Icon name="reply" size={12} />{STR[lang].host_reply}</div>
                <p className="text-[13px] text-ink/80 mt-0.5">{it.reply}</p>
              </div>
            )}

            {/* reason picker */}
            {hideFor === it._id ? (
              <div className="mt-3 pt-3 border-t border-line">
                <div className="text-[12px] font-bold mb-2">{STR[lang].a_hide_reason}</div>
                <div className="flex flex-wrap gap-2">
                  {STR[lang].a_hide_reasons.map((r) => <Chip key={r} onClick={() => doHide(it, r)}>{r}</Chip>)}
                  <button onClick={() => setHideFor(null)} className="text-[12.5px] text-inksoft px-2 hover:text-ink">{STR[lang].back}</button>
                </div>
              </div>
            ) : replyFor === it._id ? (
              <div className="mt-3 pt-3 border-t border-line">
                <textarea autoFocus rows={2} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={STR[lang].a_reply_ph}
                  className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-line outline-none focus:border-green-600 text-[14px] resize-none" />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => saveReply(it)}>{STR[lang].a_send_reply}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setReplyFor(null); setReplyText(""); }}>{STR[lang].back}</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line">
                {it.hidden
                  ? <button onClick={() => unhide(it)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-green-700 h-8 px-2.5 rounded-full hover:bg-green-50"><Icon name="refresh" size={14} />{STR[lang].a_unhide}</button>
                  : <button onClick={() => setHideFor(it._id)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9a4a3c] h-8 px-2.5 rounded-full hover:bg-red-50"><Icon name="eyeoff" size={14} />{STR[lang].a_hide}</button>}
                <button onClick={() => { setReplyFor(it._id); setReplyText(it.reply || ""); }} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-inksoft h-8 px-2.5 rounded-full hover:bg-black/5"><Icon name="reply" size={14} />{STR[lang].a_reply}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* audit log */}
      <aside className="rounded-2xl border border-line bg-white p-4 lg:sticky lg:top-4">
        <div className="flex items-center gap-2 font-serif text-[16px] mb-3"><Icon name="clock" size={16} className="text-green-700" />{STR[lang].a_audit}</div>
        {audit.length === 0 ? <p className="text-[12.5px] text-inksoft">—</p> : (
          <div className="space-y-3">
            {audit.map((e, i) => (
              <div key={i} className="text-[12px] border-l-2 border-line pl-3">
                <div className="font-bold text-ink">{e.action}{e.reason !== "—" ? ` · ${e.reason}` : ""}</div>
                <div className="text-inksoft truncate">{e.target}</div>
                <div className="text-inksoft/70 mt-0.5">{e.who} · {e.when}</div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

// ---- login gate (real Supabase auth; admin role required) ----
function AdminGate({ lang, STR, onLogin, onExit }) {
  return (
    <div className="min-h-screen bg-canvas grid place-items-center px-5">
      <div className="w-full max-w-sm fade-up">
        <div className="flex justify-center mb-6"><Logo size={40} /></div>
        <div className="rounded-3xl border border-line bg-white p-7 shadow-card">
          <div className="flex items-center justify-center gap-1.5 mb-1"><Icon name="lock" size={15} className="text-green-700" /><span className="text-[11px] font-bold tracking-[0.12em] uppercase text-green-700">{STR[lang].a_secure}</span></div>
          <h1 className="font-serif text-[23px] text-center">{STR[lang].admin_login}</h1>
          <p className="text-[13px] text-inksoft text-center mt-1 mb-6">admin.maskan.uz</p>
          <div className="space-y-2.5">
            <button onClick={() => onLogin("google")} className="inline-flex items-center justify-center gap-2.5 w-full rounded-full bg-white border border-line text-ink font-semibold text-[15px] hover:border-ink/30 transition" style={{ height: 52 }}>
              <GoogleG size={19} />{STR[lang].login_google}</button>
            <TelegramLoginButton lang={lang} />
          </div>
          <p className="text-[12px] text-inksoft text-center mt-4">{lang === "ru" ? "Войдите аккаунтом администратора." : lang === "uz" ? "Administrator akkaunti bilan kiring." : "Sign in with an admin account."}</p>
        </div>
        <button onClick={onExit} className="block mx-auto mt-4 text-[12.5px] font-semibold text-inksoft hover:text-ink">← {STR[lang].catalog}</button>
      </div>
    </div>
  );
}

export function Admin({ lang, STR, device, onExit, openLang, role, auth, onLogin }) {
  const [tab, setTab] = useState(() => {
    const parts = (typeof window !== "undefined" ? (window.location.hash || "") : "").replace(/^#/, "").split("/");
    return parts[0] === "admin" && ["dash", "list", "cal", "book", "reviews", "pfile", "suppliers"].includes(parts[1]) ? parts[1] : "dash";
  });
  const [editId, setEditId] = useState(null);
  const [apts, setApts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [detail, setDetail] = useState(null); // booking shown in the detail bottom-sheet
  const [shortenTarget, setShortenTarget] = useState(null); // booking being shortened (early checkout)
  useEffect(() => {
    if (role !== "admin") return;
    getApartments().then(setApts);
    getAllBookings().then(setBookings);
  }, [role]);
  // Browser Back/Forward inside admin: restore the tab (from the hash) + editId (from state).
  useEffect(() => {
    const onPop = (e) => {
      const parts = (window.location.hash || "").replace(/^#/, "").split("/");
      if (parts[0] !== "admin") return; // leaving admin — the App-level handler switches screens
      setTab(["dash", "list", "cal", "book", "reviews", "pfile", "suppliers"].includes(parts[1]) ? parts[1] : "dash");
      setEditId((e.state && e.state.editId) || null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (!auth) return <AdminGate lang={lang} STR={STR} onLogin={onLogin} onExit={onExit} />;
  if (role == null) return <div className="min-h-screen bg-canvas grid place-items-center"><div className="w-10 h-10 rounded-full border-[3px] border-green-600/25 border-t-green-700 animate-spin" /></div>;
  if (role !== "admin") return <Admin404 lang={lang} STR={STR} onBack={onExit} />;

  // navigate within admin via history so Back walks tabs/edit (not straight to the catalog)
  const goTab = (k) => {
    setTab(k); setEditId(null);
    window.history.pushState({ screen: "admin", editId: null }, "", k === "dash" ? "#admin" : "#admin/" + k);
  };
  const goEdit = (id) => {
    setEditId(id);
    window.history.pushState({ screen: "admin", editId: id }, "", tab === "dash" ? "#admin/list" : "#admin/" + tab);
  };
  // cancel from the detail sheet — Admin owns `bookings`, so this propagates to every view (the
  // BookingsList re-syncs its local items from the bookings prop)
  async function cancelFromDetail(b) {
    setBookings((arr) => arr.map((i) => (i.id === b.id ? { ...i, status: "cancelled" } : i)));
    setDetail(null);
    try {
      await cancelBooking(b.id);
    } catch (e) {
      console.error("cancelBooking failed:", e);
      setBookings((arr) => arr.map((i) => (i.id === b.id ? { ...i, status: b.status } : i)));
      window.alert(lang === "ru" ? "Не удалось отменить (Beds24)." : lang === "uz" ? "Bekor qilib boʻlmadi (Beds24)." : "Cancel failed (Beds24).");
    }
  }
  async function deleteFromDetail(b) {
    const msg = lang === "ru" ? "Удалить эту бронь навсегда?" : lang === "uz" ? "Bu bronni butunlay oʻchirilsinmi?" : "Delete this booking permanently?";
    if (!window.confirm(msg)) return;
    setBookings((arr) => arr.filter((i) => i.id !== b.id));
    setDetail(null);
    try {
      await deleteBooking(b.id);
    } catch (e) {
      console.error("deleteBooking failed:", e);
      getAllBookings().then(setBookings); // re-sync to the DB truth
      window.alert(lang === "ru" ? "Не удалось удалить." : lang === "uz" ? "Oʻchirib boʻlmadi." : "Delete failed.");
    }
  }
  function onShortenDone(r) {
    if (shortenTarget) {
      setBookings((arr) => arr.map((i) => (i.id === shortenTarget.id ? { ...i, to: r.checkout, nights: r.nights, total: r.total_usd } : i)));
      window.alert((lang === "ru" ? "К возврату гостю: $" : lang === "uz" ? "Mehmonga qaytariladi: $" : "Refund to guest: $") + (r.refund ?? 0));
    }
    setShortenTarget(null);
  }

  // Drive the layout off the device prop (NOT CSS md: breakpoints) so it stays correct
  // inside a phone device frame, where the real viewport is wider than the rendered shell.
  const desktop = device === "desktop";

  const nav = [
    { k: "dash", label: STR[lang].a_dashboard, icon: "grid" },
    { k: "list", label: STR[lang].a_listings, icon: "home" },
    { k: "cal", label: STR[lang].a_calendar, icon: "cal" },
    { k: "book", label: STR[lang].a_bookings, icon: "list" },
    { k: "reviews", label: STR[lang].reviews_title, icon: "star" },
    { k: "pfile", label: STR[lang].a_pfile, icon: "clipboard" },
    { k: "suppliers", label: STR[lang].a_suppliers, icon: "truck" },
  ];
  const titles = { dash: STR[lang].a_dashboard, list: STR[lang].a_listings, cal: STR[lang].a_calendar, book: STR[lang].a_bookings, reviews: STR[lang].a_moderate, pfile: STR[lang].a_pfile, suppliers: STR[lang].a_suppliers };

  return (
    <div className="min-h-screen bg-canvas flex relative">
      {/* sidebar (desktop only — driven by the device prop, not md:) */}
      {desktop && (
        <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-white px-4 py-5">
          <div className="px-2 mb-7"><Logo size={30} /></div>
          <nav className="space-y-1 flex-1">
            {nav.map((n) => (
              <button key={n.k} onClick={() => goTab(n.k)}
                className={`w-full flex items-center gap-3 h-11 px-3 rounded-xl text-[14px] font-semibold transition ${tab === n.k ? "bg-green-50 text-green-700" : "text-inksoft hover:bg-black/[.03]"}`}>
                <Icon name={n.icon} size={19} />{n.label}</button>
            ))}
          </nav>
          <button onClick={onExit} className="flex items-center gap-3 h-11 px-3 rounded-xl text-[14px] font-semibold text-inksoft hover:bg-black/[.03]"><Icon name="logout" size={18} />{STR[lang].catalog}</button>
        </aside>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className={`sticky top-0 z-20 bg-canvas/92 backdrop-blur border-b border-line ${desktop ? "px-8" : "px-5"}`}>
          <div className="flex items-center justify-between h-16">
            <h1 className="font-serif text-[22px]">{editId ? STR[lang].a_edit : titles[tab]}</h1>
            <button onClick={openLang} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-line text-[13px] font-bold"><Icon name="globe" size={15} />{STR[lang].code}</button>
          </div>
          {/* mobile tabs (when not desktop) */}
          {!desktop && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2.5 -mt-1">
              {nav.map((n) => <Chip key={n.k} active={tab === n.k} icon={n.icon} onClick={() => goTab(n.k)}>{n.label}</Chip>)}
            </div>
          )}
        </header>
        <main className={`flex-1 ${desktop ? "px-8" : "px-5"} py-6 overflow-y-auto no-scrollbar`}>
          {editId ? <EditApt lang={lang} STR={STR} id={editId} onBack={() => window.history.back()} apartments={apts} onSaved={() => getApartments().then(setApts)} />
            : tab === "dash" ? <Dashboard lang={lang} STR={STR} bookings={bookings} apartments={apts} onOpenDetail={setDetail} />
            : tab === "list" ? <Listings lang={lang} STR={STR} onEdit={goEdit} apartments={apts} />
            : tab === "cal" ? <CalManager lang={lang} STR={STR} apartments={apts} bookings={bookings} device={device} />
            : tab === "reviews" ? <ReviewsModeration lang={lang} STR={STR} apartments={apts} />
            : tab === "pfile" ? <PropertyFilesSection lang={lang} STR={STR} apartments={apts} />
            : tab === "suppliers" ? <SuppliersSection lang={lang} STR={STR} />
            : <BookingsList lang={lang} STR={STR} bookings={bookings} apartments={apts} onChanged={() => getAllBookings().then(setBookings)} onOpenDetail={setDetail} />}
        </main>
      </div>
      <BookingDetailSheet booking={detail} lang={lang} STR={STR} desktop={desktop} apartments={apts} onClose={() => setDetail(null)} onCancel={cancelFromDetail} onDelete={deleteFromDetail} onShorten={(b) => { setDetail(null); setShortenTarget(b); }} />
      <Sheet open={!!shortenTarget} onClose={() => setShortenTarget(null)} title={lang === "ru" ? "Ранний выезд" : lang === "uz" ? "Erta chiqish" : "Early checkout"} desktop={desktop}>
        {shortenTarget && <EarlyCheckoutForm lang={lang} STR={STR} b={shortenTarget} onDone={onShortenDone} />}
      </Sheet>
    </div>
  );
}
