"use client";

// Produk Terlaris — apa yang paling banyak laku per hari / minggu / bulan. Hanya JUMLAH terjual (tanpa rupiah),
// boleh dilihat semua staff. Data: /api/stats/top-products (income_log, stok dari Live Stock).

import { useEffect, useMemo, useRef, useState } from "react";
import AdminHeader from "@/app/components/AdminHeader";
import { DateRange, Dropdown, FilterChip, PeriodTabs, Segment, type Opt } from "./controls";

type Range = "today" | "7d" | "30d" | "month" | "custom";
type Product = {
  rank: number;
  key: string;
  title: string;
  category: "Akun" | "Joki" | "Lainnya";
  game: string;
  n: number;
  prev_n: number;
  daily: number[];
  last_at: string;
  stock: number | null;
  per_day_7d: number;
  days_left: number | null;
};
type Restock = { key: string; title: string; stock: number; per_day_7d: number; days_left: number | null };
type Slow = { key: string; title: string; last_at: string | null; stock: number };
type Data = {
  period: { range: Range; from: string; to: string; days: string[] };
  totals: { n: number; prev_n: number; products: number };
  products: Product[];
  heatmap: number[][];
  heatmap_from: string;
  restock: Restock[];
  slow: Slow[];
};

const RANGES: [Exclude<Range, "custom">, string][] = [
  ["today", "Hari ini"],
  ["7d", "7 hari"],
  ["30d", "30 hari"],
  ["month", "Bulan ini"],
];
type Sort = "most" | "up" | "down" | "new";
const SORTS: Opt<Sort>[] = [
  { value: "most", label: "Terbanyak terjual", icon: "fa-arrow-down-wide-short" },
  { value: "up", label: "Paling naik", hint: "dibanding periode sebelumnya", icon: "fa-arrow-trend-up" },
  { value: "down", label: "Paling turun", hint: "dibanding periode sebelumnya", icon: "fa-arrow-trend-down" },
  { value: "new", label: "Baru laku", hint: "tidak laku di periode sebelumnya", icon: "fa-sparkles" },
];
const CAT_DOT = { Akun: "bg-blue-500", Joki: "bg-violet-500", Lainnya: "bg-slate-400" } as const;
const PREV_LABEL: Record<Range, string> = {
  today: "kemarin",
  "7d": "7 hari sebelumnya",
  "30d": "30 hari sebelumnya",
  month: "periode yang sama sebelumnya",
  custom: "periode sebelumnya",
};
const DOW = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DOW_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const HEAT_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Senin di atas

const wibYmd = (d: Date) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
const shortTitle = (t: string) => t.split("|")[0].trim();
const fmtDay = (ymd: string) =>
  new Date(ymd + "T00:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

function ago(iso: string | null) {
  if (!iso) return "belum pernah";
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 60) return `${Math.max(1, Math.round(m))} menit lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
}

/** perubahan vs periode sebelumnya */
function Delta({ n, prev }: { n: number; prev: number }) {
  if (!prev && !n) return null;
  if (!prev) return <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">baru</span>;
  const d = n - prev;
  if (d === 0) return <span className="text-[11px] font-semibold text-slate-400">sama</span>;
  const pct = Math.round((Math.abs(d) / prev) * 100);
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
        d > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      }`}
      title={`Sebelumnya ${prev} terjual`}
    >
      <i className={`fa-solid ${d > 0 ? "fa-arrow-up" : "fa-arrow-down"} text-[9px]`}></i>
      {pct}%
    </span>
  );
}

/** tren harian kecil — satu warna, titik terakhir ditandai */
function Spark({ values, days, tone = "text-violet-500 dark:text-violet-400" }: { values: number[]; days: string[]; tone?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (values.length < 2) return null;
  const W = 120;
  const H = 32;
  const max = Math.max(1, ...values);
  const step = W / (values.length - 1);
  const pts = values.map((v, i) => [i * step, H - 3 - (v / max) * (H - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <div className="relative">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className={`overflow-visible ${tone}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(values.length - 1, Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)))));
        }}
        role="img"
        aria-label={`Tren harian: ${values.join(", ")}`}
      >
        <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={pts[hover][0]} x2={pts[hover][0]} y1={0} y2={H} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={1} />}
        <circle cx={(hover !== null ? pts[hover] : last)[0]} cy={(hover !== null ? pts[hover] : last)[1]} r={3} fill="currentColor" className="stroke-white dark:stroke-slate-900" strokeWidth={2} />
      </svg>
      {hover !== null && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-1 text-[11px] font-semibold pointer-events-none z-10">
          {fmtDay(days[hover])}: {values[hover]} terjual
        </div>
      )}
    </div>
  );
}

/** grafik batang harian (detail produk) */
function DailyBars({ values, days, tone = "bg-violet-500/85 dark:bg-violet-400/85" }: { values: number[]; days: string[]; tone?: string }) {
  const max = Math.max(1, ...values);
  const labelEvery = Math.ceil(values.length / 8);
  return (
    <div>
      <div className="flex items-end gap-[2px] h-24" role="img" aria-label="Terjual per hari">
        {values.map((v, i) => (
          <div key={days[i]} className="group relative flex-1 h-full flex items-end">
            <div
              className={`w-full rounded-t-[4px] ${tone} group-hover:brightness-110 min-h-[2px]`}
              style={{ height: `${v ? Math.max(4, (v / max) * 100) : 2}%`, opacity: v ? 1 : 0.25 }}
            />
            <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-1 text-[11px] font-semibold z-10">
              {fmtDay(days[i])}: {v}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1">
        {days.map((d, i) => (
          <div key={d} className="flex-1 text-[10px] text-slate-400 text-center tabular-nums truncate">
            {i % labelEvery === 0 ? fmtDay(d) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function StockChip({ stock, daysLeft }: { stock: number | null; daysLeft: number | null }) {
  if (stock === null) return null;
  const empty = stock === 0;
  const low = !empty && daysLeft !== null && daysLeft <= 3;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
        empty
          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          : low
            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      <i className={`fa-solid ${empty ? "fa-circle-exclamation" : low ? "fa-hourglass-half" : "fa-box"} text-[9px]`}></i>
      {empty ? "Stok habis" : `Stok ${stock}`}
      {!empty && daysLeft !== null && <span className="font-normal opacity-80">· habis ±{daysLeft < 1 ? "<1" : Math.round(daysLeft)} hari</span>}
    </span>
  );
}

function Card({ title, icon, hint, children }: { title: string; icon: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white dark:bg-slate-900 ring-1 ring-inset ring-slate-200 dark:ring-slate-800 p-4 md:p-5">
      <div className="flex items-baseline gap-2 mb-3">
        <i className={`fa-solid ${icon} text-[13px] text-slate-400`}></i>
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>
        {hint && <span className="ml-auto text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export default function ProdukTerlarisPage() {
  const [range, setRange] = useState<Range>("7d");
  const [from, setFrom] = useState(() => wibYmd(new Date(Date.now() - 13 * 86400e3)));
  const [to, setTo] = useState(() => wibYmd(new Date()));
  const [cat, setCat] = useState<"all" | "Akun" | "Joki">("all");
  const [game, setGame] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("most");
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const qs = useMemo(() => {
    const p = new URLSearchParams({ range });
    if (range === "custom") {
      p.set("from", from);
      p.set("to", to);
    }
    return p.toString();
  }, [range, from, to]);
  const reqKey = `${qs}#${nonce}`;
  const loading = loadedKey !== reqKey;
  const load = () => setNonce((n) => n + 1);

  useEffect(() => {
    let alive = true;
    fetch(`/api/stats/top-products?${qs}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (!d.success) throw new Error(d.message || "Gagal memuat");
        setData(d);
        setError("");
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoadedKey(`${qs}#${nonce}`));
    return () => {
      alive = false;
    };
  }, [qs, nonce]);

  // "/" → langsung ke kolom cari
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const all = useMemo(() => data?.products || [], [data]);
  // jumlah per pilihan filter (ikut filter lain supaya angkanya jujur)
  const catCount = (c: "Akun" | "Joki") => all.filter((p) => p.category === c && (game === "all" || p.game === game)).length;
  const gameOpts = useMemo<Opt<string>[]>(() => {
    const counts = new Map<string, number>();
    for (const p of all) if (cat === "all" || p.category === cat) counts.set(p.game, (counts.get(p.game) || 0) + p.n);
    return [
      { value: "all", label: "Semua game", icon: "fa-gamepad", count: [...counts.values()].reduce((a, b) => a + b, 0) },
      ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => ({ value: g, label: g, count: n, icon: "fa-cube" })),
    ];
  }, [all, cat]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = all.filter(
      (p) => (cat === "all" || p.category === cat) && (game === "all" || p.game === game) && (!s || p.title.toLowerCase().includes(s)),
    );
    const diff = (p: Product) => p.n - p.prev_n;
    if (sort === "up") return [...f].filter((p) => diff(p) > 0).sort((a, b) => diff(b) - diff(a) || b.n - a.n);
    if (sort === "down") return [...f].filter((p) => diff(p) < 0).sort((a, b) => diff(a) - diff(b));
    if (sort === "new") return [...f].filter((p) => !p.prev_n).sort((a, b) => b.n - a.n);
    return f;
  }, [all, cat, game, q, sort]);
  const shown = showAll ? list : list.slice(0, 15);
  const max = Math.max(1, ...list.map((p) => p.n));
  const base = all.filter((p) => (cat === "all" || p.category === cat) && (game === "all" || p.game === game));
  const filteredTotal = base.reduce((s, p) => s + p.n, 0);
  const filteredPrev = base.reduce((s, p) => s + p.prev_n, 0);
  const podium = sort === "most" && !q ? list.slice(0, 3) : [];

  const busiest = useMemo(() => {
    if (!data) return null;
    let best = { dow: 0, hour: 0, n: 0 };
    data.heatmap.forEach((row, dow) => row.forEach((n, hour) => n > best.n && (best = { dow, hour, n })));
    return best.n ? best : null;
  }, [data]);
  const heatMax = Math.max(1, ...(data?.heatmap.flat() || [0]));
  const days = data?.period.days || [];
  const periodText = days.length > 1 ? `${fmtDay(days[0])} – ${fmtDay(days[days.length - 1])}` : days[0] ? fmtDay(days[0]) : "";
  const filtersOn = cat !== "all" || game !== "all" || q.trim() !== "" || sort !== "most";
  const clearAll = () => {
    setCat("all");
    setGame("all");
    setQ("");
    setSort("most");
  };

  return (
    <>
      <AdminHeader icon="fa-ranking-star" title="Produk Terlaris" subtitle="Yang paling banyak laku — jumlah terjual per produk" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 md:py-7 space-y-5">
          {/* ── filter ── */}
          <section className="rounded-3xl bg-white/70 dark:bg-slate-900/60 ring-1 ring-slate-200 dark:ring-slate-800 p-3 md:p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <PeriodTabs value={range === "custom" ? ("" as Exclude<Range, "custom">) : range} options={RANGES} onChange={(v) => setRange(v)} />
              <DateRange
                from={from}
                to={to}
                active={range === "custom"}
                onApply={(f, t) => {
                  setFrom(f);
                  setTo(t);
                  setRange("custom");
                }}
              />
              <span className="ml-auto hidden md:flex items-center gap-1.5 text-[12px] text-slate-400">
                {loading ? <i className="fa-solid fa-circle-notch fa-spin text-[11px]"></i> : <i className="fa-regular fa-calendar text-[11px]"></i>}
                {periodText}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-[auto_minmax(0,14rem)_minmax(0,1fr)] items-center">
              <Segment
                value={cat}
                onChange={setCat}
                options={[
                  { value: "all", label: "Semua", count: all.filter((p) => game === "all" || p.game === game).length },
                  { value: "Akun", label: "Akun", dot: CAT_DOT.Akun, count: catCount("Akun") },
                  { value: "Joki", label: "Joki", dot: CAT_DOT.Joki, count: catCount("Joki") },
                ]}
              />
              <Dropdown label="Game" icon="fa-gamepad" value={game} options={gameOpts} onChange={setGame} width="w-72" />
              <label className="relative block">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] text-slate-400"></i>
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari produk, mis. 100B atau treadmill"
                  className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-inset ring-slate-200 dark:ring-slate-700 hover:ring-slate-300 dark:hover:ring-slate-600 text-base md:text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 caret-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                {q ? (
                  <button onClick={() => setQ("")} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg grid place-items-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <i className="fa-solid fa-xmark text-[12px]"></i>
                  </button>
                ) : (
                  <kbd className="hidden md:block absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md text-[11px] font-semibold text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700">/</kbd>
                )}
              </label>
            </div>
            {filtersOn && (
              <div className="flex flex-wrap items-center gap-1.5">
                {cat !== "all" && <FilterChip onClear={() => setCat("all")}>{cat} saja</FilterChip>}
                {game !== "all" && <FilterChip onClear={() => setGame("all")}>{game}</FilterChip>}
                {q.trim() && <FilterChip onClear={() => setQ("")}>&ldquo;{q.trim()}&rdquo;</FilterChip>}
                {sort !== "most" && <FilterChip onClear={() => setSort("most")}>{SORTS.find((x) => x.value === sort)?.label}</FilterChip>}
                <button onClick={clearAll} className="text-[12px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2">
                  Hapus semua
                </button>
              </div>
            )}
          </section>

          {error && (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 ring-1 ring-rose-200 dark:ring-rose-500/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              {error}
              <button onClick={load} className="ml-auto font-semibold underline">Coba lagi</button>
            </div>
          )}

          {/* ── podium 3 teratas + ringkasan ── */}
          <div className={`grid gap-3 lg:grid-cols-[minmax(0,1fr)_17rem] items-start transition-opacity ${loading && data ? "opacity-60" : ""}`}>
            <div className="flex sm:grid sm:grid-cols-3 gap-3 items-stretch overflow-x-auto snap-x snap-mandatory scroll-px-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible [scrollbar-width:none]">
              {(podium.length ? podium : [null, null, null]).map((p, i) => (
                <button
                  key={p?.key || i}
                  disabled={!p}
                  onClick={() => {
                    if (!p) return;
                    setOpen(p.key);
                    setTimeout(() => document.getElementById(`row-${p.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                  }}
                  className={`group relative shrink-0 w-[78%] sm:w-auto snap-start text-left rounded-3xl p-4 md:p-5 overflow-hidden ring-1 ring-inset transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                    i === 0
                      ? "bg-gradient-to-br from-violet-600 to-indigo-700 text-white ring-violet-500/40 shadow-lg shadow-violet-700/25 sm:row-span-1"
                      : "bg-white dark:bg-slate-900 ring-slate-200 dark:ring-slate-800 hover:ring-slate-300 dark:hover:ring-slate-700"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute -right-2 -bottom-6 text-[7rem] leading-none font-black tabular-nums select-none ${
                      i === 0 ? "text-white/10" : "text-slate-900/[0.04] dark:text-white/[0.05]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {p ? (
                    <>
                      <div className={`text-[12px] font-semibold ${i === 0 ? "text-violet-100" : "text-slate-400"}`}>
                        {i === 0 ? "Paling laku" : `Peringkat ${i + 1}`}
                      </div>
                      <div className={`mt-1.5 text-[15px] font-bold leading-snug line-clamp-2 min-h-[2.6em] ${i === 0 ? "" : "text-slate-900 dark:text-white"}`}>{shortTitle(p.title)}</div>
                      <div className="mt-3 flex items-end gap-2">
                        <span className="text-3xl font-black tabular-nums leading-none">{p.n}</span>
                        <span className={`text-[12px] mb-0.5 ${i === 0 ? "text-violet-100" : "text-slate-400"}`}>terjual</span>
                        <span className={`ml-auto mb-0.5 ${i === 0 ? "[&_*]:!text-white" : ""}`}>
                          <Delta n={p.n} prev={p.prev_n} />
                        </span>
                      </div>
                      <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${i === 0 ? "text-violet-100" : "text-slate-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-white/70" : CAT_DOT[p.category]}`} />
                        {p.category} · {p.game}
                      </div>
                    </>
                  ) : (
                    <div className="h-[8.5rem] flex items-center justify-center text-[13px] text-slate-400">
                      {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : sort !== "most" || q ? "Urutan khusus aktif" : "Belum ada"}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <dl className="rounded-3xl bg-white dark:bg-slate-900 ring-1 ring-inset ring-slate-200 dark:ring-slate-800 divide-y divide-slate-100 dark:divide-slate-800 px-4">
              <div className="flex items-center gap-3 py-3">
                <dt className="text-[12px] text-slate-500 flex-1">Terjual</dt>
                <dd className="flex items-baseline gap-2">
                  {data && <Delta n={filteredTotal} prev={filteredPrev} />}
                  <span className="text-xl font-black tabular-nums" title={`${PREV_LABEL[range]}: ${filteredPrev}`}>{data ? filteredTotal : "–"}</span>
                </dd>
              </div>
              <div className="flex items-center gap-3 py-3">
                <dt className="text-[12px] text-slate-500 flex-1">Produk laku</dt>
                <dd className="text-xl font-black tabular-nums">{data ? base.length : "–"}</dd>
              </div>
              <div className="flex items-center gap-3 py-3">
                <dt className="text-[12px] text-slate-500 flex-1">Paling ramai</dt>
                <dd className="text-[13px] font-bold tabular-nums text-right">
                  {busiest ? `${DOW[busiest.dow]}, ${String(busiest.hour).padStart(2, "0")}.00` : "–"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-5 items-start">
            {/* ── peringkat ── */}
            <section className="relative rounded-3xl bg-white dark:bg-slate-900 ring-1 ring-inset ring-slate-200 dark:ring-slate-800 overflow-hidden">
              {loading && (
                <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
                  <div className="h-full w-1/3 bg-violet-500" style={{ animation: "indeterminate 1.2s ease-in-out infinite" }} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold">Peringkat</h2>
                  <p className="text-[12px] text-slate-400">{list.length} produk · klik untuk lihat grafik harian</p>
                </div>
                <div className="ml-auto w-56">
                  <Dropdown label="Urutkan" icon="fa-sort" value={sort} options={SORTS} onChange={setSort} align="right" />
                </div>
              </div>
              {!loading && !list.length && (
                <div className="px-5 py-14 text-center">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tidak ada produk yang cocok</div>
                  <p className="text-[13px] text-slate-500 mt-1">Coba periode lain atau hapus filter.</p>
                  {filtersOn && (
                    <button onClick={clearAll} className="mt-3 px-3.5 py-1.5 rounded-xl text-[13px] font-semibold bg-violet-600 text-white hover:bg-violet-500">
                      Hapus semua filter
                    </button>
                  )}
                </div>
              )}
              <ol className={`transition-opacity ${loading && data ? "opacity-60" : ""}`}>
                {shown.map((p, idx) => {
                  const isOpen = open === p.key;
                  const pos = idx + 1;
                  return (
                    <li key={p.key} id={`row-${p.key}`} className={`scroll-mt-24 border-b border-slate-100 dark:border-slate-800/80 last:border-0 ${isOpen ? "bg-slate-50/80 dark:bg-slate-800/30" : ""}`}>
                      <button
                        onClick={() => setOpen(isOpen ? null : p.key)}
                        aria-expanded={isOpen}
                        className="group w-full text-left px-4 md:px-5 py-3.5 flex items-center gap-3 md:gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-800/40"
                      >
                        <span
                          className={`w-8 h-8 shrink-0 rounded-xl grid place-items-center tabular-nums font-black text-[13px] ${
                            pos === 1
                              ? "bg-violet-600 text-white"
                              : pos <= 3
                                ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                                : "text-slate-400"
                          }`}
                        >
                          {pos}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-semibold leading-snug text-slate-900 dark:text-slate-100">{shortTitle(p.title)}</div>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                              <span className={`w-1.5 h-1.5 rounded-full ${CAT_DOT[p.category]}`} />
                              {p.category}
                            </span>
                            <span>{p.game}</span>
                            <StockChip stock={p.stock} daysLeft={p.days_left} />
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${p.category === "Joki" ? "bg-violet-500 dark:bg-violet-400" : "bg-blue-500 dark:bg-blue-400"}`}
                              style={{ width: `${(p.n / max) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="hidden sm:block shrink-0">
                          <Spark values={p.daily} days={days} tone={p.category === "Joki" ? "text-violet-500 dark:text-violet-400" : "text-blue-500 dark:text-blue-400"} />
                        </div>
                        <div className="w-16 shrink-0 text-right">
                          <div className="text-xl font-black tabular-nums leading-none">{p.n}</div>
                          <div className="mt-1"><Delta n={p.n} prev={p.prev_n} /></div>
                        </div>
                        <i className={`fa-solid fa-chevron-down text-[10px] text-slate-300 dark:text-slate-600 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}></i>
                      </button>
                      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                        <div className="overflow-hidden">
                          {isOpen && (
                            <div className="px-4 md:px-5 pb-5 pl-[3.75rem] md:pl-[4.25rem]">
                              <div className="text-[12px] text-slate-500 mb-3 break-words">{p.title}</div>
                              {days.length > 1 && (
                                <DailyBars
                                  values={p.daily}
                                  days={days}
                                  tone={p.category === "Joki" ? "bg-violet-500/85 dark:bg-violet-400/85" : "bg-blue-500/85 dark:bg-blue-400/85"}
                                />
                              )}
                              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-[12px]">
                                {[
                                  ["Periode ini", `${p.n} terjual`],
                                  ["Sebelumnya", `${p.prev_n} terjual`],
                                  ["Rata-rata 7 hari", `${p.per_day_7d} / hari`],
                                  ["Terakhir laku", ago(p.last_at)],
                                ].map(([k, v]) => (
                                  <div key={k} className="rounded-xl bg-white dark:bg-slate-900 ring-1 ring-inset ring-slate-200 dark:ring-slate-800 px-3 py-2">
                                    <dt className="text-slate-400">{k}</dt>
                                    <dd className="font-semibold tabular-nums">{v}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {list.length > 15 && (
                <button onClick={() => setShowAll((v) => !v)} className="w-full py-3 text-[13px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                  {showAll ? "Tampilkan 15 teratas" : `Tampilkan semua (${list.length} produk)`}
                </button>
              )}
            </section>
            <div className="space-y-5">
              {/* ── perlu diisi ── */}
              <Card title="Perlu diisi" icon="fa-boxes-stacked" hint="menurut laku 7 hari">
                {!data ? (
                  <div className="text-[13px] text-slate-400">–</div>
                ) : !data.restock.length ? (
                  <div className="text-[13px] text-slate-500">Stok aman — tidak ada yang diperkirakan habis dalam 7 hari.</div>
                ) : (
                  <ul className="space-y-2.5">
                    {data.restock.map((r) => (
                      <li key={r.key} className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold leading-snug">{shortTitle(r.title)}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">laku {r.per_day_7d}/hari · stok {r.stock}</div>
                        </div>
                        <span className={`shrink-0 text-[12px] font-bold tabular-nums ${r.stock === 0 ? "text-rose-600 dark:text-rose-400" : (r.days_left ?? 9) <= 2 ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-300"}`}>
                          {r.stock === 0 ? "Habis" : `±${(r.days_left ?? 0) < 1 ? "<1" : Math.round(r.days_left ?? 0)} hari`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* ── jam ramai ── */}
              <Card title="Jam ramai" icon="fa-clock" hint={data ? `sejak ${fmtDay(wibYmd(new Date(data.heatmap_from)))}` : undefined}>
                {data && (
                  <div>
                    <div className="grid grid-cols-[2.2rem_repeat(24,minmax(0,1fr))] gap-[2px]">
                      {HEAT_ORDER.map((dow) => (
                        <div key={dow} className="contents">
                          <div className="text-[10px] text-slate-400 leading-none self-center">{DOW_SHORT[dow]}</div>
                          {data.heatmap[dow].map((n, h) => (
                            <div
                              key={h}
                              title={`${DOW[dow]} ${String(h).padStart(2, "0")}.00: ${n} terjual`}
                              className="aspect-square rounded-[3px] bg-violet-600 dark:bg-violet-400"
                              style={{ opacity: n ? 0.15 + 0.85 * (n / heatMax) : 0.06 }}
                            />
                          ))}
                        </div>
                      ))}
                      <div />
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} className="text-[9px] text-slate-400 text-center tabular-nums">{h % 6 === 0 ? h : ""}</div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-400">
                      sepi
                      {[0.06, 0.3, 0.55, 0.8, 1].map((o) => (
                        <span key={o} className="w-3 h-3 rounded-[3px] bg-violet-600 dark:bg-violet-400" style={{ opacity: o }} />
                      ))}
                      ramai
                    </div>
                  </div>
                )}
              </Card>

              {/* ── tidak laku ── */}
              <Card title="Tidak laku 7 hari" icon="fa-moon" hint="masih ada stok">
                {!data ? (
                  <div className="text-[13px] text-slate-400">–</div>
                ) : !data.slow.length ? (
                  <div className="text-[13px] text-slate-500">Semua produk yang punya stok laku dalam 7 hari terakhir.</div>
                ) : (
                  <ul className="space-y-2">
                    {data.slow.map((s) => (
                      <li key={s.key} className="flex items-start gap-3">
                        <div className="min-w-0 flex-1 text-[13px] leading-snug">{shortTitle(s.title)}</div>
                        <div className="shrink-0 text-right text-[11px] text-slate-400 tabular-nums">
                          <div>stok {s.stock}</div>
                          <div>{s.last_at ? ago(s.last_at) : "belum pernah laku"}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
