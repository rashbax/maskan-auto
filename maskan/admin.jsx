"use client";
import { useState, useEffect, useRef, createRef } from "react";
import { MASKAN } from "./data";
import { Icon, Logo, Button, Chip, Badge, Photo, Stepper, AMENITY_ICON, GoogleG, Sheet } from "./ui";
import { calMonths, calWD, buildMonth, dOnly } from "./calendar";
import { fmtRange } from "./catalog";
import { StarRow } from "./reviews";
import { getApartments, getAllBookings, cancelBooking, deleteBooking, createManualBooking, getBlocks, blockDay, unblockDay, getAllReviews, setReviewHidden, setReviewReply, saveApartment, deleteApartment, requestUploadUrl, addPhoto, getPhotos, deletePhoto, setPhotoOrder } from "./db";
import { MapPicker } from "./maps";
import { TelegramLoginButton } from "./telegram-button";

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
function Dashboard({ lang, STR, bookings, apartments }) {
  const M = MASKAN;
  const today = M.iso(M.TODAY);
  const list = bookings || [];
  const todays = list.filter((b) => b.from === today);
  const upcoming = list.filter((b) => b.from > today && b.status === "active");
  const revenue = list.filter((b) => b.status !== "cancelled").reduce((s, b) => s + (b.total || 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={STR[lang].a_today} value={todays.length} sub={STR[lang].search_city} accent />
        <StatCard label={STR[lang].a_upcoming} value={upcoming.length} />
        <StatCard label={STR[lang].a_occupancy} value="78%" sub={calMonths[lang][M.TODAY.getMonth()]} />
        <StatCard label={STR[lang].a_revenue} value={"$" + revenue} sub={calMonths[lang][M.TODAY.getMonth()]} accent />
      </div>
      <div>
        <h3 className="font-serif text-[19px] mb-3">{STR[lang].a_today}</h3>
        {todays.length === 0 ? <div className="text-[14px] text-inksoft py-6 text-center border border-dashed border-line rounded-2xl">—</div> : (
          <div className="space-y-2">{todays.map((b) => <BookingRow key={b.id} b={b} lang={lang} STR={STR} apartments={apartments} />)}</div>
        )}
      </div>
      <div>
        <h3 className="font-serif text-[19px] mb-3">{STR[lang].a_upcoming}</h3>
        <div className="space-y-2">{upcoming.map((b) => <BookingRow key={b.id} b={b} lang={lang} STR={STR} apartments={apartments} />)}</div>
      </div>
    </div>
  );
}

function SourceTag({ src, lang, STR }) {
  const s = SRC[src];
  return <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[11.5px] font-bold" style={{ color: s.color, background: s.bg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{STR[lang][s.key]}</span>;
}

function BookingRow({ b, lang, STR, onCancel, onDelete, apartments }) {
  const apt = (apartments || []).find((a) => a.id === b.apt) || aptById(b.apt);
  if (!apt) return null;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-line bg-white">
      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0"><Photo tone={apt.tone} idx={0} eager showLabel={false} className="w-full h-full" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><span className="font-bold text-[14px] truncate">{b.guest}</span><SourceTag src={b.source} lang={lang} STR={STR} /></div>
        <div className="text-[12.5px] text-inksoft truncate">{apt.title[lang]} · {fmtRange(new Date(b.from), new Date(b.to), lang)}</div>
      </div>
      <div className="text-right shrink-0 hidden sm:block"><div className="font-bold text-[15px] tnum">${b.total}</div><div className="text-[11px] text-inksoft tnum">{b.phone}</div></div>
      {onCancel && b.status === "active" && <button onClick={() => onCancel(b)} className="shrink-0 text-[12.5px] font-semibold text-red-600 px-3 h-8 rounded-full hover:bg-red-50">{STR[lang].a_cancel}</button>}
      {onDelete && <button onClick={() => onDelete(b)} title={lang === "ru" ? "Удалить" : lang === "uz" ? "Oʻchirish" : "Delete"} className="shrink-0 w-8 h-8 grid place-items-center rounded-full text-inksoft hover:text-red-600 hover:bg-red-50"><Icon name="trash" size={15} /></button>}
    </div>
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
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const apt = apts.find((a) => a.id === aptId);
  const nights = from && to ? Math.round((new Date(to) - new Date(from)) / 86400000) : 0;
  const suggested = apt && nights > 0 ? apt.price * nights : 0;
  const fld = "mt-1.5 w-full h-12 px-4 rounded-xl bg-white border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[15px]";
  const T = (ru, uz, en) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const msgs = { required: T("Заполните квартиру и даты", "Kvartira va sanalarni toʻldiring", "Fill apartment and dates"), dates: T("Выезд должен быть позже заезда", "Ketish kelishdan keyin boʻlsin", "Check-out must be after check-in"), overlap: T("Эти даты уже заняты", "Bu sanalar allaqachon band", "These dates are already taken"), fail: T("Не удалось", "Boʻlmadi", "Failed") };
  async function submit() {
    setErr("");
    if (!aptId || !from || !to) { setErr("required"); return; }
    if (nights <= 0) { setErr("dates"); return; }
    setBusy(true);
    try {
      await createManualBooking({ apartmentId: aptId, guestName: guest, phone, from, to, total: total ? +total : suggested, source });
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
          {apts.map((a) => <option key={a.id} value={a.id}>{a.title[lang]}</option>)}
        </select></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-[13px] font-bold">{STR[lang].checkin}</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fld} /></label>
        <label className="block"><span className="text-[13px] font-bold">{STR[lang].checkout}</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fld} /></label>
      </div>
      <label className="block"><span className="text-[13px] font-bold">{STR[lang].a_guest}</span><input value={guest} onChange={(e) => setGuest(e.target.value)} placeholder={STR[lang].name_ph} className={fld} /></label>
      <label className="block"><span className="text-[13px] font-bold">{STR[lang].phone}</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 ..." className={fld} /></label>
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
        <input type="number" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={suggested ? String(suggested) : "0"} className={fld + " tnum"} />
        {nights > 0 && <div className="text-[12px] text-inksoft mt-1.5">{STR[lang].night_n(nights)} · {T("предложено", "taklif", "suggested")}: ${suggested}</div>}
      </label>
      {err && <div className="text-[13px] text-[#9a4a3c] bg-red-50 rounded-lg p-3">{msgs[err]}</div>}
      <Button full size="lg" icon="check" onClick={submit} disabled={busy} className={busy ? "opacity-60 pointer-events-none" : ""}>{busy ? "…" : T("Добавить бронь", "Bron qoʻshish", "Add booking")}</Button>
    </div>
  );
}

// ---- bookings list ----
function BookingsList({ lang, STR, bookings, apartments, onChanged }) {
  const [items, setItems] = useState(bookings || []);
  const [adding, setAdding] = useState(false);
  useEffect(() => { setItems(bookings || []); }, [bookings]);
  async function cancel(x) {
    setItems((arr) => arr.map((i) => (i.id === x.id ? { ...i, status: "cancelled" } : i)));
    await cancelBooking(x.id);
  }
  async function del(x) {
    const msg = lang === "ru" ? "Удалить эту бронь навсегда?" : lang === "uz" ? "Bu bronni butunlay oʻchirilsinmi?" : "Delete this booking permanently?";
    if (!window.confirm(msg)) return;
    setItems((arr) => arr.filter((i) => i.id !== x.id));
    try { await deleteBooking(x.id); } catch (e) { console.error("deleteBooking failed:", e); }
  }
  return (
    <div>
      <div className="flex justify-end mb-4"><Button icon="plusbox" onClick={() => setAdding(true)}>{lang === "ru" ? "Добавить бронь" : lang === "uz" ? "Bron qoʻshish" : "Add booking"}</Button></div>
      <div className="space-y-2">
        {items.length === 0
          ? <div className="text-[14px] text-inksoft py-8 text-center border border-dashed border-line rounded-2xl">—</div>
          : items.map((b) => <BookingRow key={b.id} b={b} lang={lang} STR={STR} onCancel={cancel} onDelete={del} apartments={apartments} />)}
      </div>
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
              {/* admin-only: apartment id (click to copy) — used for the Beds24 room mapping */}
              <span onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(a.id); }}
                title={lang === "ru" ? "Скопировать ID" : lang === "uz" ? "ID nusxa olish" : "Copy ID"}
                className="inline-block mt-2 text-[11px] font-mono text-inksoft/80 bg-black/[.04] px-1.5 py-0.5 rounded cursor-copy hover:bg-black/[.08] select-all">{a.id}</span>
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
  const [aptId] = useState(apt?.id || ("apt-" + Date.now().toString(36)));
  const [photos, setPhotos] = useState([]);
  const fileRef = useRef(null);
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
  async function persistApartment() { await saveApartment(buildRow(), address); }
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

// ---- calendar manager ----
function CalManager({ lang, STR, apartments, bookings }) {
  const M = MASKAN;
  const apts = apartments || [];
  const [aptId, setAptId] = useState(apts[0]?.id || "a1");
  useEffect(() => { if (apts.length && !apts.find((a) => a.id === aptId)) setAptId(apts[0].id); }, [apts]);
  const apt = apts.find((a) => a.id === aptId);
  const [view, setView] = useState({ y: M.TODAY.getFullYear(), m: M.TODAY.getMonth() });
  const [blocked, setBlocked] = useState(new Set());
  useEffect(() => { getBlocks(aptId).then(setBlocked); }, [aptId]);
  // booking-source map for this apt
  const srcMap = {};
  (bookings || []).filter((b) => b.apt === aptId && b.status === "active").forEach((b) => {
    for (let x = new Date(b.from); x < new Date(b.to); x = M.addDays(x, 1)) srcMap[M.iso(x)] = b.source;
  });
  const cells = buildMonth(view.y, view.m);
  const today = dOnly(M.TODAY);
  async function toggle(d) {
    const k = M.iso(d);
    const wasBlocked = blocked.has(k);
    const next = new Set(blocked);
    if (wasBlocked) next.delete(k); else next.add(k);
    setBlocked(next); // optimistic
    try {
      if (wasBlocked) await unblockDay(aptId, k);
      else await blockDay(aptId, k);
    } catch (e) {
      setBlocked(blocked); // rollback to the pre-toggle state
      alert(e?.code === "23B01"
        ? (lang === "ru" ? "Эта дата уже забронирована — заблокировать нельзя." : lang === "uz" ? "Bu sana band qilingan — bloklab boʻlmaydi." : "This date already has a booking — can't block it.")
        : (lang === "ru" ? "Не удалось сохранить. Попробуйте ещё раз." : lang === "uz" ? "Saqlab boʻlmadi. Qayta urining." : "Could not save. Please try again."));
    }
  }
  function shift(delta) { let m = view.m + delta, y = view.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setView({ y, m }); }
  if (!apt) return null;
  return (
    <div className="max-w-xl">
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5">
        {apts.map((a) => <Chip key={a.id} active={a.id === aptId} onClick={() => setAptId(a.id)}>{a.title[lang].split(",")[0].split(" ").slice(0, 3).join(" ")}</Chip>)}
      </div>
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shift(-1)} className="w-9 h-9 grid place-items-center rounded-full hover:bg-black/5"><Icon name="chevL" size={18} /></button>
          <div className="font-serif text-[18px]">{calMonths[lang][view.m]} {view.y}</div>
          <button onClick={() => shift(1)} className="w-9 h-9 grid place-items-center rounded-full hover:bg-black/5"><Icon name="chevR" size={18} /></button>
        </div>
        <div className="grid grid-cols-7 mb-1">{calWD[lang].map((w, i) => <div key={i} className="text-center text-[11px] font-bold text-inksoft py-1">{w}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const k = M.iso(d); const past = d < today; const src = srcMap[k]; const isBlocked = blocked.has(k);
            const booked = !!src;
            return (
              <button key={i} disabled={past || booked} onClick={() => toggle(d)}
                className={`aspect-square rounded-lg grid place-items-center text-[13.5px] font-semibold tnum relative transition ${past ? "text-inksoft/25" : booked ? "text-cream" : isBlocked ? "bg-inksoft/15 text-inksoft line-through" : "hover:bg-green-50 text-ink"}`}
                style={booked ? { background: SRC[src].color } : {}}>{d.getDate()}</button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-line text-[12px] font-semibold">
          {Object.keys(SRC).map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: SRC[s].color }} />{STR[lang][SRC[s].key]}</span>)}
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-inksoft/20" />{STR[lang].a_blocked}</span>
        </div>
        <p className="text-[12.5px] text-inksoft mt-3">{lang === "ru" ? "Нажмите на свободный день, чтобы закрыть или открыть его." : lang === "uz" ? "Kunni yopish yoki ochish uchun bosing." : "Tap a free day to block or open it."}</p>
      </div>
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
    return parts[0] === "admin" && ["dash", "list", "cal", "book", "reviews"].includes(parts[1]) ? parts[1] : "dash";
  });
  const [editId, setEditId] = useState(null);
  const [apts, setApts] = useState([]);
  const [bookings, setBookings] = useState([]);
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
      setTab(["dash", "list", "cal", "book", "reviews"].includes(parts[1]) ? parts[1] : "dash");
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

  const nav = [
    { k: "dash", label: STR[lang].a_dashboard, icon: "grid" },
    { k: "list", label: STR[lang].a_listings, icon: "home" },
    { k: "cal", label: STR[lang].a_calendar, icon: "cal" },
    { k: "book", label: STR[lang].a_bookings, icon: "list" },
    { k: "reviews", label: STR[lang].reviews_title, icon: "star" },
  ];
  const titles = { dash: STR[lang].a_dashboard, list: STR[lang].a_listings, cal: STR[lang].a_calendar, book: STR[lang].a_bookings, reviews: STR[lang].a_moderate };

  return (
    <div className="min-h-screen bg-canvas flex relative">
      {/* sidebar (desktop) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-white px-4 py-5">
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

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-canvas/92 backdrop-blur border-b border-line px-5 md:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="font-serif text-[22px]">{editId ? STR[lang].a_edit : titles[tab]}</h1>
            <button onClick={openLang} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-line text-[13px] font-bold"><Icon name="globe" size={15} />{STR[lang].code}</button>
          </div>
          {/* mobile tabs */}
          <div className="md:hidden flex gap-2 overflow-x-auto no-scrollbar pb-2.5 -mt-1">
            {nav.map((n) => <Chip key={n.k} active={tab === n.k} icon={n.icon} onClick={() => goTab(n.k)}>{n.label}</Chip>)}
          </div>
        </header>
        <main className="flex-1 px-5 md:px-8 py-6 overflow-y-auto no-scrollbar">
          {editId ? <EditApt lang={lang} STR={STR} id={editId} onBack={() => window.history.back()} apartments={apts} onSaved={() => getApartments().then(setApts)} />
            : tab === "dash" ? <Dashboard lang={lang} STR={STR} bookings={bookings} apartments={apts} />
            : tab === "list" ? <Listings lang={lang} STR={STR} onEdit={goEdit} apartments={apts} />
            : tab === "cal" ? <CalManager lang={lang} STR={STR} apartments={apts} bookings={bookings} />
            : tab === "reviews" ? <ReviewsModeration lang={lang} STR={STR} apartments={apts} />
            : <BookingsList lang={lang} STR={STR} bookings={bookings} apartments={apts} onChanged={() => getAllBookings().then(setBookings)} />}
        </main>
      </div>
    </div>
  );
}
