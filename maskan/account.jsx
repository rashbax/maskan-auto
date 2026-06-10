"use client";
import { useState } from "react";
import { Icon, Logo, Button, Photo, GoogleG, uzs, tgHref } from "./ui";
import { AptCard, StateBlock, fmtRange } from "./catalog";

export const NAV = [
  { key: "search", icon: "search" },
  { key: "saved", icon: "heart" },
  { key: "bookings", icon: "ticket" },
  { key: "account", icon: "user" },
];

// ---------- nav ----------
export function NavLinks({ tab, setTab, lang, STR }) {
  return (
    <nav className="flex items-center gap-1">
      {NAV.map((n) => {
        const active = tab === n.key;
        return (
          <button key={n.key} onClick={() => setTab(n.key)}
            className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13.5px] font-semibold transition ${active ? "bg-green-50 text-green-700" : "text-inksoft hover:text-ink hover:bg-black/[.03]"}`}>
            <Icon name={n.icon} size={17} fill={n.key === "saved" && active ? "#1B5E40" : "none"} />{STR[lang]["nav_" + n.key]}
          </button>
        );
      })}
    </nav>
  );
}

export function BottomNav({ tab, setTab, lang, STR }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white/96 backdrop-blur border-t border-line flex">
      {NAV.map((n) => {
        const active = tab === n.key;
        return (
          <button key={n.key} onClick={() => setTab(n.key)} className="flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-3 active:scale-95 transition-transform">
            <Icon name={n.icon} size={23} fill={n.key === "saved" && active ? "#1B5E40" : "none"} className={active ? "text-green-700" : "text-inksoft"} sw={active ? 2 : 1.7} />
            <span className={`text-[10.5px] font-bold ${active ? "text-green-700" : "text-inksoft"}`}>{STR[lang]["nav_" + n.key]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- page shell (for saved/bookings/account) ----------
function PageShell({ lang, STR, device, tab, setTab, openLang, title, children }) {
  const desktop = device === "desktop";
  return (
    <div className="min-h-screen bg-canvas">
      <header className={`sticky top-0 z-30 bg-canvas/92 backdrop-blur border-b border-line ${desktop ? "px-8" : "px-4"}`}>
        <div className={`flex items-center justify-between ${desktop ? "h-[68px] max-w-5xl mx-auto" : "h-14"}`}>
          {desktop ? <Logo size={30} /> : <h1 className="font-serif text-[20px]">{title}</h1>}
          {desktop && <NavLinks tab={tab} setTab={setTab} lang={lang} STR={STR} />}
          <button onClick={openLang} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-line text-[13px] font-bold hover:border-ink/30 transition">
            <Icon name="globe" size={16} />{STR[lang].code}</button>
        </div>
      </header>
      <div className={`${desktop ? "max-w-5xl mx-auto px-8 py-8" : "px-4 pt-4 pb-[88px]"}`}>
        {desktop && <h1 className="font-serif text-[30px] mb-6">{title}</h1>}
        {children}
      </div>
    </div>
  );
}

// ---------- login buttons + gate ----------
export function LoginButtons({ lang, STR, onLogin, full = true }) {
  return (
    <div className="space-y-2.5">
      <button onClick={() => onLogin("telegram")} className={`inline-flex items-center justify-center gap-2.5 ${full ? "w-full" : "px-5"} rounded-full bg-green-700 text-cream font-semibold text-[15px] hover:bg-green-900 transition active:scale-[.985] shadow-[0_6px_16px_rgba(20,64,47,.22)]`} style={{ height: 52 }}>
        <Icon name="tg" size={20} />{STR[lang].login_telegram}</button>
      <button onClick={() => onLogin("google")} className={`inline-flex items-center justify-center gap-2.5 ${full ? "w-full" : "px-5"} rounded-full bg-white border border-line text-ink font-semibold text-[15px] hover:border-ink/30 transition active:scale-[.985]`} style={{ height: 52 }}>
        <GoogleG size={19} />{STR[lang].login_google}</button>
    </div>
  );
}

export function GuestGate({ lang, STR, onLogin }) {
  return (
    <div className="py-12 flex flex-col items-center text-center fade-up max-w-sm mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-green-50 grid place-items-center text-green-700 mb-4"><Icon name="lock" size={28} /></div>
      <div className="font-serif text-[22px]">{STR[lang].login_required}</div>
      <p className="text-inksoft text-[14px] mt-1.5 mb-6">{STR[lang].login_required_sub}</p>
      <div className="w-full"><LoginButtons lang={lang} STR={STR} onLogin={onLogin} /></div>
    </div>
  );
}

// ---------- Saved ----------
export function SavedPage({ lang, STR, device, tab, setTab, openLang, saved, toggleSave, onOpen, auth, onLogin, apartments }) {
  const apts = (apartments || []).filter((a) => saved.has(a.id));
  return (
    <PageShell lang={lang} STR={STR} device={device} tab={tab} setTab={setTab} openLang={openLang} title={STR[lang].saved_title}>
      {!auth ? <GuestGate lang={lang} STR={STR} onLogin={onLogin} />
        : apts.length === 0 ? <StateBlock icon="heart" title={STR[lang].saved_empty} sub={STR[lang].saved_empty_sub} action={STR[lang].nav_search} onAction={() => setTab("search")} />
        : <div className={`grid gap-x-6 gap-y-8 ${device === "desktop" ? "grid-cols-3" : "grid-cols-1"}`}>
            {apts.map((a) => <AptCard key={a.id} apt={a} lang={lang} STR={STR} filters={null} onOpen={onOpen} device={device} saved={true} onToggleSave={toggleSave} />)}
          </div>}
    </PageShell>
  );
}

// ---------- Bookings ----------
function StatusBadge({ status, lang, STR }) {
  const map = {
    active: { label: STR[lang].st_confirmed, cls: "bg-green-700 text-cream" },
    past: { label: STR[lang].st_completed, cls: "bg-ink/10 text-ink" },
    cancelled: { label: STR[lang].st_cancelled, cls: "bg-[#f1e0db] text-[#9a4a3c]" },
  };
  const s = map[status];
  return <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11.5px] font-bold ${s.cls}`}>{s.label}</span>;
}

function BookingCard({ b, lang, STR, onOpen, onBookAgain, apartments }) {
  const apt = (apartments || []).find((a) => a.id === b.apt);
  const [menu, setMenu] = useState(false);
  if (!apt) return null;
  return (
    <div className="rounded-2xl border border-line bg-white p-3 relative">
      <div className="flex gap-3">
        <button onClick={() => onOpen(apt)} className="w-20 h-20 rounded-xl overflow-hidden shrink-0"><Photo tone={apt.tone} idx={0} eager showLabel={false} className="w-full h-full" /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-serif text-[15.5px] leading-snug truncate">{apt.title[lang]}</div>
              <div className="text-[12.5px] text-inksoft mt-0.5">{fmtRange(new Date(b.from), new Date(b.to), lang)} · {STR[lang].night_n(b.nights)}</div>
            </div>
            <button onClick={() => setMenu(!menu)} className="shrink-0 w-8 h-8 -mr-1 grid place-items-center rounded-full hover:bg-black/5 text-inksoft">
              <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="19" r="1.6" fill="currentColor" /></svg>
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            <StatusBadge status={b.status} lang={lang} STR={STR} />
            <span className="font-bold text-[15px] tnum">{uzs(b.usd)}</span>
          </div>
        </div>
      </div>
      {(b.status === "past" || b.status === "cancelled") && (
        <div className="mt-3 pt-3 border-t border-line">
          <Button variant="outline" size="sm" icon="refresh" onClick={() => onBookAgain(apt)}>{STR[lang].book_again}</Button>
        </div>
      )}
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-3 top-12 z-20 w-48 rounded-xl bg-white border border-line shadow-pop py-1.5 pop-in">
            <button onClick={() => { setMenu(false); onOpen(apt); }} className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13.5px] font-semibold hover:bg-black/[.03]"><Icon name="home" size={16} />{STR[lang].back === "Назад" ? "Открыть" : STR[lang].back === "Orqaga" ? "Ochish" : "Open"}</button>
            <a href={tgHref()} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13.5px] font-semibold hover:bg-black/[.03]"><Icon name="tg" size={16} />{STR[lang].chat_telegram}</a>
            {b.status === "active" && <button onClick={() => setMenu(false)} className="w-full flex items-center gap-2.5 px-3.5 h-10 text-[13.5px] font-semibold text-[#9a4a3c] hover:bg-red-50"><Icon name="x" size={16} />{STR[lang].a_cancel}</button>}
          </div>
        </>
      )}
    </div>
  );
}

export function BookingsPage({ lang, STR, device, tab, setTab, openLang, auth, onLogin, onOpen, onBookAgain, bookings, apartments }) {
  const [sub, setSub] = useState("active");
  const tabs = [["active", STR[lang].tab_active], ["past", STR[lang].tab_past], ["cancelled", STR[lang].tab_cancelled]];
  const items = (bookings || []).filter((b) => b.status === sub);
  return (
    <PageShell lang={lang} STR={STR} device={device} tab={tab} setTab={setTab} openLang={openLang} title={STR[lang].bookings_title}>
      {!auth ? <GuestGate lang={lang} STR={STR} onLogin={onLogin} /> : (
        <div>
          <div className="flex gap-1 p-1 rounded-full bg-cream border border-line mb-5 max-w-md">
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => setSub(k)} className={`flex-1 h-9 rounded-full text-[13px] font-bold transition ${sub === k ? "bg-white text-ink shadow-sm" : "text-inksoft hover:text-ink"}`}>{label}</button>
            ))}
          </div>
          {items.length === 0 ? <StateBlock icon="ticket" title={STR[lang].bookings_empty} sub={STR[lang].bookings_empty_sub} action={STR[lang].nav_search} onAction={() => setTab("search")} />
            : <div className={`grid gap-3 ${device === "desktop" ? "grid-cols-2" : "grid-cols-1"}`}>
                {items.map((b) => <BookingCard key={b.id} b={b} lang={lang} STR={STR} onOpen={onOpen} onBookAgain={onBookAgain} apartments={apartments} />)}
              </div>}
        </div>
      )}
    </PageShell>
  );
}

// ---------- Account ----------
export function AccountPage({ lang, STR, device, tab, setTab, openLang, auth, onLogin, onLogout }) {
  return (
    <PageShell lang={lang} STR={STR} device={device} tab={tab} setTab={setTab} openLang={openLang} title={STR[lang].account_title}>
      <div className="max-w-md">
        {auth ? (
          <div className="fade-up">
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
              <div className="w-16 h-16 rounded-full bg-green-700 text-cream grid place-items-center font-serif text-[26px]">{auth.name[0]}</div>
              <div className="min-w-0">
                <div className="font-serif text-[20px] leading-tight">{auth.name}</div>
                <div className="inline-flex items-center gap-1.5 text-[12.5px] text-inksoft mt-1">
                  {auth.provider === "telegram" ? <Icon name="tg" size={14} className="text-green-700" /> : <GoogleG size={13} />}{auth.handle}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-line bg-white divide-y divide-line">
              <button onClick={openLang} className="w-full flex items-center justify-between px-4 h-14 hover:bg-black/[.02]">
                <span className="flex items-center gap-3 text-[14.5px] font-semibold"><Icon name="globe" size={19} className="text-green-700" />{STR[lang].language}</span>
                <span className="text-[13px] text-inksoft font-semibold">{STR[lang].name} ›</span>
              </button>
            </div>
            <button onClick={onLogout} className="w-full mt-4 inline-flex items-center justify-center gap-2 h-12 rounded-full border border-line text-[14.5px] font-semibold text-[#9a4a3c] hover:bg-red-50 transition">
              <Icon name="logout" size={18} />{STR[lang].logout}</button>
          </div>
        ) : (
          <div className="rounded-3xl border border-line bg-white p-7 fade-up text-center">
            <div className="flex justify-center mb-4"><Logo size={38} withWord={false} /></div>
            <h2 className="font-serif text-[23px]">{STR[lang].login_title}</h2>
            <p className="text-inksoft text-[14px] mt-1.5 mb-6">{STR[lang].login_sub}</p>
            <LoginButtons lang={lang} STR={STR} onLogin={onLogin} />
          </div>
        )}
      </div>
    </PageShell>
  );
}
