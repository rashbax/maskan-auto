"use client";
import { useState, useEffect } from "react";
import { MASKAN } from "./data";
import { Icon, Button, Sheet } from "./ui";
import { ReviewForm } from "./reviews";
import { sb, mapUser, signInWithGoogle } from "./auth";
import { getFavorites, addFavorite, removeFavorite } from "./db";

// shared auth for the SSR apartment page's client islands
function useAuth() {
  const [auth, setAuth] = useState(null);
  useEffect(() => {
    const c = sb();
    c.auth.getSession().then(({ data }) => setAuth(mapUser(data.session?.user)));
    const { data: sub } = c.auth.onAuthStateChange((_e, s) => setAuth(mapUser(s?.user)));
    return () => sub.subscription.unsubscribe();
  }, []);
  return auth;
}

function useLang(initial) {
  const [lang, setLang] = useState(initial || "uz");
  useEffect(() => {
    if (initial) return;
    const s = typeof window !== "undefined" ? localStorage.getItem("maskan_lang") : null;
    if (["uz", "ru", "en"].includes(s)) setLang(s);
  }, [initial]);
  return lang;
}

export function SaveButton({ aptId, lang }) {
  const auth = useAuth();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!auth) { setSaved(false); return; }
    getFavorites().then((s) => setSaved(s.has(aptId)));
  }, [auth, aptId]);

  function toggle() {
    if (!auth) { signInWithGoogle(); return; } // saving needs an account
    if (saved) { setSaved(false); removeFavorite(aptId); }
    else { setSaved(true); addFavorite(aptId); }
  }
  return (
    <button type="button" onClick={toggle} aria-pressed={saved}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white border border-line text-[13.5px] font-semibold hover:border-ink/30 transition shrink-0">
      <Icon name="heart" size={17} fill={saved ? "#1B5E40" : "none"} className={saved ? "text-green-600" : "text-ink"} sw={1.9} />
      {saved ? (lang === "ru" ? "Сохранено" : lang === "en" ? "Saved" : "Saqlandi") : (lang === "ru" ? "Сохранить" : lang === "en" ? "Save" : "Saqlash")}
    </button>
  );
}

export function ReviewWidget({ aptId, lang: langProp }) {
  const auth = useAuth();
  const lang = useLang(langProp);
  const STR = MASKAN.STR;
  const [open, setOpen] = useState(false);
  const onLogin = (p) => { if (p === "google") signInWithGoogle(); };
  return (
    <>
      <Button variant="outline" size="sm" icon="heart" onClick={() => setOpen(true)}>{STR[lang].leave_review}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={STR[lang].leave_review} desktop={typeof window !== "undefined" && window.innerWidth >= 760}>
        <ReviewForm lang={lang} STR={STR} onSubmit={() => setOpen(false)} auth={auth} onLogin={onLogin} apartmentId={aptId} />
      </Sheet>
    </>
  );
}
