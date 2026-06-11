"use client";
import { useState, useEffect, useRef } from "react";
import { MASKAN } from "./data";
import { Icon, Sheet } from "./ui";
import { Catalog } from "./catalog";
import { Detail } from "./detail";
import { Booking } from "./booking";
import { SavedPage, BookingsPage, AccountPage, BottomNav } from "./account";
import { Admin } from "./admin";
import { getApartments, getFavorites, getMyBookings, addFavorite, removeFavorite, getMyRole } from "./db";
import { sb, mapUser, signInWithGoogle, signInWithTelegram, signOut } from "./auth";

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
  const [role, setRole] = useState(null);

  useEffect(() => {
    let alive = true;
    getApartments()
      .then((a) => alive && setApartments(a))
      .catch((e) => { console.error("getApartments failed:", e); alive && setApartments([]); });
    return () => { alive = false; };
  }, []);

  // Complete the Telegram bot-nonce login: the magic link redirects back with the session
  // tokens in the URL fragment (#access_token=…). The PKCE browser client ignores that, so
  // pick them up explicitly, set the session, and clean the URL.
  useEffect(() => {
    const h = window.location.hash || "";
    if (!h.includes("access_token=")) return;
    const params = new URLSearchParams(h.replace(/^#/, ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (access_token && refresh_token) sb().auth.setSession({ access_token, refresh_token }).catch(() => {});
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
    if (!auth) { setSaved(new Set()); setMyBookings([]); setRole(null); return; }
    getFavorites().then(setSaved);
    getMyBookings().then(setMyBookings);
    getMyRole().then(setRole);
  }, [auth?.id]);

  useEffect(() => {
    const onResize = () => setDevice(window.innerWidth >= 760 ? "desktop" : "mobile");
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [route.screen, route.apt]);

  // restore a top-level screen from the URL hash, so a refresh keeps you put (e.g. admin).
  // Admin appends its own sub-path (#admin/list), so match on the first hash segment.
  useEffect(() => {
    const top = (window.location.hash || "").replace(/^#/, "").split("/")[0];
    if (["saved", "bookings", "account", "admin"].includes(top)) setRoute({ screen: top });
  }, []);
  // keep the hash in sync with the current top-level screen (detail/booking carry an object → not
  // hashable). Skip the first run and never clobber a deeper hash Admin already owns (#admin/list).
  const hashSynced = useRef(false);
  useEffect(() => {
    if (!hashSynced.current) { hashSynced.current = true; return; }
    const s = route.screen;
    if (!["catalog", "saved", "bookings", "account", "admin"].includes(s)) return;
    const curTop = (window.location.hash || "").replace(/^#/, "").split("/")[0];
    if (curTop === s) return;
    const want = s === "catalog" ? "" : "#" + s;
    window.history.replaceState(null, "", want || window.location.pathname + window.location.search);
  }, [route.screen]);

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
    if (provider === "telegram") { signInWithTelegram(); return; }
    signInWithGoogle();
  };
  const logout = () => signOut();
  const refreshApartments = () => getApartments().then(setApartments).catch(() => {});
  const refreshMyBookings = () => getMyBookings().then(setMyBookings).catch(() => {});
  const handleBooked = () => { refreshApartments(); refreshMyBookings(); };

  const GUEST_TABS = ["catalog", "saved", "bookings", "account"];
  const navTab = ["detail", "booking"].includes(route.screen) ? "search" : route.screen === "catalog" ? "search" : route.screen;
  const setTab = (key) => { key === "search" ? goCatalog() : setRoute({ screen: key }); };

  const common = { lang, STR, device, openLang, tab: navTab, setTab };
  let screen;
  if (route.screen === "catalog") screen = <Catalog {...common} apartments={apartments} filters={filters} setFilters={setFilters} onOpen={openApt} saved={saved} toggleSave={toggleSave} />;
  else if (route.screen === "detail") screen = <Detail {...common} apt={route.apt} range={range} setRange={setRange} onBack={goCatalog} onBook={book} saved={saved} toggleSave={toggleSave} auth={auth} onLogin={login} />;
  else if (route.screen === "booking") screen = <Booking {...common} apt={route.apt} range={range} onBack={() => setRoute({ screen: "detail", apt: route.apt })} onHome={goCatalog} onBooked={handleBooked} />;
  else if (route.screen === "saved") screen = <SavedPage {...common} apartments={apartments} saved={saved} toggleSave={toggleSave} onOpen={openApt} auth={auth} onLogin={login} />;
  else if (route.screen === "bookings") screen = <BookingsPage {...common} auth={auth} onLogin={login} onOpen={openApt} onBookAgain={openApt} bookings={myBookings} apartments={apartments} />;
  else if (route.screen === "account") screen = <AccountPage {...common} auth={auth} onLogin={login} onLogout={logout} setLang={setLang} />;
  else if (route.screen === "admin") screen = <Admin {...common} onExit={goCatalog} role={role} auth={auth} onLogin={login} />;

  const desktop = device === "desktop";
  const showNav = GUEST_TABS.includes(route.screen);

  return (
    <>
      {screen}
      {showNav && !desktop && <BottomNav tab={navTab} setTab={setTab} lang={lang} STR={STR} />}

      <LangSheet open={langOpen} onClose={() => setLangOpen(false)} lang={lang} setLang={setLang} STR={STR} desktop={desktop} />

      {/* Admin entry — only visible to a signed-in admin (hidden from guests) */}
      {role === "admin" && route.screen !== "admin" && (
        <button onClick={goAdmin}
          className="fixed left-3 bottom-[76px] sm:bottom-3 z-30 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-white/70 backdrop-blur border border-line text-[11px] font-semibold text-inksoft/70 hover:text-ink hover:border-ink/30 transition">
          <Icon name="lock" size={12} />admin
        </button>
      )}
    </>
  );
}
