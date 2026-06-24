"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MASKAN } from "./data";
import { Icon, Sheet } from "./ui";
import { Catalog } from "./catalog";
import { SavedPage, BookingsPage, AccountPage, BottomNav } from "./account";
import { Admin } from "./admin";
import { getApartments, getFavorites, getMyBookings, addFavorite, removeFavorite, getMyRole, getRates, RATE_FALLBACK } from "./db";
import { sb, mapUser, signInWithGoogle, signOut } from "./auth";
import { CURRENCY_CODES, defaultCurrencyFor } from "./money";

const LANGS = ["uz", "ru", "en"];
const DESKTOP_MIN_WIDTH = 760;

function getDeviceMode() {
  if (typeof window === "undefined") return "mobile";
  const width = window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0;
  const screenMin = Math.min(window.screen?.width || width, window.screen?.height || width);
  const coarseTouch = window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches || false;
  const ua = navigator.userAgent || "";
  const uaMobile = navigator.userAgentData?.mobile || /Android|iPhone|iPod|Mobile|Windows Phone/i.test(ua);

  // Some Android browsers in "desktop site" mode report a wide layout viewport, but the
  // physical CSS screen remains phone-sized. Keep those on the mobile app shell.
  if (width < DESKTOP_MIN_WIDTH || uaMobile || (coarseTouch && screenMin < DESKTOP_MIN_WIDTH)) return "mobile";
  return "desktop";
}

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
  const router = useRouter();
  const [lang, setLang] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("maskan_lang") : null;
    return ["uz", "ru", "en"].includes(saved) ? saved : "ru"; // first visit defaults to Russian
  });
  const [currency, setCurrency] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("maskan_currency") : null;
    return CURRENCY_CODES.includes(saved) ? saved : defaultCurrencyFor(lang);
  });
  const [rates, setRates] = useState(RATE_FALLBACK); // per_usd; replaced by live CBU rates on load
  const [device, setDevice] = useState(getDeviceMode);
  const [route, setRoute] = useState({ screen: "catalog" });
  const [filters, setFilters] = useState({ range: { from: null, to: null }, guests: 2, district: null });
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

  // remember the chosen language across refreshes
  useEffect(() => { try { localStorage.setItem("maskan_lang", lang); } catch { /* ignore */ } }, [lang]);
  // remember the chosen display currency; load live FX rates once
  useEffect(() => { try { localStorage.setItem("maskan_currency", currency); } catch { /* ignore */ } }, [currency]);
  useEffect(() => { getRates().then(setRates).catch(() => {}); }, []);

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
    const onResize = () => setDevice(getDeviceMode());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    onResize();
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [route.screen]);

  // On load: restore the top-level screen from the URL hash + seed a history entry so Back walks
  // in-app history (apartment detail is its own /apartment/[id] route, handled by Next).
  useEffect(() => {
    const top = (window.location.hash || "").replace(/^#/, "").split("/")[0];
    const screen = ["saved", "bookings", "account", "admin"].includes(top) ? top : "catalog";
    setRoute({ screen });
    window.history.replaceState({ screen }, "");
  }, []);

  // Back/Forward buttons → restore the top-level screen from history state (forward nav via go()).
  useEffect(() => {
    const onPop = (e) => setRoute({ screen: (e.state && e.state.screen) || "catalog" });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openLang = () => setLangOpen(true);
  // forward navigation: update state + push a history entry (so Back returns here, in-app)
  const go = (next) => {
    setRoute(next);
    const url = ["saved", "bookings", "account", "admin"].includes(next.screen) ? "#" + next.screen : "/";
    window.history.pushState({ screen: next.screen }, "", url);
  };
  const goCatalog = () => go({ screen: "catalog" });
  const goAdmin = () => go({ screen: "admin" });
  // apartment detail is now its own SEO route (SSR) — navigate there instead of an in-SPA screen
  const openApt = (apt) => { router.push(lang === "uz" ? `/apartment/${apt.id}` : `/${lang}/apartment/${apt.id}`); };
  const toggleSave = (id) => setSaved((s) => {
    const n = new Set(s);
    if (n.has(id)) { n.delete(id); if (auth) removeFavorite(id); }
    else { n.add(id); if (auth) addFavorite(id); }
    return n;
  });
  const login = () => signInWithGoogle(); // Telegram has its own button (bot-nonce flow)
  const logout = () => signOut();

  const GUEST_TABS = ["catalog", "saved", "bookings", "account"];
  const navTab = route.screen === "catalog" ? "search" : route.screen;
  const setTab = (key) => { key === "search" ? goCatalog() : go({ screen: key }); };

  const common = { lang, STR, device, openLang, tab: navTab, setTab, currency, setCurrency, rates };
  let screen;
  if (route.screen === "catalog") screen = <Catalog {...common} apartments={apartments} filters={filters} setFilters={setFilters} onOpen={openApt} saved={saved} toggleSave={toggleSave} />;
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
