"use client";
import { useState, useEffect } from "react";
import { MASKAN } from "./data";
import { Icon, Sheet } from "./ui";
import { Catalog } from "./catalog";
import { Detail } from "./detail";
import { Booking } from "./booking";
import { SavedPage, BookingsPage, AccountPage, BottomNav } from "./account";
import { Admin } from "./admin";
import { getApartments, getFavorites, getMyBookings, addFavorite, removeFavorite } from "./db";
import { sb, mapUser, signInWithGoogle, signOut } from "./auth";

const LANGS = ["uz", "ru", "en"];

function LangSheet({ open, onClose, lang, setLang, STR, desktop }) {
  return (
    <Sheet open={open} onClose={onClose} title={STR[lang].code === "EN" ? "Language" : lang === "ru" ? "Язык" : "Til"} desktop={desktop}>
      <div className="space-y-2 pb-2">
        {LANGS.map((l) => (
          <button key={l} onClick={() => { setLang(l); onClose(); }}
            className={`w-full flex items-center justify-between h-14 px-4 rounded-2xl border transition ${l === lang ? "border-green-600 bg-green-50" : "border-line bg-white hover:border-ink/20"}`}>
            <span className="flex items-center gap-3"><span className="w-9 h-9 rounded-full bg-ink/5 grid place-items-center font-bold text-[12px]">{STR[l].code}</span>
              <span className="font-semibold text-[15px]">{STR[l].name}</span></span>
            {l === lang && <Icon name="check" size={20} className="text-green-700" sw={2.2} />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export default function App() {
  const STR = MASKAN.STR;
  const [lang, setLang] = useState("uz");
  const [device, setDevice] = useState(() => (typeof window !== "undefined" && window.innerWidth >= 760 ? "desktop" : "mobile"));
  const [route, setRoute] = useState({ screen: "catalog" });
  const [filters, setFilters] = useState({ range: { from: null, to: null }, guests: 2, district: null });
  const [range, setRange] = useState({ from: null, to: null });
  const [langOpen, setLangOpen] = useState(false);
  const [saved, setSaved] = useState(() => new Set());
  const [auth, setAuth] = useState(null);
  const [apartments, setApartments] = useState(null); // null = loading; from Supabase
  const [myBookings, setMyBookings] = useState([]);

  useEffect(() => {
    let alive = true;
    getApartments()
      .then((a) => alive && setApartments(a))
      .catch((e) => { console.error("getApartments failed:", e); alive && setApartments([]); });
    return () => { alive = false; };
  }, []);

  // real Supabase session
  useEffect(() => {
    const client = sb();
    client.auth.getSession().then(({ data }) => setAuth(mapUser(data.session?.user)));
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => setAuth(mapUser(session?.user)));
    return () => sub.subscription.unsubscribe();
  }, []);

  // load this user's favorites + bookings when signed in (clear on sign out)
  useEffect(() => {
    if (!auth) { setSaved(new Set()); setMyBookings([]); return; }
    getFavorites().then(setSaved);
    getMyBookings().then(setMyBookings);
  }, [auth?.id]);

  useEffect(() => {
    const onResize = () => setDevice(window.innerWidth >= 760 ? "desktop" : "mobile");
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [route.screen, route.apt]);

  const openLang = () => setLangOpen(true);
  const goCatalog = () => setRoute({ screen: "catalog" });
  const goAdmin = () => setRoute({ screen: "admin" });
  const openApt = (apt) => { setRange(filters.range?.from ? filters.range : { from: null, to: null }); setRoute({ screen: "detail", apt }); };
  const book = (apt, r) => { setRange(r); setRoute({ screen: "booking", apt }); };
  const toggleSave = (id) => setSaved((s) => {
    const n = new Set(s);
    if (n.has(id)) { n.delete(id); if (auth) removeFavorite(id); }
    else { n.add(id); if (auth) addFavorite(id); }
    return n;
  });
  const login = (provider) => {
    if (provider === "telegram") { alert("Telegram bilan kirish keyingi qadamda — hozircha Google bilan kiring."); return; }
    signInWithGoogle();
  };
  const logout = () => signOut();
  const refreshApartments = () => getApartments().then(setApartments).catch(() => {});

  const GUEST_TABS = ["catalog", "saved", "bookings", "account"];
  const navTab = ["detail", "booking"].includes(route.screen) ? "search" : route.screen === "catalog" ? "search" : route.screen;
  const setTab = (key) => { key === "search" ? goCatalog() : setRoute({ screen: key }); };

  const common = { lang, STR, device, openLang, tab: navTab, setTab };
  let screen;
  if (route.screen === "catalog") screen = <Catalog {...common} apartments={apartments} filters={filters} setFilters={setFilters} onOpen={openApt} saved={saved} toggleSave={toggleSave} />;
  else if (route.screen === "detail") screen = <Detail {...common} apt={route.apt} range={range} setRange={setRange} onBack={goCatalog} onBook={book} saved={saved} toggleSave={toggleSave} />;
  else if (route.screen === "booking") screen = <Booking {...common} apt={route.apt} range={range} onBack={() => setRoute({ screen: "detail", apt: route.apt })} onHome={goCatalog} onBooked={refreshApartments} />;
  else if (route.screen === "saved") screen = <SavedPage {...common} apartments={apartments} saved={saved} toggleSave={toggleSave} onOpen={openApt} auth={auth} onLogin={login} />;
  else if (route.screen === "bookings") screen = <BookingsPage {...common} auth={auth} onLogin={login} onOpen={openApt} onBookAgain={openApt} bookings={myBookings} apartments={apartments} />;
  else if (route.screen === "account") screen = <AccountPage {...common} auth={auth} onLogin={login} onLogout={logout} setLang={setLang} />;
  else if (route.screen === "admin") screen = <Admin {...common} onExit={goCatalog} />;

  const desktop = device === "desktop";
  const showNav = GUEST_TABS.includes(route.screen);

  return (
    <>
      {screen}
      {showNav && !desktop && <BottomNav tab={navTab} setTab={setTab} lang={lang} STR={STR} />}

      <LangSheet open={langOpen} onClose={() => setLangOpen(false)} lang={lang} setLang={setLang} STR={STR} desktop={desktop} />

      {/* Discreet admin entry (prototype only — real admin lives on admin.maskan.uz) */}
      {route.screen !== "admin" && (
        <button onClick={goAdmin}
          className="fixed left-3 bottom-[76px] sm:bottom-3 z-30 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-white/70 backdrop-blur border border-line text-[11px] font-semibold text-inksoft/70 hover:text-ink hover:border-ink/30 transition">
          <Icon name="lock" size={12} />admin
        </button>
      )}
    </>
  );
}
