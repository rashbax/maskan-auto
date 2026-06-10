"use client";
import { useEffect, useRef, useState } from "react";

const TASHKENT = [41.311, 69.279];

let _loading;
function loadYmaps() {
  const key = process.env.NEXT_PUBLIC_YANDEX_API_KEY;
  if (!key) return Promise.reject(new Error("no_key"));
  if (typeof window !== "undefined" && window.ymaps && window.ymaps.Map) return Promise.resolve(window.ymaps);
  if (_loading) return _loading;
  _loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
    s.async = true;
    s.onload = () => window.ymaps.ready(() => resolve(window.ymaps));
    s.onerror = () => reject(new Error("load_failed"));
    document.body.appendChild(s);
  });
  return _loading;
}

// ---------- Admin: click/drag to set the exact building location ----------
export function MapPicker({ lat, lng, onChange }) {
  const ref = useRef(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let map, destroyed = false;
    loadYmaps()
      .then((ymaps) => {
        if (destroyed || !ref.current) return;
        const has = lat != null && lng != null;
        const center = has ? [Number(lat), Number(lng)] : TASHKENT;
        map = new ymaps.Map(ref.current, { center, zoom: has ? 16 : 12, controls: ["zoomControl", "geolocationControl"] }, { suppressMapOpenBlock: true });
        const pm = new ymaps.Placemark(center, {}, { draggable: true, preset: "islands#redDotIcon" });
        let placed = has;
        if (placed) map.geoObjects.add(pm);
        const set = (coords) => {
          pm.geometry.setCoordinates(coords);
          if (!placed) { map.geoObjects.add(pm); placed = true; }
          onChange(coords[0], coords[1]);
        };
        map.events.add("click", (e) => set(e.get("coords")));
        pm.events.add("dragend", () => onChange(...pm.geometry.getCoordinates()));
      })
      .catch(() => setErr(true));
    return () => { destroyed = true; if (map) map.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err) return (
    <div className="h-60 rounded-2xl border border-line bg-cream grid place-items-center text-[13px] text-inksoft text-center px-6">
      Xarita yuklanmadi — <code className="font-mono">NEXT_PUBLIC_YANDEX_API_KEY</code> tekshiring
    </div>
  );
  return <div ref={ref} className="h-60 rounded-2xl overflow-hidden border border-line" />;
}

// ---------- Guest: show the exact building + directions ----------
export function MapView({ lat, lng, label, lang }) {
  const ref = useRef(null);
  const [err, setErr] = useState(false);
  const has = lat != null && lng != null;

  useEffect(() => {
    if (!has) return;
    let map, destroyed = false;
    loadYmaps()
      .then((ymaps) => {
        if (destroyed || !ref.current) return;
        map = new ymaps.Map(ref.current, { center: [Number(lat), Number(lng)], zoom: 16, controls: ["zoomControl"] }, { suppressMapOpenBlock: true });
        map.behaviors.disable("scrollZoom");
        map.geoObjects.add(new ymaps.Placemark([Number(lat), Number(lng)], { hintContent: label || "" }, { preset: "islands#greenHomeIcon" }));
      })
      .catch(() => setErr(true));
    return () => { destroyed = true; if (map) map.destroy(); };
  }, [lat, lng, has, label]);

  const ya = `https://yandex.com/maps/?pt=${lng},${lat}&z=17&l=map`;
  const gg = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const open = lang === "ru" ? "Открыть в" : lang === "uz" ? "Ochish:" : "Open in";

  if (!has) return null;
  return (
    <div>
      {err
        ? <div className="h-60 rounded-2xl border border-line bg-cream grid place-items-center text-[13px] text-inksoft px-6 text-center">Xarita yuklanmadi</div>
        : <div ref={ref} className="h-60 rounded-2xl overflow-hidden border border-line" />}
      <div className="flex gap-2.5 mt-3">
        <a href={ya} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full bg-white border border-line text-[13.5px] font-semibold hover:border-ink/30">{open} Yandex</a>
        <a href={gg} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full bg-white border border-line text-[13.5px] font-semibold hover:border-ink/30">{open} Google</a>
      </div>
    </div>
  );
}
