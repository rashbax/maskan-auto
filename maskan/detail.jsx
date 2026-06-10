"use client";
import { useState, useEffect, useRef } from "react";
import { MASKAN } from "./data";
import { Icon, Logo, Button, Stars, Photo, Badge, Sheet, ChannelBtn, AMENITY_ICON } from "./ui";
import { AvailabilityCalendar, nightsBetween } from "./calendar";
import { fmtRange } from "./catalog";
import { ReviewsSection } from "./reviews";

const GALLERY_LABELS = ["living room", "kitchen", "bedroom", "bathroom", "balcony", "view", "entrance", "workspace", "dining", "hallway"];

// ---- full-screen gallery viewer ----
function GalleryViewer({ apt, start, onClose }) {
  const [i, setI] = useState(start || 0);
  const n = apt.photos;
  return (
    <div className="fixed inset-0 z-[60] bg-ink flex flex-col pop-in">
      <div className="flex items-center justify-between px-4 h-14 text-cream shrink-0">
        <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10"><Icon name="x" size={22} /></button>
        <span className="text-[14px] font-semibold tnum">{i + 1} / {n}</span>
        <button className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10"><Icon name="heart" size={20} /></button>
      </div>
      <div className="flex-1 relative grid place-items-center px-2 min-h-0">
        <Photo tone={apt.tone} idx={i} eager label={GALLERY_LABELS[i % GALLERY_LABELS.length]} className="w-full h-full max-h-full rounded-xl" rounded="rounded-xl" />
        <button onClick={() => setI((i - 1 + n) % n)} className="absolute left-3 w-11 h-11 grid place-items-center rounded-full bg-white/90 text-ink hover:scale-105 transition"><Icon name="chevL" size={22} /></button>
        <button onClick={() => setI((i + 1) % n)} className="absolute right-3 w-11 h-11 grid place-items-center rounded-full bg-white/90 text-ink hover:scale-105 transition"><Icon name="chevR" size={22} /></button>
      </div>
      <div className="h-20 flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 shrink-0">
        {Array.from({ length: n }).map((_, k) => (
          <button key={k} onClick={() => setI(k)} className={`relative h-full aspect-[4/3] rounded-lg overflow-hidden shrink-0 ${k === i ? "ring-2 ring-cream" : "opacity-60"}`}>
            <Photo tone={apt.tone} idx={k} eager showLabel={false} className="w-full h-full" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- amenity grid ----
function Amenities({ apt, lang, max }) {
  const M = MASKAN;
  const shown = max ? apt.amenities.slice(0, max) : apt.amenities;
  return (
    <div className="grid grid-cols-2 gap-y-4 gap-x-3">
      {shown.map((a) => (
        <div key={a} className="flex items-center gap-3 text-[14.5px]">
          <Icon name={AMENITY_ICON[a]} size={22} className="text-green-700 shrink-0" />
          <span className="text-ink">{M.AMENITIES[a][lang]}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children, className = "" }) {
  return (
    <section className={`py-6 border-t border-line ${className}`}>
      {title && <h2 className="font-serif text-[20px] mb-4">{title}</h2>}
      {children}
    </section>
  );
}

// ---- price breakdown ----
function PriceBreakdown({ apt, range, lang, STR }) {
  const nights = range?.from && range?.to ? nightsBetween(range.from, range.to) : 0;
  if (!nights) return null;
  const sub = apt.price * nights;
  return (
    <div className="space-y-2.5 text-[14.5px]">
      <div className="flex justify-between"><span className="text-inksoft">${apt.price} × {STR[lang].night_n(nights)}</span><span className="font-semibold tnum">${sub}</span></div>
      <div className="flex justify-between"><span className="text-inksoft">{STR[lang].cleaning}</span><span className="font-semibold tnum text-green-700">$0</span></div>
      <div className="flex justify-between"><span className="text-inksoft">{STR[lang].service}</span><span className="font-semibold tnum text-green-700">$0</span></div>
      <div className="flex justify-between items-baseline pt-3 mt-1 border-t border-line">
        <span className="font-bold text-[16px]">{STR[lang].total}</span>
        <span className="font-bold text-[20px] tnum">${sub}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[12.5px] text-green-700 font-semibold pt-1">
        <Icon name="check" size={14} sw={2.4} />{STR[lang].nofees}
      </div>
    </div>
  );
}

// ---- map / address-after-booking ----
function WhereBlock({ apt, lang, STR }) {
  const M = MASKAN;
  return (
    <div>
      <div className="relative h-44 rounded-2xl overflow-hidden border border-line grain bg-cream">
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(0deg, rgba(20,64,47,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(20,64,47,.05) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
        {/* approximate area circle */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-32 h-32 rounded-full bg-green-600/12 border-2 border-dashed border-green-600/40" />
          <div className="absolute inset-0 grid place-items-center"><div className="w-3 h-3 rounded-full bg-green-700 ring-4 ring-green-600/25" /></div>
        </div>
        <div className="absolute bottom-3 left-3"><Badge tone="cream" icon="pin">{M.DISTRICTS[apt.district][lang]} · {STR[lang].search_city}</Badge></div>
      </div>
      <div className="flex gap-3 mt-3 p-3.5 rounded-xl bg-green-50">
        <Icon name="shield" size={20} className="text-green-700 shrink-0 mt-0.5" />
        <p className="text-[13px] leading-relaxed text-green-900">{STR[lang].address_after}</p>
      </div>
    </div>
  );
}

export function Detail({ apt, lang, STR, device, range, setRange, onBack, onBook, openLang, saved, toggleSave }) {
  const M = MASKAN;
  const isSaved = saved && saved.has(apt.id);
  const d = M.DISTRICTS[apt.district];
  const desktop = device === "desktop";
  const [viewer, setViewer] = useState(null);
  const [showAmen, setShowAmen] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [hero, setHero] = useState(0);
  const heroRef = useRef(null);
  const nights = range?.from && range?.to ? nightsBetween(range.from, range.to) : 0;

  // hero swipe index (mobile)
  useEffect(() => {
    const el = heroRef.current; if (!el) return;
    const onScroll = () => setHero(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true }); return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const calBlock = (
    <div>
      <h2 className="font-serif text-[20px] mb-1">{STR[lang].select_dates}</h2>
      <p className="text-[13px] text-inksoft mb-4">{nights ? STR[lang].night_n(nights) + " · " + fmtRange(range.from, range.to, lang) : (lang === "ru" ? "Свободные дни отмечены точкой" : lang === "uz" ? "Boʻsh kunlar nuqta bilan belgilangan" : "Free nights are marked with a dot")}</p>
      <AvailabilityCalendar lang={lang} STR={STR} busy={apt.busy} value={range} onChange={setRange} months={1} />
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas relative">
      {/* ===== MOBILE HERO ===== */}
      {!desktop && (
        <div className="relative">
          <div ref={heroRef} className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory aspect-[4/3]">
            {Array.from({ length: Math.min(apt.photos, 8) }).map((_, k) => (
              <div key={k} className="w-full shrink-0 snap-center" onClick={() => setViewer(k)}>
                <Photo tone={apt.tone} idx={k} eager={k < 2} label={GALLERY_LABELS[k % GALLERY_LABELS.length]} className="w-full h-full" />
              </div>
            ))}
          </div>
          <div className="absolute top-0 inset-x-0 h-14 flex items-center justify-between px-3">
            <button onClick={onBack} className="w-10 h-10 grid place-items-center rounded-full bg-white/92 backdrop-blur shadow-sm"><Icon name="arrowL" size={20} /></button>
            <div className="flex gap-2">
              <button onClick={openLang} className="h-10 px-3 inline-flex items-center gap-1.5 rounded-full bg-white/92 backdrop-blur shadow-sm text-[13px] font-bold"><Icon name="globe" size={15} />{STR[lang].code}</button>
              <button onClick={() => toggleSave && toggleSave(apt.id)} className="w-10 h-10 grid place-items-center rounded-full bg-white/92 backdrop-blur shadow-sm"><Icon name="heart" size={19} fill={isSaved ? "#1B5E40" : "none"} className={isSaved ? "text-green-600" : "text-ink"} /></button>
            </div>
          </div>
          <button onClick={() => setViewer(0)} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/94 backdrop-blur text-[13px] font-bold shadow-sm">
            <Icon name="grid" size={15} />{hero + 1}/{apt.photos}</button>
        </div>
      )}

      {/* ===== DESKTOP HEADER + MOSAIC ===== */}
      {desktop && (
        <div>
          <header className="sticky top-0 z-30 bg-canvas/90 backdrop-blur border-b border-line px-8">
            <div className="flex items-center justify-between h-[68px] max-w-6xl mx-auto">
              <button onClick={onBack} className="inline-flex items-center gap-2 text-[14px] font-semibold hover:opacity-70"><Icon name="arrowL" size={18} />{STR[lang].back}</button>
              <Logo size={30} />
              <button onClick={openLang} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-line text-[13px] font-bold"><Icon name="globe" size={16} />{STR[lang].code}</button>
            </div>
          </header>
          <div className="max-w-6xl mx-auto px-8 pt-6">
            <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] rounded-3xl overflow-hidden">
              <div className="col-span-2 row-span-2 cursor-pointer" onClick={() => setViewer(0)}><Photo tone={apt.tone} idx={0} eager label={GALLERY_LABELS[0]} className="w-full h-full" /></div>
              {[1, 2, 3, 4].map((k) => <div key={k} className="cursor-pointer relative" onClick={() => setViewer(k)}><Photo tone={apt.tone} idx={k} eager={k < 3} label={GALLERY_LABELS[k]} className="w-full h-full" />
                {k === 4 && <button onClick={(e) => { e.stopPropagation(); setViewer(0); }} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/94 text-[13px] font-bold shadow-sm"><Icon name="grid" size={15} />{STR[lang].see_all_photos(apt.photos)}</button>}
              </div>)}
            </div>
          </div>
        </div>
      )}

      {/* ===== BODY ===== */}
      <div className={`${desktop ? "max-w-6xl mx-auto px-8 grid grid-cols-[1fr_372px] gap-12 pt-8 pb-16" : "px-4 pb-28"}`}>
        <div>
          {/* title */}
          <div className={`${desktop ? "pt-0" : "pt-5"}`}>
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-green-700">{d[lang]}{d.centre ? " · " + STR[lang].centre : ""}</span>
            <h1 className={`font-serif ${desktop ? "text-[32px]" : "text-[24px]"} leading-[1.12] mt-1.5`} style={{ textWrap: "balance" }}>{apt.title[lang]}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3">
              <Stars rating={apt.rating} reviews={apt.reviews} lang={lang} STR={STR} />
              {apt.superhost && <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-green-700"><Icon name="shield" size={14} />{STR[lang].superhost}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3.5 text-[13.5px] text-inksoft font-medium [&>span]:whitespace-nowrap">
              <span>{STR[lang].sleeps(apt.sleeps)}</span><span>· {apt.beds} {lang === "ru" ? "спальни" : lang === "uz" ? "yotoqxona" : "beds"}</span><span>· {apt.size} м²</span>
            </div>
          </div>

          {/* host */}
          <Section title={null} className="flex items-center justify-between !pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-700 text-cream grid place-items-center font-serif text-[18px]">{apt.host[0]}</div>
              <div>
                <div className="text-[15px] font-bold">{apt.host}</div>
                <div className="text-[12.5px] text-inksoft">{STR[lang].response}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" icon="tg">Telegram</Button>
          </Section>

          <Section title={null}><p className="text-[15px] leading-relaxed text-ink/85">{apt.blurb[lang]}</p></Section>

          <Section title={STR[lang].amenities}>
            <Amenities apt={apt} lang={lang} max={6} />
            {apt.amenities.length > 6 && <div className="mt-5"><Button variant="outline" size="sm" onClick={() => setShowAmen(true)}>{STR[lang].show_all_amenities} ({apt.amenities.length})</Button></div>}
          </Section>

          <Section title={STR[lang].house_rules}>
            <div className="grid grid-cols-2 gap-4 text-[14px]">
              <div className="flex items-center gap-2.5"><Icon name="selfcheckin" size={20} className="text-green-700" /><span><b>{STR[lang].checkin}</b> · 14:00</span></div>
              <div className="flex items-center gap-2.5"><Icon name="logout" size={20} className="text-green-700" /><span><b>{STR[lang].checkout}</b> · 12:00</span></div>
            </div>
          </Section>

          <Section title={STR[lang].where}><WhereBlock apt={apt} lang={lang} STR={STR} /></Section>

          <ReviewsSection apt={apt} lang={lang} STR={STR} device={device} />

          {/* questions — WhatsApp / Telegram */}
          <section className="py-6 border-t border-line">
            <h2 className="font-serif text-[20px] mb-1">{STR[lang].questions_title}</h2>
            <p className="text-[13.5px] text-inksoft mb-4 max-w-md">{STR[lang].questions_sub}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <ChannelBtn channel="whatsapp" lang={lang} STR={STR} variant="solid" full text={`${STR[lang].search_city} · ${apt.title[lang]}`} />
              <ChannelBtn channel="telegram" lang={lang} STR={STR} variant="outline" full />
            </div>
          </section>

          {/* mobile inline calendar */}
          {!desktop && <Section title={null}>{calBlock}</Section>}
        </div>

        {/* ===== DESKTOP BOOKING CARD ===== */}
        {desktop && (
          <aside>
            <div className="sticky top-[88px] rounded-3xl border border-line bg-white shadow-card p-6">
              <div className="flex items-baseline justify-between">
                <div><span className="font-serif text-[26px]">${apt.price}</span><span className="text-inksoft text-[14px]"> / {STR[lang].night1}</span></div>
                <Stars rating={apt.rating} lang={lang} STR={STR} />
              </div>
              <div className="mt-5">{calBlock}</div>
              <div className="mt-5">{nights ? <PriceBreakdown apt={apt} range={range} lang={lang} STR={STR} /> : <p className="text-[13px] text-inksoft text-center py-2">{STR[lang].select_dates}</p>}</div>
              <div className="mt-5"><Button full size="lg" icon="bolt" disabled={!nights} onClick={() => onBook(apt, range)} className={!nights ? "opacity-40 pointer-events-none" : ""}>{STR[lang].book_now}</Button></div>
            </div>
          </aside>
        )}
      </div>

      {/* ===== MOBILE STICKY BOOK BAR ===== */}
      {!desktop && (
        <div className="sticky bottom-0 z-30 bg-white border-t border-line shadow-bar px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {nights ? (
              <><div className="font-bold text-[17px] tnum">${apt.price * nights}<span className="text-inksoft font-semibold text-[13px]"> · {STR[lang].night_n(nights)}</span></div>
                <button onClick={() => setShowCal(true)} className="text-[12.5px] text-green-700 font-semibold underline underline-offset-2">{fmtRange(range.from, range.to, lang)}</button></>
            ) : (
              <><div className="font-bold text-[17px] tnum">${apt.price}<span className="text-inksoft font-semibold text-[13px]"> / {STR[lang].night1}</span></div>
                <button onClick={() => setShowCal(true)} className="text-[12.5px] text-green-700 font-semibold underline underline-offset-2">{STR[lang].select_dates}</button></>
            )}
          </div>
          <Button size="lg" icon="bolt" onClick={() => nights ? onBook(apt, range) : setShowCal(true)} className="shrink-0 px-7">{STR[lang].book_now}</Button>
        </div>
      )}

      {/* sheets */}
      <Sheet open={showAmen} onClose={() => setShowAmen(false)} title={STR[lang].amenities} desktop={desktop}><Amenities apt={apt} lang={lang} /></Sheet>
      <Sheet open={showCal} onClose={() => setShowCal(false)} title={STR[lang].select_dates} desktop={desktop}
        footer={<Button full size="lg" disabled={!nights} className={!nights ? "opacity-40 pointer-events-none" : ""} onClick={() => { setShowCal(false); }}>{nights ? `${STR[lang].total} $${apt.price * nights}` : STR[lang].select_dates}</Button>}>
        {calBlock}
      </Sheet>

      {viewer !== null && <GalleryViewer apt={apt} start={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
