"use client";
import { useState, useRef, useEffect } from "react";

// In-browser translators (Yandex, etc.) flatten a single white-space:pre-line text node into one
// block and drop the line breaks. So we parse the stored description into REAL block elements —
// blank lines split paragraphs, bullet lines become a list — which translators keep intact.
const BULLET = /^[•♦●▪‣◦*·–-]\s+/;

function parse(text) {
  const lines = (text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let para = [];
  let list = [];
  const flushP = () => { if (para.length) { blocks.push({ t: "p", v: para }); para = []; } };
  const flushL = () => { if (list.length) { blocks.push({ t: "ul", v: list }); list = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushP(); flushL(); continue; } // blank line = block separator
    if (BULLET.test(line)) { flushP(); list.push(line.replace(BULLET, "")); }
    else { flushL(); para.push(line); }
  }
  flushP();
  flushL();
  return blocks;
}

export function Description({ text, lang }) {
  const blocks = parse(text);
  const ref = useRef(null);
  const [needsClamp, setNeedsClamp] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Decide whether the Read-more clamp is needed by measuring the collapsed content once.
  useEffect(() => {
    const el = ref.current;
    if (el) setNeedsClamp(el.scrollHeight > el.clientHeight + 8);
  }, []);

  if (!blocks.length) return null;
  const more = lang === "ru" ? "Показать ещё" : lang === "en" ? "Read more" : "Koʻproq";
  const less = lang === "ru" ? "Свернуть" : lang === "en" ? "Show less" : "Yopish";

  return (
    <div>
      <div
        ref={ref}
        className={`relative text-[15px] leading-relaxed text-ink/85 text-left [overflow-wrap:anywhere] space-y-3 ${expanded ? "" : "max-h-52 overflow-hidden"}`}
      >
        {blocks.map((b, i) =>
          b.t === "ul" ? (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {b.v.map((it, j) => <li key={j}>{it}</li>)}
            </ul>
          ) : (
            <p key={i}>
              {b.v.map((ln, j) => (
                <span key={j}>{ln}{j < b.v.length - 1 ? <br /> : null}</span>
              ))}
            </p>
          )
        )}
        {needsClamp && !expanded && (
          <div className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-canvas to-transparent pointer-events-none" />
        )}
      </div>
      {needsClamp && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-2 text-[14px] font-semibold text-green-700 hover:underline">
          {expanded ? less : more}
        </button>
      )}
    </div>
  );
}
