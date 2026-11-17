"use client";

// Tab "Produk Saya" — produk kita dari Live Stock dibandingkan dengan pesaing yang dipilih staff.
// Inti tampilan: "tangga harga" — satu garis harga berisi titik harga pesaing dan penanda harga kita,
// dengan celah ke pesaing termurah diwarnai (merah = kita kemahalan, hijau = masih ada ruang naik).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SkeletonTable } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/ToastProvider";
import { fmtRange, type Specs } from "@/lib/marketMatch";

type Product = {
  product_id: number;
  kategori: string;
  name: string;
  game_slug: string;
  price: number | null;
  stock: number;
  url: string;
  thumb_url: string | null;
  specs: Specs;
};
type Listing = {
  product_id: number;
  game_slug: string;
  name: string | null;
  url: string | null;
  seller: string | null;
  price: number | null;
  sold: number | null;
  stock: number | null;
  thumb_url: string | null;
  specs: Specs | null;
  active: boolean;
  first_seen: string;
  analyzed_at: string | null;
  image_url?: string | null;
  prev_image_url?: string | null;
  prev_specs?: Specs | null;
  banner_changed_at?: string | null;
  manual?: boolean;
};
type Watch = { our_product_id: number; competitor_id: number; added_by: string | null; created_at: string };
type Cand = [number, number, string[]];

const GAME_LABEL: Record<string, string> = {
  "break-and-steal-an-egg": "Break and Steal an Egg",
  "steal-an-egg": "Steal An Egg",
  "throw-food-for-animals": "Throw Food For Animals",
};
const NEAR_PCT = 5;
const NEW_HOURS = 48;
const BANNER_DAYS = 7;
const UNDERCUT = 1;

const rp = (n: number | null | undefined) => (n == null ? "-" : "Rp " + n.toLocaleString("id-ID"));
const usable = (l?: Listing | null) => !!l && l.active && l.stock !== 0 && l.price != null;
const shortName = (s: string) => s.split("|")[0].trim();

type Level = "expensive" | "near" | "cheapest" | "unknown";
const LEVEL: Record<Level, { label: string; bar: string; dot: string; text: string; soft: string }> = {
  expensive: {
    label: "Lebih mahal",
    bar: "bg-rose-500",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    soft: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  },
  near: {
    label: "Hampir sama",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
    text: "text-amber-600 dark:text-amber-400",
    soft: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  },
  cheapest: {
    label: "Termurah",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    soft: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  unknown: {
    label: "Belum ada pembanding",
    bar: "bg-slate-300 dark:bg-slate-700",
    dot: "bg-slate-300 dark:bg-slate-600",
    text: "text-slate-500",
    soft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};
const LEVEL_ORDER: Level[] = ["expensive", "near", "cheapest", "unknown"];

function levelOf(ours: number | null, cheapest: number | null): Level {
  if (!ours || !cheapest) return "unknown";
  const diff = ours - cheapest;
  if (diff <= 0) return "cheapest";
  return (diff / cheapest) * 100 <= NEAR_PCT ? "near" : "expensive";
}

// ── Tangga harga ─────────────────────────────────────────────────────────
type Point = { id: number; price: number; label: string; url?: string | null; muted?: boolean };

function PriceLadder({ ours, points, size }: { ours: number | null; points: Point[]; size: "sm" | "lg" }) {
  const live = points.filter((p) => !p.muted);
  const vals = [...points.map((p) => p.price), ...(ours ? [ours] : [])].filter((v) => v > 0);
  if (!vals.length || !points.length) {
    // belum ada pesaing: garis putus-putus + harga kita di tengah
    return (
      <div className={`relative ${size === "lg" ? "h-24" : "h-3"}`}>
        <div className={`absolute inset-x-0 ${size === "lg" ? "top-12" : "top-1/2"} border-t border-dashed border-slate-300 dark:border-slate-700`} />
        {ours != null && size === "lg" && (
          <>
            <span className="absolute left-1/2 top-12 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rotate-45 rounded-[3px] bg-cyan-600 ring-2 ring-white dark:ring-slate-900" />
            <div className="absolute left-1/2 top-0 -translate-x-1/2 text-center whitespace-nowrap">
              <div className="text-[11px] text-cyan-700 dark:text-cyan-400 font-semibold leading-none">Kita</div>
              <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{rp(ours)}</div>
            </div>
          </>
        )}
      </div>
    );
  }
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const useLog = hi / lo > 5;                       // rentang harga lebar → skala log supaya tidak menumpuk
  const f = (v: number) => (useLog ? Math.log(v) : v);
  lo = f(lo);
  hi = f(hi);
  if (lo === hi) {
    lo -= useLog ? 0.5 : Math.max(1, lo * 0.1);
    hi += useLog ? 0.5 : Math.max(1, hi * 0.1);
  }
  const pad = (hi - lo) * 0.06;
  const pos = (v: number) => ((f(v) - lo + pad) / (hi - lo + 2 * pad)) * 100;

  const cheapest = live.length ? Math.min(...live.map((p) => p.price)) : null;
  let seg: { from: number; to: number; cls: string } | null = null;
  if (ours && cheapest != null && ours !== cheapest) {
    const [a, b] = [pos(Math.min(ours, cheapest)), pos(Math.max(ours, cheapest))];
    seg = { from: a, to: b, cls: ours > cheapest ? "bg-rose-400/70 dark:bg-rose-500/60" : "bg-emerald-400/70 dark:bg-emerald-500/60" };
  }
  const lg = size === "lg";
  const sorted = [...points].sort((a, b) => a.price - b.price);

  return (
    <div className={`relative ${lg ? "h-24" : "h-3"} select-none`} aria-hidden={!lg}>
      <div className={`absolute inset-x-0 ${lg ? "top-12" : "top-1/2"} -translate-y-1/2 h-px bg-slate-300 dark:bg-slate-700`} />
      {seg && (
        <div
          className={`absolute ${lg ? "top-12 h-2" : "top-1/2 h-1.5"} -translate-y-1/2 rounded-full ${seg.cls}`}
          style={{ left: `${seg.from}%`, width: `${Math.max(seg.to - seg.from, 0.5)}%` }}
        />
      )}
      {sorted.map((p) => {
        const isCheapest = !p.muted && p.price === cheapest;
        const dot = (
          <span
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
              lg ? "top-12 w-3 h-3" : "top-1/2 w-2 h-2"
            } ${p.muted ? "bg-slate-300 dark:bg-slate-700" : isCheapest ? "bg-slate-800 dark:bg-slate-200" : "bg-slate-400 dark:bg-slate-500"}`}
            style={{ left: `${pos(p.price)}%` }}
            title={`${p.label} · ${rp(p.price)}${p.muted ? " (tidak dihitung)" : ""}`}
          />
        );
        return lg && p.url ? (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="focus:outline-none focus-visible:[&>span]:ring-cyan-500">
            {dot}
          </a>
        ) : (
          <span key={p.id}>{dot}</span>
        );
      })}
      {ours != null && (
        <span
          className={`absolute -translate-x-1/2 -translate-y-1/2 ${lg ? "top-12 w-4 h-4" : "top-1/2 w-3 h-3"} rotate-45 rounded-[3px] bg-cyan-600 ring-2 ring-white dark:ring-slate-900`}
          style={{ left: `${pos(ours)}%` }}
          title={`Harga kita · ${rp(ours)}`}
        />
      )}
      {lg && (
        <>
          {ours != null && (
            <div className="absolute top-0 -translate-x-1/2 text-center whitespace-nowrap" style={{ left: `${Math.min(Math.max(pos(ours), 8), 92)}%` }}>
              <div className="text-[11px] text-cyan-700 dark:text-cyan-400 font-semibold leading-none">Kita</div>
              <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{rp(ours)}</div>
            </div>
          )}
          {cheapest != null && cheapest !== ours && (
            <div className="absolute top-[3.6rem] -translate-x-1/2 text-center whitespace-nowrap" style={{ left: `${Math.min(Math.max(pos(cheapest), 8), 92)}%` }}>
              <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{rp(cheapest)}</div>
              <div className="text-[11px] text-slate-500 leading-none">pesaing termurah</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Potongan kecil ───────────────────────────────────────────────────────
export function SpecChips({ specs, dim }: { specs: Specs | null | undefined; dim?: boolean }) {
  const inc = fmtRange(specs?.income);
  const spd = fmtRange(specs?.speed);
  const base = `inline-flex items-center px-1.5 py-px rounded-md text-[11px] font-semibold tabular-nums ${dim ? "opacity-70" : ""}`;
  return (
    <>
      {inc && <span className={`${base} bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300`}>Income {inc}</span>}
      {spd && <span className={`${base} bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300`}>Speed {spd}</span>}
      {specs?.max && <span className={`${base} bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300`}>MAX</span>}
      {specs?.starter && <span className={`${base} bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300`}>Starter</span>}
    </>
  );
}

export function Thumb({ src, size = "md" }: { src: string | null | undefined; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-16 h-8" : "w-24 h-12 md:w-28 md:h-14";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className={`${cls} object-cover rounded-md shrink-0 bg-slate-100 dark:bg-slate-800`} />
  ) : (
    <div className={`${cls} rounded-md shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400`}>
      <i className="fa-regular fa-image text-xs"></i>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-xs font-semibold">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
            value === v ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Halaman ──────────────────────────────────────────────────────────────
export default function MyProducts() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [candidates, setCandidates] = useState<Record<number, Cand[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [game, setGame] = useState<string>("all");
  const [status, setStatus] = useState<Level | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<"relevant" | "all">("relevant");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"match" | "price" | "sold">("match");
  const [busy, setBusy] = useState<number | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [manualLink, setManualLink] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/market/mine").then((r) => r.json());
      if (!res.success) throw new Error(res.message || "Data harga pasar tidak bisa dimuat");
      setProducts(res.products || []);
      setListings(res.listings || []);
      setWatches(res.watches || []);
      setCandidates(res.candidates || {});
      setLoadedAt(Date.now());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const listingMap = useMemo(() => new Map(listings.map((l) => [l.product_id, l])), [listings]);
  const watchedBy = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const w of watches) m.set(w.our_product_id, [...(m.get(w.our_product_id) || []), w.competitor_id]);
    return m;
  }, [watches]);
  const takenBy = useMemo(() => new Map(watches.map((w) => [w.competitor_id, w.our_product_id])), [watches]);

  const bannerChanged = useCallback(
    (l?: Listing | null) => !!l?.banner_changed_at && loadedAt - new Date(l.banner_changed_at).getTime() < BANNER_DAYS * 86400e3,
    [loadedAt],
  );
  const freeCands = useCallback(
    (ourId: number) => (candidates[ourId] || []).filter((c) => (takenBy.get(c[0]) ?? ourId) === ourId && !(watchedBy.get(ourId) || []).includes(c[0])),
    [candidates, takenBy, watchedBy],
  );

  const info = useCallback(
    (p: Product) => {
      const comps = (watchedBy.get(p.product_id) || []).map((id) => listingMap.get(id)).filter(Boolean) as Listing[];
      const live = comps.filter(usable);
      const prices = live.map((l) => l.price!) ;
      const cheapest = prices.length ? Math.min(...prices) : null;
      const points: Point[] = comps
        .filter((l) => l.price != null)
        .map((l) => ({ id: l.product_id, price: l.price!, label: l.seller || l.name || "Pesaing", url: l.url, muted: !usable(l) }));
      return {
        comps,
        cheapest,
        points,
        level: levelOf(p.price, cheapest),
        banner: comps.filter((l) => bannerChanged(l)).length,
        cheaperCount: p.price != null ? live.filter((l) => l.price! < p.price!).length : 0,
      };
    },
    [watchedBy, listingMap, bannerChanged],
  );

  const tracked = useMemo(() => products.filter((p) => GAME_LABEL[p.game_slug]), [products]);
  const infos = useMemo(() => new Map(tracked.map((p) => [p.product_id, info(p)])), [tracked, info]);

  const counts = useMemo(() => {
    const c: Record<Level, number> = { expensive: 0, near: 0, cheapest: 0, unknown: 0 };
    for (const p of tracked) if (game === "all" || p.game_slug === game) c[infos.get(p.product_id)!.level]++;
    return c;
  }, [tracked, infos, game]);

  const groups = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rows = tracked
      .filter((p) => game === "all" || p.game_slug === game)
      .filter((p) => status === "all" || infos.get(p.product_id)!.level === status)
      .filter((p) => !s || p.name.toLowerCase().includes(s))
      .sort((a, b) => (a.specs.income?.[0] ?? a.specs.speed?.[0] ?? 0) - (b.specs.income?.[0] ?? b.specs.speed?.[0] ?? 0) || a.name.localeCompare(b.name));
    const g = new Map<string, Product[]>();
    for (const p of rows) g.set(p.game_slug, [...(g.get(p.game_slug) || []), p]);
    return [...g.entries()].sort((a, b) => GAME_LABEL[a[0]].localeCompare(GAME_LABEL[b[0]]));
  }, [tracked, infos, game, status, search]);

  const current = tracked.find((p) => p.product_id === selected) || null;
  const cur = current ? infos.get(current.product_id)! : null;

  const candList = useMemo(() => {
    if (!current) return [];
    const watched = new Set(watchedBy.get(current.product_id) || []);
    const rel = new Map((candidates[current.product_id] || []).map((c) => [c[0], c]));
    let rows: { l: Listing; match: Cand | null }[] =
      mode === "relevant"
        ? [...rel.values()].map((c) => ({ l: listingMap.get(c[0])!, match: c })).filter((r) => r.l)
        : listings.filter((l) => l.game_slug === current.game_slug && l.active).map((l) => ({ l, match: rel.get(l.product_id) || null }));
    rows = rows.filter((r) => !watched.has(r.l.product_id) && (takenBy.get(r.l.product_id) ?? current.product_id) === current.product_id);
    const s = q.trim().toLowerCase();
    if (s) rows = rows.filter((r) => `${r.l.name} ${r.l.seller}`.toLowerCase().includes(s));
    rows.sort((a, b) => {
      if (sort === "price") return (a.l.price ?? 9e15) - (b.l.price ?? 9e15);
      if (sort === "sold") return (b.l.sold ?? 0) - (a.l.sold ?? 0);
      return (a.match ? a.match[1] : 99) - (b.match ? b.match[1] : 99) || (b.l.sold ?? 0) - (a.l.sold ?? 0);
    });
    return rows;
  }, [current, candidates, listings, listingMap, watchedBy, takenBy, mode, q, sort]);

  const hiddenTaken = current
    ? listings.filter((l) => l.game_slug === current.game_slug && l.active && takenBy.has(l.product_id) && takenBy.get(l.product_id) !== current.product_id).length
    : 0;

  const select = (id: number) => {
    setSelected(id);
    setMode("relevant");
    setQ("");
    setShowAll(false);
    // di HP daftar disembunyikan saat detail dibuka → bawa layar ke atas
    if (window.matchMedia("(max-width: 1023px)").matches) requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
  };

  const setWatch = async (competitor: number, watch: boolean) => {
    if (!current) return;
    setBusy(competitor);
    try {
      const res = await fetch("/api/market/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ our_product_id: current.product_id, competitor_id: competitor, watch }),
      }).then((r) => r.json());
      if (!res.success) throw new Error(res.message || "Pilihan belum tersimpan, coba lagi");
      setWatches((ws) =>
        watch
          ? [...ws, { our_product_id: current.product_id, competitor_id: competitor, added_by: null, created_at: new Date().toISOString() }]
          : ws.filter((w) => !(w.our_product_id === current.product_id && w.competitor_id === competitor)),
      );
      if (watch) toast.success("Pesaing dipantau");
      else toast.info("Pesaing dilepas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const addManual = async () => {
    if (!current || !manualLink.trim()) return;
    setManualBusy(true);
    try {
      const res = await fetch("/api/market/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ our_product_id: current.product_id, link: manualLink.trim() }),
      }).then((r) => r.json());
      if (!res.success) throw new Error(res.message || "Link belum bisa ditambahkan");
      setManualLink("");
      if (res.already) toast.info("Produk itu sudah dipantau di sini");
      else toast.success(res.created ? "Pesaing dipantau — harga & banner terbaca dalam beberapa menit" : "Pesaing dipantau");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setManualBusy(false);
    }
  };

  if (loading) return <SkeletonTable rows={6} />;
  if (error)
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-6 text-sm text-rose-700 dark:text-rose-300">
        <i className="fa-solid fa-triangle-exclamation mr-2"></i>
        {error}.{" "}
        <button onClick={() => { setLoading(true); load(); }} className="underline font-semibold">
          Muat ulang
        </button>
      </div>
    );

  const isNew = (l: Listing) => loadedAt - new Date(l.first_seen).getTime() < NEW_HOURS * 3600e3;
  const totalShown = counts.expensive + counts.near + counts.cheapest + counts.unknown;

  // ── Saran harga untuk produk terpilih ──
  let advice: { tone: Level; text: string } | null = null;
  if (current && cur) {
    if (current.price == null) advice = { tone: "unknown", text: "Harga produk ini belum terbaca dari Itemku." };
    else if (cur.cheapest == null)
      advice = { tone: "unknown", text: cur.comps.length ? "Belum ada pesaing aktif dengan stok untuk dibandingkan." : "Pilih pesaing di bawah untuk mulai membandingkan harga." };
    else if (current.price > cur.cheapest) {
      const target = cur.cheapest - UNDERCUT;
      advice = {
        tone: cur.level,
        text: `${cur.cheaperCount} pesaing lebih murah. Turunkan ke ${rp(target)} untuk jadi yang termurah (selisih ${rp(current.price - target)}).`,
      };
    } else if (current.price < cur.cheapest - UNDERCUT) {
      advice = {
        tone: "cheapest",
        text: `Kita sudah termurah. Masih ada ruang naik sampai ${rp(cur.cheapest - UNDERCUT)} (${rp(cur.cheapest - UNDERCUT - current.price)} lebih tinggi) tanpa kalah murah.`,
      };
    } else advice = { tone: "cheapest", text: "Kita termurah dengan selisih tipis dari pesaing." };
  }

  return (
    <div ref={topRef} className="space-y-5 scroll-mt-4">
      {/* Ringkasan posisi harga — sekaligus filter */}
      <section className={`rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 md:p-5 ${current ? "hidden lg:block" : ""}`}>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Posisi harga produkmu</h3>
            <p className="text-xs text-slate-500">Dibanding pesaing yang kamu pilih. Klik warna untuk menyaring daftar.</p>
          </div>
          <Segmented
            value={game}
            onChange={(g) => setGame(g)}
            options={[["all", "Semua game"], ...Object.keys(GAME_LABEL).filter((g) => tracked.some((p) => p.game_slug === g)).map((g) => [g, GAME_LABEL[g]] as [string, string])]}
          />
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          {LEVEL_ORDER.map((lv) =>
            counts[lv] ? (
              <button
                key={lv}
                onClick={() => setStatus(status === lv ? "all" : lv)}
                className={`${LEVEL[lv].bar} transition-opacity ${status !== "all" && status !== lv ? "opacity-25" : ""}`}
                style={{ width: `${(counts[lv] / Math.max(totalShown, 1)) * 100}%` }}
                aria-label={`${LEVEL[lv].label}: ${counts[lv]} produk`}
              />
            ) : null,
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {LEVEL_ORDER.map((lv) => (
            <button
              key={lv}
              onClick={() => setStatus(status === lv ? "all" : lv)}
              className={`flex items-center gap-2 text-sm rounded-md px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                status !== "all" && status !== lv ? "opacity-40" : ""
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${LEVEL[lv].dot}`}></span>
              <span className="font-bold tabular-nums text-slate-900 dark:text-white">{counts[lv]}</span>
              <span className="text-slate-600 dark:text-slate-400">{LEVEL[lv].label.toLowerCase()}</span>
            </button>
          ))}
          {status !== "all" && (
            <button onClick={() => setStatus("all")} className="text-sm text-cyan-700 dark:text-cyan-400 font-semibold">
              Tampilkan semua
            </button>
          )}
        </div>
      </section>

      <div className="grid lg:grid-cols-[minmax(320px,400px)_1fr] gap-5 items-start">
        {/* ── Daftar produk kita ── */}
        <aside className={`rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden ${current ? "hidden lg:block" : ""}`}>
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produkmu"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
          <div className="lg:max-h-[calc(100vh-19rem)] lg:overflow-y-auto">
            {groups.length === 0 && <p className="p-6 text-sm text-slate-500 text-center">Tidak ada produk yang cocok dengan filter ini.</p>}
            {groups.map(([g, rows]) => (
              <div key={g}>
                <div className="sticky top-0 z-[1] px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-100 dark:border-slate-800">
                  {GAME_LABEL[g]} <span className="font-normal">({rows.length})</span>
                </div>
                {rows.map((p) => {
                  const s = infos.get(p.product_id)!;
                  const active = selected === p.product_id;
                  const rel = freeCands(p.product_id).length;
                  return (
                    <button
                      key={p.product_id}
                      onClick={() => select(p.product_id)}
                      className={`relative w-full text-left pl-5 pr-4 py-3 border-b border-slate-100 dark:border-slate-800/80 transition-colors focus:outline-none focus-visible:bg-cyan-50 dark:focus-visible:bg-cyan-500/10 ${
                        active ? "bg-cyan-50 dark:bg-cyan-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <span className={`absolute left-0 top-0 bottom-0 w-1 ${LEVEL[s.level].bar}`} />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">{shortName(p.name)}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <SpecChips specs={p.specs} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{rp(p.price)}</div>
                          <div className="text-[11px] text-slate-500 tabular-nums">stok {p.stock}</div>
                        </div>
                      </div>
                      <div className="mt-2.5">
                        <PriceLadder ours={p.price} points={s.points} size="sm" />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        {s.comps.length ? (
                          <span className={LEVEL[s.level].text}>
                            {s.level === "expensive" || s.level === "near"
                              ? `${s.cheaperCount} pesaing lebih murah`
                              : s.level === "cheapest"
                                ? "Paling murah"
                                : "Pesaing belum aktif"}
                          </span>
                        ) : (
                          <span className="text-slate-500">{rel ? `${rel} kandidat menunggu dipilih` : "Belum ada pesaing"}</span>
                        )}
                        {s.comps.length > 0 && <span className="text-slate-400">{s.comps.length} dipantau</span>}
                        {s.banner > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            <i className="fa-solid fa-image mr-1"></i>banner berubah
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Detail produk terpilih ── */}
        {!current || !cur ? (
          <div className="hidden lg:flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-24 px-8">
            <div className="w-full max-w-sm mb-6 opacity-60">
              <PriceLadder
                ours={9000}
                points={[
                  { id: 1, price: 5000, label: "" },
                  { id: 2, price: 13000, label: "" },
                  { id: 3, price: 17800, label: "" },
                ]}
                size="sm"
              />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-300">Pilih produk di kiri</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Kamu akan melihat harga kita di antara pesaing, saran harga, dan kandidat pesaing yang bisa dipantau.
            </p>
          </div>
        ) : (
          <div className="space-y-5 min-w-0">
            <button onClick={() => setSelected(null)} className="lg:hidden text-sm font-semibold text-cyan-700 dark:text-cyan-400">
              <i className="fa-solid fa-arrow-left mr-1.5"></i>Semua produk
            </button>

            {/* Kepala: produk + tangga harga besar */}
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className={`h-1 ${LEVEL[cur.level].bar}`} />
              <div className="p-4 md:p-6">
                <div className="flex gap-4">
                  <Thumb src={current.thumb_url} />
                  <div className="min-w-0 flex-1">
                    <a href={current.url} target="_blank" rel="noreferrer" className="text-lg md:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white hover:text-cyan-700 dark:hover:text-cyan-400 leading-snug">
                      {shortName(current.name)}
                    </a>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <SpecChips specs={current.specs} />
                      <span>{GAME_LABEL[current.game_slug]}</span>
                      <span className="text-slate-300 dark:text-slate-700">/</span>
                      <span className="tabular-nums">stok {current.stock}</span>
                    </div>
                  </div>
                  <div className={`hidden sm:block self-start px-2.5 py-1 rounded-full text-xs font-semibold ${LEVEL[cur.level].soft}`}>{LEVEL[cur.level].label}</div>
                </div>

                <div className="mt-6 px-2">
                  <PriceLadder ours={current.price} points={cur.points} size="lg" />
                </div>

                {advice && (
                  <div className={`mt-4 rounded-xl px-4 py-3 text-sm flex gap-3 items-start ${LEVEL[advice.tone].soft}`}>
                    <i className={`fa-solid ${advice.tone === "expensive" ? "fa-arrow-trend-down" : advice.tone === "cheapest" ? "fa-arrow-trend-up" : advice.tone === "near" ? "fa-scale-balanced" : "fa-circle-info"} mt-0.5`}></i>
                    <div>
                      {advice.text}
                      {(advice.tone === "expensive" || advice.tone === "near" || (advice.tone === "cheapest" && advice.text.startsWith("Kita sudah"))) && (
                        <div className="text-xs opacity-80 mt-0.5">Ubah harga lewat tombol Sesuaikan Harga di Discord, channel harga-pasar.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Pesaing dipantau */}
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="px-4 md:px-6 pt-4 pb-3 flex items-center justify-between gap-3">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Pesaing dipantau <span className="text-slate-400 font-semibold tabular-nums">{cur.comps.length}</span>
                </h3>
                <span className="text-xs text-slate-500">Diurutkan dari termurah</span>
              </div>
              {cur.comps.length === 0 ? (
                <p className="px-4 md:px-6 pb-5 text-sm text-slate-500">
                  Belum ada. Pilih dari kandidat di bawah, atau tempel link produk Itemku.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[...cur.comps]
                    .sort((a, b) => Number(usable(b)) - Number(usable(a)) || (a.price ?? 9e15) - (b.price ?? 9e15))
                    .map((l) => {
                      const diff = current.price != null && l.price != null ? current.price - l.price : null;
                      const off = !usable(l);
                      return (
                        <li key={l.product_id} className={`px-4 md:px-6 py-3 ${off ? "opacity-60" : ""}`}>
                          <div className="flex gap-3 items-start">
                            <Thumb src={l.thumb_url} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3">
                                <div className="min-w-0">
                                  <a href={l.url || "#"} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-900 dark:text-white hover:text-cyan-700 dark:hover:text-cyan-400 line-clamp-2 sm:line-clamp-1">
                                    {l.name || `Produk ${l.product_id}`}
                                  </a>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                    <span className="font-medium text-slate-600 dark:text-slate-400">{l.seller || "Penjual belum terbaca"}</span>
                                    <span className="tabular-nums">{(l.sold ?? 0).toLocaleString("id-ID")} terjual</span>
                                    <SpecChips specs={l.specs} dim />
                                    {l.manual && <span className="px-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">dari link</span>}
                                  </div>
                                </div>
                                <div className="flex items-baseline gap-2 sm:block sm:text-right shrink-0">
                                  <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{rp(l.price)}</div>
                                  {diff != null && !off && (
                                    <div className={`text-[11px] font-semibold tabular-nums ${diff > 0 ? "text-rose-600 dark:text-rose-400" : diff < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
                                      {diff > 0 ? `${rp(diff)} lebih murah` : diff < 0 ? `${rp(-diff)} lebih mahal` : "sama dengan kita"}
                                    </div>
                                  )}
                                  {off && (
                                    <div className="text-[11px] text-slate-500">
                                      {!l.analyzed_at ? "menunggu dibaca" : l.stock === 0 ? "stok habis" : "tidak tampil lagi"}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {bannerChanged(l) && (
                                <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center gap-1.5">
                                  <i className="fa-solid fa-image"></i>
                                  <span className="font-semibold">Banner diganti {new Date(l.banner_changed_at!).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                                  <span className="opacity-70">dari</span>
                                  {l.prev_specs && (l.prev_specs.income || l.prev_specs.speed || l.prev_specs.max) ? <SpecChips specs={l.prev_specs} dim /> : <span>-</span>}
                                  <span className="opacity-70">jadi</span>
                                  {l.specs && (l.specs.income || l.specs.speed || l.specs.max) ? <SpecChips specs={l.specs} /> : <span>-</span>}
                                  {l.prev_image_url && <a href={l.prev_image_url} target="_blank" rel="noreferrer" className="underline ml-1">lama</a>}
                                  {l.image_url && <a href={l.image_url} target="_blank" rel="noreferrer" className="underline">baru</a>}
                                </div>
                              )}
                            </div>
                            <button
                              disabled={busy === l.product_id}
                              onClick={() => setWatch(l.product_id, false)}
                              title="Lepas dari pantauan"
                              aria-label={`Lepas ${l.seller || "pesaing"} dari pantauan`}
                              className="w-8 h-8 shrink-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                            >
                              <i className={`fa-solid ${busy === l.product_id ? "fa-spinner fa-spin" : "fa-xmark"}`}></i>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
              <div className="px-4 md:px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <i className="fa-solid fa-link absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    value={manualLink}
                    onChange={(e) => setManualLink(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addManual()}
                    placeholder="Tempel link produk Itemku yang tidak ada di kandidat"
                    className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <button
                  onClick={addManual}
                  disabled={manualBusy || !manualLink.trim()}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold disabled:opacity-40 shrink-0"
                >
                  {manualBusy ? <i className="fa-solid fa-spinner fa-spin"></i> : "Pantau link"}
                </button>
              </div>
            </section>

            {/* Kandidat */}
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="px-4 md:px-6 pt-4 pb-3 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-bold text-slate-900 dark:text-white mr-auto">Kandidat pesaing</h3>
                  <Segmented
                    value={mode}
                    onChange={(m) => { setMode(m); setShowAll(false); }}
                    options={[["relevant", `Sebanding (${freeCands(current.product_id).length})`], ["all", "Semua"]]}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Cari judul atau penjual"
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <Segmented value={sort} onChange={setSort} options={[["match", "Paling mirip"], ["price", "Termurah"], ["sold", "Terlaris"]]} />
                </div>
                <p className="text-xs text-slate-500">
                  {mode === "relevant"
                    ? "Income, speed atau MAX yang dibaca bot dari judul, deskripsi dan banner sebanding dengan produk ini."
                    : "Semua produk aktif di game ini, termasuk yang spesifikasinya tidak terbaca."}
                  {hiddenTaken > 0 && ` ${hiddenTaken} pesaing disembunyikan karena sudah dipantau produk lain.`}
                </p>
              </div>
              {candList.length === 0 ? (
                <p className="px-4 md:px-6 pb-6 text-sm text-slate-500">
                  {mode === "relevant" ? "Tidak ada kandidat sebanding. Coba lihat Semua, atau tempel link di atas." : "Tidak ada produk yang cocok dengan pencarian."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                  {candList.slice(0, showAll ? 300 : 30).map(({ l, match }) => {
                    const diff = current.price != null && l.price != null ? current.price - l.price : null;
                    return (
                      <li key={l.product_id} className="px-4 md:px-6 py-3 flex flex-wrap sm:flex-nowrap gap-x-3 gap-y-2 items-start">
                        <Thumb src={l.thumb_url} size="sm" />
                        <div className="min-w-0 flex-1 basis-[calc(100%-5rem)] sm:basis-auto">
                          <a href={l.url || "#"} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-900 dark:text-white hover:text-cyan-700 dark:hover:text-cyan-400 line-clamp-2 leading-snug">
                            {l.name}
                          </a>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span className="font-medium text-slate-600 dark:text-slate-400">{l.seller || "Penjual belum terbaca"}</span>
                            <span className="tabular-nums">{(l.sold ?? 0).toLocaleString("id-ID")} terjual</span>
                            {isNew(l) && <span className="px-1.5 rounded-md bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300 font-semibold">baru</span>}
                            {l.stock === 0 && <span className="text-amber-600">stok habis</span>}
                            <SpecChips specs={l.specs} />
                            {!l.analyzed_at ? (
                              <span className="text-slate-400">menunggu dibaca</span>
                            ) : !l.specs?.income && !l.specs?.speed && !l.specs?.max ? (
                              <span className="text-amber-600 dark:text-amber-400">spesifikasi tidak terbaca</span>
                            ) : null}
                            {match && match[2].length > 0 && (
                              <span className="text-emerald-700 dark:text-emerald-400" title={match[2].join(", ")}>
                                <i className="fa-solid fa-check mr-0.5"></i>sebanding
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 w-full pl-[4.75rem] sm:pl-0 sm:w-auto sm:contents">
                        <div className="sm:text-right shrink-0 sm:min-w-[6.5rem] mr-auto sm:mr-0">
                          <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{rp(l.price)}</div>
                          {diff != null && diff !== 0 && (
                            <div className={`text-[11px] tabular-nums whitespace-nowrap ${diff > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500"}`}>
                              {diff > 0 ? `${rp(diff)} di bawah kita` : `${rp(-diff)} di atas kita`}
                            </div>
                          )}
                        </div>
                        <button
                          disabled={busy === l.product_id}
                          onClick={() => setWatch(l.product_id, true)}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-500 dark:focus-visible:ring-offset-slate-900"
                        >
                          {busy === l.product_id ? <i className="fa-solid fa-spinner fa-spin"></i> : "Pantau"}
                        </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {candList.length > 30 && !showAll && (
                <button onClick={() => setShowAll(true)} className="w-full py-3 text-sm font-semibold text-cyan-700 dark:text-cyan-400 border-t border-slate-100 dark:border-slate-800">
                  Tampilkan {candList.length - 30} lainnya
                </button>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
