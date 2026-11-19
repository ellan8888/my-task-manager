"use client";

// ChatText — isi pesan chat Itemku yang rapi: <a href> dari pesan template bot jadi tautan pendek yang bisa diklik,
// *tebal* ala WhatsApp jadi tebal, tautan polos bisa diklik, tag HTML lain dibuang, URL panjang tidak lagi membuat
// gelembung chat melebar keluar layar. Pesan panjang (template bot) dilipat dengan tombol "Tampilkan semua".
// Tanpa dangerouslySetInnerHTML: semua dibangun sebagai elemen React.

import { useState, type ReactNode } from "react";

const ENT: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
const decode = (t: string) => t.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENT[m] ?? m);

type Tok = { t: "text"; v: string } | { t: "link"; href: string; label: string };

const LINK_RE = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

/** teks Itemku (kadang HTML) → potongan teks & tautan */
function tokenize(raw: string): Tok[] {
  const out: Tok[] = [];
  const src = raw.replace(/<br\s*\/?>/gi, "\n");
  let last = 0;
  for (const m of src.matchAll(LINK_RE)) {
    if (m.index! > last) out.push({ t: "text", v: src.slice(last, m.index) });
    const label = decode(m[2].replace(/<[^>]+>/g, "")).trim();
    out.push({ t: "link", href: decode(m[1]), label });
    last = m.index! + m[0].length;
  }
  if (last < src.length) out.push({ t: "text", v: src.slice(last) });
  // sisa tag dibuang, lalu tautan polos di teks biasa dijadikan tautan
  const res: Tok[] = [];
  for (const tk of out) {
    if (tk.t === "link") {
      res.push(tk);
      continue;
    }
    const text = decode(tk.v.replace(/<\/?[a-z][^>]*>/gi, ""));
    let i = 0;
    for (const m of text.matchAll(URL_RE)) {
      if (m.index! > i) res.push({ t: "text", v: text.slice(i, m.index) });
      res.push({ t: "link", href: m[0], label: m[0] });
      i = m.index! + m[0].length;
    }
    if (i < text.length) res.push({ t: "text", v: text.slice(i) });
  }
  return res;
}

/** label tautan yang enak dibaca */
function linkLabel(href: string, label: string) {
  try {
    const u = new URL(href);
    const q = u.pathname.match(/\/queue\/(OD\d+)/i);
    if (q) return `Status order #${q[1].replace(/^OD0*/i, "")}`;
    if (label && label !== href && !/^https?:\/\//i.test(label)) return label;
    const host = u.hostname.replace(/^www\./, "");
    const path = (u.pathname + u.search).replace(/\/$/, "");
    const full = host + path;
    return full.length > 34 ? full.slice(0, 33) + "…" : full;
  } catch {
    return label || href;
  }
}

/** *tebal* (satu baris) → <strong> */
function bold(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let i = 0;
  for (const m of text.matchAll(/\*([^*\n]{1,120})\*/g)) {
    if (m.index! > i) parts.push(text.slice(i, m.index));
    parts.push(<strong key={`${key}b${m.index}`} className="font-semibold">{m[1]}</strong>);
    i = m.index! + m[0].length;
  }
  if (i < text.length) parts.push(text.slice(i));
  return parts;
}

/** teks polos untuk pratinjau daftar chat (tanpa tag, tautan ditulis pendek) */
export function chatPreview(raw: string) {
  return tokenize(raw)
    .map((tk) => (tk.t === "link" ? linkLabel(tk.href, tk.label) : tk.v))
    .join("")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const LONG_CHARS = 420;
const LONG_LINES = 9;

export default function ChatText({ text, mine }: { text: string; mine: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const toks = tokenize(text);
  const plain = toks.map((t) => (t.t === "text" ? t.v : linkLabel(t.href, t.label))).join("");
  const long = plain.length > LONG_CHARS || plain.split("\n").length > LONG_LINES;
  const collapsed = long && !expanded;

  const linkCls = mine
    ? "inline-flex items-center gap-1 max-w-full align-bottom rounded-md bg-white/15 hover:bg-white/25 px-1.5 font-semibold text-white no-underline"
    : "inline-flex items-center gap-1 max-w-full align-bottom rounded-md bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 px-1.5 font-semibold text-blue-700 dark:text-blue-300 no-underline";

  return (
    <div>
      <div
        className={`whitespace-pre-wrap [overflow-wrap:anywhere] ${collapsed ? "max-h-[12.5rem] overflow-hidden" : ""}`}
        style={
          collapsed
            ? { WebkitMaskImage: "linear-gradient(#000 70%, transparent)", maskImage: "linear-gradient(#000 70%, transparent)" }
            : undefined
        }
      >
        {toks.map((tk, i) =>
          tk.t === "link" ? (
            <a key={i} href={tk.href} target="_blank" rel="noopener noreferrer" className={linkCls} title={tk.href}>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] shrink-0"></i>
              <span className="truncate">{linkLabel(tk.href, tk.label)}</span>
            </a>
          ) : (
            <span key={i}>{bold(tk.v, String(i))}</span>
          ),
        )}
      </div>
      {long && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`mt-1 text-xs font-semibold underline-offset-2 hover:underline ${mine ? "text-white/90" : "text-blue-700 dark:text-blue-300"}`}
        >
          {expanded ? "Ringkas" : "Tampilkan semua"}
        </button>
      )}
    </div>
  );
}
