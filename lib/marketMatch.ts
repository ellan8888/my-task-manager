// lib/marketMatch.ts — baca spesifikasi akun (income / speed / max) + cocokkan pesaing dengan produk kita.
// Dipakai halaman Harga Pasar (klien) dan API — tanpa akses database, murni hitungan.
//
// parseSpecs = versi TypeScript dari market_specs.py di bot (aturan sama), dipakai untuk membaca
// spesifikasi PRODUK KITA dari nama kategori Live Stock ("akun income 20t+/s speed 2t-10t+").

export type Range = [number, number | null];
export type Specs = { income?: Range; speed?: Range; max?: boolean; starter?: boolean };

const UNITS: Record<string, number> = {
  K: 1e3, M: 1e6, B: 1e9, T: 1e12, QA: 1e15, QI: 1e18, SX: 1e21, SP: 1e24, OC: 1e27, NO: 1e30, DC: 1e33,
};
const UNIT = "(QA|QI|SX|SP|OC|NO|DC|K|M|B|T)";
const NUM = "([0-9OZILS][0-9OZILS.,]*)";
const RANGE_RE = new RegExp(
  `${NUM}\\s*${UNIT}?\\s*(?:/S)?\\s*(?:-|–|~|S/D|TO|SAMPAI)\\s*${NUM}\\s*${UNIT}(?![A-Z])` +
    `|${NUM}\\s*${UNIT}(?![A-Z])\\s*(\\+)?`,
  "g",
);
const FIX: Record<string, string> = { O: "0", Z: "2", I: "1", L: "1", S: "5" };
const KEYS: Record<"income" | "speed", string[]> = {
  income: ["INCOME", "INCOM", "INC0ME", "PENGHASILAN", "/S"],
  speed: ["SPEED", "SPED", "SPEEO", "KECEPATAN"],
};

function num(tok: string): number | null {
  let t = tok.replace(/[OZILS]/g, (c) => FIX[c]).replace(/,/g, ".");
  if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type Found = { pos: number; lo: number; hi: number; plus: boolean };

function ranges(text: string): Found[] {
  const out: Found[] = [];
  for (const m of text.matchAll(RANGE_RE)) {
    if (m[1]) {
      const u2 = UNITS[m[4]];
      const u1 = m[2] ? UNITS[m[2]] : u2;
      const a = num(m[1]);
      const b = num(m[3]);
      if (a == null || b == null) continue;
      let lo = a * u1;
      let hi = b * u2;
      if (lo > hi) [lo, hi] = [hi, lo];
      out.push({ pos: m.index ?? 0, lo, hi, plus: false });
    } else {
      const a = num(m[5]);
      if (a == null) continue;
      const v = a * UNITS[m[6]];
      out.push({ pos: m.index ?? 0, lo: v, hi: v, plus: !!m[7] });
    }
  }
  return out;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

export function parseSpecs(text: string | null | undefined): Specs {
  if (!text) return {};
  const t = " " + String(text).toUpperCase().replace(/\s+/g, " ") + " ";
  const found = ranges(t);
  const specs: Specs = {};
  for (const key of ["income", "speed"] as const) {
    let best: [number, Found] | null = null;
    for (const w of KEYS[key]) {
      for (const km of t.matchAll(new RegExp(escapeRe(w), "g"))) {
        const k = km.index ?? 0;
        let cands: Found[];
        if (w === "/S") {
          cands = found.filter((f) => k - f.pos >= 0 && k - f.pos <= 25).slice(-1);
        } else {
          const end = k + w.length;
          cands = found.filter((f) => f.pos - end >= 0 && f.pos - end <= 40).slice(0, 1);
        }
        for (const c of cands) {
          const dist = Math.abs(c.pos - k);
          if (!best || dist < best[0]) best = [dist, c];
        }
      }
      if (best && w !== "/S") break;
    }
    const hit = best as [number, Found] | null;
    if (hit) specs[key] = [hit[1].lo, hit[1].plus ? null : hit[1].hi];
  }
  if (!specs.income) {
    const m = t.match(new RegExp(`${NUM}\\s*${UNIT}\\s*/S`));
    if (m) {
      const a = num(m[1]);
      if (a != null) specs.income = [a * UNITS[m[2]], a * UNITS[m[2]]];
    }
  }
  if (/\bMAX\b|\bFULL UPGRADE|\bENDGAME\b/.test(t)) specs.max = true;
  if (/\bSTARTER\b/.test(t)) specs.starter = true;
  return specs;
}

/** Gabungkan: nilai dari `a` diutamakan, `b` mengisi yang kosong. */
export function mergeSpecs(a: Specs, b: Specs): Specs {
  return {
    income: a.income || b.income,
    speed: a.speed || b.speed,
    max: a.max || b.max || undefined,
    starter: a.starter || b.starter || undefined,
  };
}

const UNIT_ORDER: [string, number][] = [
  ["Dc", 1e33], ["No", 1e30], ["Oc", 1e27], ["Sp", 1e24], ["Sx", 1e21], ["Qi", 1e18],
  ["Qa", 1e15], ["T", 1e12], ["B", 1e9], ["M", 1e6], ["K", 1e3],
];
export function fmtNum(v: number | null | undefined) {
  if (v == null) return "";
  for (const [u, m] of UNIT_ORDER) {
    if (v >= m) {
      const n = v / m;
      return (n >= 10 || Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)) + u;
    }
  }
  return String(Math.round(v));
}
export const fmtRange = (r?: Range | null) =>
  !r ? null : r[1] == null ? `${fmtNum(r[0])}+` : r[0] === r[1] ? fmtNum(r[0]) : `${fmtNum(r[0])}–${fmtNum(r[1])}`;

/** "akun income 20t+/s | break and steal an egg" → "break-and-steal-an-egg" */
export function gameSlugOf(kategori: string) {
  const part = kategori.includes("|") ? kategori.split("|").pop()! : "";
  return part.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Nomor produk Itemku di ujung link ("…/kode/4436081" atau "…/4436081"). */
export function productIdFromLink(link: string | null | undefined): number | null {
  const m = String(link || "").match(/(\d{5,})\/?(?:[?#].*)?$/);
  return m ? Number(m[1]) : null;
}

// ── Pencocokan ──────────────────────────────────────────────────────────
const OPEN_FACTOR = 5;      // "20T+" dianggap 20T–100T saat dicocokkan
const NEAR_LOG = 0.35;      // selisih ≤ ±2,2x masih dianggap sebanding
const STOP = new Set([
  "akun", "account", "acc", "income", "speed", "starter", "best", "max", "full", "with", "dengan", "and",
  "the", "for", "steal", "break", "egg", "throw", "food", "animals", "roblox", "murah", "fast", "proses",
  "per", "jam", "isi", "berisikan", "bonus", "cash",
]);

function band(r: Range): [number, number] {
  return [r[0], r[1] ?? r[0] * OPEN_FACTOR];
}
/** jarak log10 antara dua rentang (0 = beririsan) */
function gap(a: Range, b: Range) {
  const [alo, ahi] = band(a);
  const [blo, bhi] = [b[0], b[1] ?? b[0]];
  if (alo <= 0 || blo <= 0) return 9;
  if (bhi < alo) return Math.log10(alo / bhi);
  if (blo > ahi) return Math.log10(blo / ahi);
  return 0;
}

/** kata kunci khas produk kita yang tidak berupa angka (mis. "secret", "last map") */
export function keywordsOf(label: string) {
  const base = label.split("|")[0].toLowerCase();
  return base
    .replace(/[0-9.,]+\s*(k|m|b|t|qa|qi|sx|sp)?\+?(\/s)?/g, " ")
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

export type Match = { relevant: boolean; score: number; reasons: string[] };

export function matchCompetitor(
  ours: Specs,
  keywords: string[],
  comp: { specs?: Specs | null; name?: string | null; description?: string | null; ocr_text?: string | null },
): Match {
  const cs = comp.specs || {};
  const reasons: string[] = [];
  let score = 0;
  let dims = 0;
  let ok = true;

  if (ours.income && cs.income) {
    const g = gap(ours.income, cs.income);
    dims++;
    score += g;
    if (g <= NEAR_LOG) reasons.push(`Income ${fmtRange(cs.income)}`);
    else ok = false;
  }
  if (ours.speed && cs.speed) {
    const g = gap(ours.speed, cs.speed);
    dims++;
    score += g * 0.5;
    if (g <= NEAR_LOG) reasons.push(`Speed ${fmtRange(cs.speed)}`);
    else if (!ours.income) ok = false;      // speed jadi patokan utama kalau income tidak ada
  }
  if (ours.max) {
    if (cs.max) {
      reasons.push("MAX");
      dims++;
    } else if (!ours.income) {
      ok = false;
    }
  }
  if (keywords.length) {
    const text = `${comp.name || ""} ${comp.description || ""} ${comp.ocr_text || ""}`.toLowerCase();
    const hit = keywords.filter((k) => text.includes(k));
    if (hit.length === keywords.length) {
      reasons.push(`"${hit.join(" ")}"`);
      dims++;
    } else if (!ours.income && !ours.speed) {
      ok = false;
    }
  }
  if (ours.income && !cs.income && !(ours.max && cs.max)) ok = false;   // income pesaing tidak terbaca
  const relevant = ok && dims > 0;
  return { relevant, score: dims ? score : 99, reasons };
}
