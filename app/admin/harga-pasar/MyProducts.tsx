"use client";

// Tab "Produk Saya" — produk kita dari Live Stock, kandidat pesaing yang relevan (dibaca dari judul /
// deskripsi / banner OCR), lalu staff memilih pesaing mana yang dipantau harganya per produk.

import { useCallback, useEffect, useMemo, useState } from "react";
import { SkeletonTable } from "@/app/components/Skeleton";
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
const BANNER_DAYS = 7;      // tanda "banner berubah" tampil selama 7 hari

const rupiah = (n: number | null | undefined) => (n == null ? "-" : "Rp " + n.toLocaleString("id-ID"));
const usable = (l?: Listing) => !!l && l.active && l.stock !== 0 && l.price != null;

type Level = "expensive" | "near" | "cheapest" | "unknown";
const LEVEL: Record<Level, { label: string; dot: string; text: string }> = {
  expensive: { label: "Lebih mahal", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  near: { label: "Hampir sama", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  cheapest: { label: "Termurah", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  unknown: { label: "Belum ada pembanding", dot: "bg-slate-400", text: "text-slate-500" },
};

function levelOf(ours: number | null, cheapest: number | null): Level {
  if (!ours || !cheapest) return "unknown";
  const diff = ours - cheapest;
  if (diff <= 0) return "cheapest";
  return (diff / cheapest) * 100 <= NEAR_PCT ? "near" : "expensive";
}

function SpecChips({ specs }: { specs: Specs | null | undefined }) {
  const inc = fmtRange(specs?.income);
  const spd = fmtRange(specs?.speed);
  return (
    <>
      {inc && <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">Income {inc}</span>}
      {spd && <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">Speed {spd}</span>}
      {specs?.max && <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">MAX</span>}
      {specs?.starter && <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Starter</span>}
    </>
  );
}

function Thumb({ src }: { src: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className="w-20 h-10 md:w-28 md:h-14 object-cover rounded-lg shrink-0 bg-slate-100 dark:bg-slate-800" />
  ) : (
    <div className="w-20 h-10 md:w-28 md:h-14 rounded-lg shrink-0 bg-slate-100 dark:bg-slate-800" />
  );
}

export default function MyProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [candidates, setCandidates] = useState<Record<number, Cand[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [game, setGame] = useState<string>("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<"relevant" | "all">("relevant");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"match" | "price" | "sold">("match");
  const [busy, setBusy] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [loadedAt, setLoadedAt] = useState(0);
  const [manualLink, setManualLink] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/market/mine").then((r) => r.json());
      if (!res.success) throw new Error(res.message || "Gagal memuat");
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const listingMap = useMemo(() => new Map(listings.map((l) => [l.product_id, l])), [listings]);
  const watchedBy = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (const w of watches) {
      if (!m.has(w.our_product_id)) m.set(w.our_product_id, new Set());
      m.get(w.our_product_id)!.add(w.competitor_id);
    }
    return m;
  }, [watches]);

  // pesaing → produk kita yang memantaunya (satu pesaing hanya untuk satu produk)
  const takenBy = useMemo(() => new Map(watches.map((w) => [w.competitor_id, w.our_product_id])), [watches]);
  const bannerChanged = useCallback(
    (l?: Listing) => !!l?.banner_changed_at && loadedAt - new Date(l.banner_changed_at).getTime() < BANNER_DAYS * 86400e3,
    [loadedAt],
  );
  const freeCands = useCallback(
    (ourId: number) => (candidates[ourId] || []).filter((c) => (takenBy.get(c[0]) ?? ourId) === ourId && !(watchedBy.get(ourId)?.has(c[0]))),
    [candidates, takenBy, watchedBy],
  );

  const summary = useCallback(
    (p: Product) => {
      const ids = [...(watchedBy.get(p.product_id) || [])];
      const prices = ids.map((id) => listingMap.get(id)).filter(usable).map((l) => l!.price!) as number[];
      const cheapest = prices.length ? Math.min(...prices) : null;
      const banner = ids.filter((id) => bannerChanged(listingMap.get(id))).length;
      return { watched: ids.length, cheapest, level: levelOf(p.price, cheapest), banner };
    },
    [watchedBy, listingMap, bannerChanged],
  );

  const games = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of products) if (GAME_LABEL[p.game_slug]) c[p.game_slug] = (c[p.game_slug] || 0) + 1;
    return c;
  }, [products]);

  const shown = useMemo(
    () =>
      products
        .filter((p) => GAME_LABEL[p.game_slug] && (game === "all" || p.game_slug === game))
        .sort((a, b) => a.game_slug.localeCompare(b.game_slug) || (a.specs.income?.[0] ?? 0) - (b.specs.income?.[0] ?? 0) || a.name.localeCompare(b.name)),
    [products, game],
  );

  const current = products.find((p) => p.product_id === selected) || null;

  const candList = useMemo(() => {
    if (!current) return [];
    const watched = watchedBy.get(current.product_id) || new Set<number>();
    const rel = new Map((candidates[current.product_id] || []).map((c) => [c[0], c]));
    let rows: { l: Listing; match: Cand | null }[];
    if (mode === "relevant") {
      rows = [...rel.values()].map((c) => ({ l: listingMap.get(c[0])!, match: c })).filter((r) => r.l);
    } else {
      rows = listings.filter((l) => l.game_slug === current.game_slug && l.active).map((l) => ({ l, match: rel.get(l.product_id) || null }));
    }
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

  const setWatch = async (competitor: number, watch: boolean) => {
    if (!current) return;
    setBusy(competitor);
    try {
      const res = await fetch("/api/market/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ our_product_id: current.product_id, competitor_id: competitor, watch }),
      }).then((r) => r.json());
      if (!res.success) throw new Error(res.message || "Gagal menyimpan");
      setWatches((ws) =>
        watch
          ? [...ws, { our_product_id: current.product_id, competitor_id: competitor, added_by: null, created_at: new Date().toISOString() }]
          : ws.filter((w) => !(w.our_product_id === current.product_id && w.competitor_id === competitor)),
      );
      setToast(watch ? "Pesaing dipantau" : "Pesaing dilepas");
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
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
      if (!res.success) throw new Error(res.message || "Gagal menambah");
      setManualLink("");
      setToast(res.already ? "Sudah dipantau di produk ini" : res.created ? "Ditambahkan — bot membaca produknya dalam beberapa menit" : "Pesaing dipantau");
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setManualBusy(false);
    }
  };

  if (loading) return <SkeletonTable rows={6} />;
  if (error)
    return (
      <div className="text-center py-16 text-rose-600">
        <i className="fa-solid fa-triangle-exclamation text-2xl mb-2 block"></i>
        {error}
      </div>
    );

  const isNew = (l: Listing) => loadedAt - new Date(l.first_seen).getTime() < NEW_HOURS * 3600e3;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[["all", "Semua game", Object.values(games).reduce((a, b) => a + b, 0)] as const, ...Object.entries(games).map(([g, n]) => [g, GAME_LABEL[g], n] as const)].map(
          ([g, label, n]) => (
            <button
              key={g}
              onClick={() => setGame(g)}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition ${
                game === g
                  ? "bg-cyan-600 border-cyan-600 text-white"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-cyan-500"
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs opacity-80">{n}</span>
            </button>
          ),
        )}
      </div>

      <div className="grid lg:grid-cols-[minmax(300px,380px)_1fr] gap-4 items-start">
        {/* Daftar produk kita */}
        <div className={`space-y-2 ${current ? "hidden lg:block" : ""}`}>
          {shown.length === 0 && <div className="text-sm text-slate-500 py-8 text-center">Belum ada produk di Live Stock untuk game ini.</div>}
          {shown.map((p) => {
            const s = summary(p);
            const rel = freeCands(p.product_id).length;
            return (
              <button
                key={p.product_id}
                onClick={() => {
                  setSelected(p.product_id);
                  setMode("relevant");
                  setQ("");
                }}
                className={`w-full text-left rounded-2xl border p-3 transition bg-white dark:bg-slate-900 ${
                  selected === p.product_id ? "border-cyan-500 ring-2 ring-cyan-500/20" : "border-slate-200 dark:border-slate-800 hover:border-cyan-400"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${LEVEL[s.level].dot}`} title={LEVEL[s.level].label}></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2">{p.name.split("|")[0].trim()}</div>
                    <div className="text-[11px] text-slate-500">{GAME_LABEL[p.game_slug]}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <SpecChips specs={p.specs} />
                    </div>
                    <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>
                        <i className="fa-solid fa-tag mr-1"></i>
                        {rupiah(p.price)}
                      </span>
                      <span>
                        <i className="fa-solid fa-box mr-1"></i>stok {p.stock}
                      </span>
                      <span>
                        <i className="fa-solid fa-eye mr-1"></i>
                        {s.watched} dipantau
                      </span>
                      {s.cheapest != null && <span className={LEVEL[s.level].text}>termurah {rupiah(s.cheapest)}</span>}
                      {s.banner > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          <i className="fa-solid fa-image mr-1"></i>
                          {s.banner} banner berubah
                        </span>
                      )}
                      {s.watched === 0 && rel > 0 && <span className="text-cyan-600 dark:text-cyan-400">{rel} kandidat relevan</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail produk terpilih */}
        {!current ? (
          <div className="hidden lg:flex flex-col items-center justify-center text-slate-500 py-24 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <i className="fa-solid fa-hand-pointer text-3xl mb-3"></i>
            Pilih produk di kiri untuk melihat kandidat pesaingnya
          </div>
        ) : (
          <div className="space-y-4 min-w-0">
            <button onClick={() => setSelected(null)} className="lg:hidden text-sm text-cyan-600">
              <i className="fa-solid fa-arrow-left mr-1.5"></i>Kembali ke daftar produk
            </button>

            <div className="rounded-2xl border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 p-4">
              <div className="flex gap-3">
                <Thumb src={current.thumb_url} />
                <div className="min-w-0 flex-1">
                  <a href={current.url} target="_blank" rel="noreferrer" className="font-bold text-slate-900 dark:text-white hover:text-cyan-600">
                    {current.name}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <SpecChips specs={current.specs} />
                    <span className="text-xs text-slate-500">· {rupiah(current.price)} · stok {current.stock}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dipantau */}
            <section>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                <i className="fa-solid fa-eye mr-1.5 text-cyan-600"></i>Pesaing dipantau ({watchedBy.get(current.product_id)?.size || 0})
              </h3>
              {(watchedBy.get(current.product_id)?.size || 0) === 0 ? (
                <div className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
                  Belum ada. Pilih dari kandidat di bawah dengan tombol <b>Pantau</b>.
                </div>
              ) : (
                <div className="grid gap-2">
                  {[...(watchedBy.get(current.product_id) || [])]
                    .map((id) => listingMap.get(id))
                    .filter(Boolean)
                    .sort((a, b) => (a!.price ?? 9e15) - (b!.price ?? 9e15))
                    .map((l) => {
                      const diff = current.price != null && l!.price != null ? current.price - l!.price : null;
                      return (
                        <div key={l!.product_id} className={`rounded-xl border bg-white dark:bg-slate-900 p-3 flex gap-3 ${usable(l) ? "border-slate-200 dark:border-slate-800" : "border-slate-200 dark:border-slate-800 opacity-60"}`}>
                          <Thumb src={l!.thumb_url} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <a href={l!.url || "#"} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1 hover:text-cyan-600">
                                {l!.name || `Produk ${l!.product_id}`}
                              </a>
                              <div className="text-right shrink-0">
                                <div className="font-bold text-sm">{rupiah(l!.price)}</div>
                                {diff != null && usable(l) && (
                                  <div className={`text-[11px] font-semibold ${diff > 0 ? "text-rose-600" : diff < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                                    {diff > 0 ? `kita +${rupiah(diff)}` : diff < 0 ? `kita −${rupiah(-diff)}` : "sama"}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 flex flex-wrap gap-x-2 items-center">
                              <span>
                                <i className="fa-solid fa-store mr-1"></i>
                                {l!.seller || "-"}
                              </span>
                              <span>· {(l!.sold ?? 0).toLocaleString("id-ID")} terjual</span>
                              {l!.manual && <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">manual</span>}
                              {!l!.analyzed_at && <span className="text-slate-400"><i className="fa-solid fa-hourglass-half mr-1"></i>menunggu dibaca bot</span>}
                              {!l!.active && !l!.manual && <span className="text-amber-600">· tidak tampil lagi di kategori</span>}
                              {l!.stock === 0 && <span className="text-amber-600">· stok habis</span>}
                              {(l!.sold ?? 0) === 0 && <span className="text-slate-400">· belum pernah laku</span>}
                              <SpecChips specs={l!.specs} />
                              <button
                                disabled={busy === l!.product_id}
                                onClick={() => setWatch(l!.product_id, false)}
                                className="ml-auto text-xs text-rose-600 hover:underline disabled:opacity-50"
                              >
                                <i className="fa-solid fa-xmark mr-1"></i>Lepas
                              </button>
                            </div>
                            {bannerChanged(l) && (
                              <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300 flex flex-wrap items-center gap-1.5">
                                <i className="fa-solid fa-image"></i>
                                <b>Banner berubah</b>
                                <span>{new Date(l!.banner_changed_at!).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
                                <span className="opacity-70">· sebelumnya</span>
                                {l!.prev_specs && (l!.prev_specs.income || l!.prev_specs.speed || l!.prev_specs.max) ? <SpecChips specs={l!.prev_specs} /> : <span>-</span>}
                                <span className="opacity-70">· sekarang</span>
                                {l!.specs && (l!.specs.income || l!.specs.speed || l!.specs.max) ? <SpecChips specs={l!.specs} /> : <span>-</span>}
                                {l!.prev_image_url && (
                                  <a href={l!.prev_image_url} target="_blank" rel="noreferrer" className="underline ml-1">banner lama</a>
                                )}
                                {l!.image_url && (
                                  <a href={l!.image_url} target="_blank" rel="noreferrer" className="underline">banner baru</a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </section>

            {/* Tambah manual */}
            <section className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                <i className="fa-solid fa-link mr-1.5 text-cyan-600"></i>Tambah pesaing manual
                <span className="font-normal text-slate-500"> — untuk produk yang tidak ada di daftar kandidat</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={manualLink}
                  onChange={(e) => setManualLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addManual()}
                  placeholder="Tempel link produk Itemku, mis. https://www.itemku.com/id/dagangan/nama-produk/4340221"
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                />
                <button
                  onClick={addManual}
                  disabled={manualBusy || !manualLink.trim()}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold disabled:opacity-50 shrink-0"
                >
                  {manualBusy ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-plus mr-1"></i>Pantau</>}
                </button>
              </div>
            </section>

            {/* Kandidat */}
            <section>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mr-1">
                  <i className="fa-solid fa-magnifying-glass-chart mr-1.5 text-cyan-600"></i>Kandidat pesaing
                </h3>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
                  {(["relevant", "all"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`px-2.5 py-1 font-semibold ${mode === m ? "bg-cyan-600 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"}`}
                    >
                      {m === "relevant" ? `Relevan (${freeCands(current.product_id).length})` : "Semua"}
                    </button>
                  ))}
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1"
                >
                  <option value="match">Paling mirip</option>
                  <option value="price">Termurah</option>
                  <option value="sold">Terlaris</option>
                </select>
                <div className="relative ml-auto w-full sm:w-56">
                  <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cari judul / penjual"
                    className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                {mode === "relevant" && <>Relevan = income/speed/MAX hasil baca bot (judul, deskripsi, banner) sebanding dengan produk ini. Yang tidak terbaca ada di &quot;Semua&quot;. </>}
                {hiddenTaken > 0 && <>{hiddenTaken} pesaing disembunyikan karena sudah dipantau di produk lain.</>}
              </p>
              {candList.length === 0 ? (
                <div className="text-sm text-slate-500 py-6 text-center">
                  {mode === "relevant" ? "Tidak ada kandidat relevan — coba lihat \"Semua\"." : "Tidak ada produk yang cocok."}
                </div>
              ) : (
                <div className="grid gap-2">
                  {candList.slice(0, 150).map(({ l, match }) => (
                    <div key={l.product_id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex gap-3">
                      <Thumb src={l.thumb_url} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <a href={l.url || "#"} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 hover:text-cyan-600">
                            {l.name}
                          </a>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-sm">{rupiah(l.price)}</div>
                            <div className="text-[11px] text-slate-500">{(l.sold ?? 0).toLocaleString("id-ID")} terjual</div>
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>
                            <i className="fa-solid fa-store mr-1"></i>
                            {l.seller || "-"}
                          </span>
                          {isNew(l) && <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">Baru</span>}
                          {l.stock === 0 && <span className="text-amber-600">stok habis</span>}
                          {(l.sold ?? 0) === 0 && <span className="text-slate-400">belum pernah laku</span>}
                          <SpecChips specs={l.specs} />
                          {!l.analyzed_at ? (
                            <span className="text-slate-400"><i className="fa-solid fa-hourglass-half mr-1"></i>belum dibaca bot</span>
                          ) : !l.specs?.income && !l.specs?.speed && !l.specs?.max ? (
                            <span className="text-amber-600">spesifikasi tidak terbaca</span>
                          ) : null}
                          {match && (
                            <span className="text-emerald-600 dark:text-emerald-400" title={match[2].join(" · ")}>
                              <i className="fa-solid fa-check mr-1"></i>cocok
                            </span>
                          )}
                          <button
                            disabled={busy === l.product_id}
                            onClick={() => setWatch(l.product_id, true)}
                            className="ml-auto px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold disabled:opacity-50"
                          >
                            <i className="fa-solid fa-plus mr-1"></i>Pantau
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {candList.length > 150 && <div className="text-xs text-slate-500 text-center">Menampilkan 150 dari {candList.length} — persempit dengan pencarian.</div>}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm shadow-lg">{toast}</div>
      )}
    </div>
  );
}
