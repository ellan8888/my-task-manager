"use client";

// Kirim Akun Manual — khusus Ellan (SQL 011)
// Masukkan Order ID + akun (dari stok Itemku atau akun baru) → bot mengirim chat ke pembeli,
// mencatat pendapatan, dan web menandai akun sebagai laku.

import { useCallback, useEffect, useRef, useState } from "react";
import AdminHeader from "@/app/components/AdminHeader";
import RoleBadge from "@/app/components/RoleBadge";
import { FieldLabel, SegmentedChoice, SelectMenu, type MenuOption } from "@/app/components/Pickers";
import { useToast } from "@/app/components/ToastProvider";
import { useConfirmAsync } from "@/app/components/ConfirmDialog";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";

// ══════════════════════════════════════════════════════════════
// TYPES & HELPERS
// ══════════════════════════════════════════════════════════════

type Source = "stock" | "new";

type StockAccount = {
  username: string;
  kategori: string | null;
  added_by: string | null;
  listed_at: string | null;
  has_password: boolean;
};

type Delivery = {
  id: number;
  order_id: string;
  source: Source;
  accounts: { username: string; kategori: string | null; owner: string }[];
  status: "pending" | "processing" | "done" | "failed" | "finalize_failed" | "cancelled";
  step: string | null;
  error: string | null;
  result: string | null;
  attempts: number;
  requested_by: string | null;
  created_at: string;
  done_at: string | null;
};

type NewRow = { key: number; username: string; password: string; show: boolean };

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "-";
const normalizeOrder = (raw: string) => {
  const v = raw.replace(/\s*\([A-Z]{2}\)\s*$/i, "").replace(/[#\s]/g, "").toUpperCase();
  return /^\d+$/.test(v) ? `OD${v.padStart(15, "0")}` : v;
};
const isRobloxUsername = (v: string) => /^[A-Za-z0-9_]{3,20}$/.test(v);

const STATUS_INFO: Record<Delivery["status"], { label: string; icon: string; cls: string }> = {
  pending: { label: "Menunggu bot", icon: "fa-hourglass-half", cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30" },
  processing: { label: "Diproses bot", icon: "fa-spinner fa-spin", cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30" },
  done: { label: "Selesai", icon: "fa-circle-check", cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" },
  failed: { label: "Gagal", icon: "fa-circle-xmark", cls: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30" },
  finalize_failed: { label: "Perlu diselesaikan", icon: "fa-triangle-exclamation", cls: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30" },
  cancelled: { label: "Dibatalkan", icon: "fa-ban", cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
};

const STEP_LABEL: Record<string, string> = {
  baca_order: "membaca rincian order",
  hapus_itemku: "menghapus akun dari Itemku",
  kirim_chat: "mengirim chat ke pembeli",
  catat_pendapatan: "mencatat pendapatan",
  finalisasi: "menandai akun laku",
};

const inputCls =
  "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";

let rowKey = 1;
const emptyRow = (): NewRow => ({ key: rowKey++, username: "", password: "", show: false });

// ══════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════

export default function KirimAkunPage() {
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirmAsync();
  const { user, loading: userLoading } = useCurrentUser();
  const isEllan = user?.username?.toLowerCase() === "ellan";

  // Order
  const [orderInput, setOrderInput] = useState("");
  const [orderCheck, setOrderCheck] = useState<{ valid: boolean; order_id: string; income_usernames?: string[]; in_progress?: boolean } | null>(null);
  const [checkingOrder, setCheckingOrder] = useState(false);

  // Sumber
  const [source, setSource] = useState<Source>("stock");

  // Stok Itemku
  const [stockQuery, setStockQuery] = useState("");
  const [stock, setStock] = useState<StockAccount[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [picked, setPicked] = useState<StockAccount[]>([]);

  // Akun baru
  const [rows, setRows] = useState<NewRow[]>(() => [emptyRow()]);
  const [owner, setOwner] = useState<string | null>(null);
  const [kategori, setKategori] = useState<string | null>(null);
  const [users, setUsers] = useState<{ username: string; display_name: string | null; role: string }[]>([]);
  const [kategoriList, setKategoriList] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);

  // Riwayat
  const [history, setHistory] = useState<Delivery[]>([]);
  const [ready, setReady] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const orderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data awal ──────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/kirim-akun?mode=history");
      const data = await res.json();
      if (data.success) {
        setHistory(data.data || []);
        setReady(data.ready !== false);
      }
    } catch {
      /* dicoba lagi saat refresh */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadStock = useCallback(async (q: string) => {
    setStockLoading(true);
    try {
      const res = await fetch(`/api/admin/kirim-akun?mode=stock&q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (data.success) setStock(data.data || []);
      else toast.error(data.message || "Gagal memuat stok");
    } catch {
      toast.error("Gagal memuat stok");
    } finally {
      setStockLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isEllan) return;
    const t = setTimeout(() => {
      loadHistory();
      loadStock("");
      fetch("/api/admin/kirim-akun?mode=users")
        .then((r) => r.json())
        .then((d) => d.success && setUsers(d.data || []))
        .catch(() => {});
      fetch("/api/kategori/links")
        .then((r) => r.json())
        .then((d) => {
          if (!d.success) return;
          const names: string[] = (d.list || d.data || [])
            .map((k: { kategori?: string }) => (k.kategori || "").trim())
            .filter(Boolean);
          setKategoriList([...new Set(names)]);
        })
        .catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, [isEllan, loadHistory, loadStock]);

  const hasActive = history.some((h) => h.status === "pending" || h.status === "processing");
  useEffect(() => {
    if (!isEllan || !hasActive) return;
    const t = setInterval(loadHistory, 5000);
    return () => clearInterval(t);
  }, [isEllan, hasActive, loadHistory]);

  // ── Cek order ──────────────────────────────────────────────
  const onOrderChange = (v: string) => {
    setOrderInput(v);
    setOrderCheck(null);
    if (orderTimer.current) clearTimeout(orderTimer.current);
    const id = normalizeOrder(v);
    if (!/^OD\d{6,}$/.test(id)) return;
    orderTimer.current = setTimeout(async () => {
      setCheckingOrder(true);
      try {
        const res = await fetch(`/api/admin/kirim-akun?mode=check&order_id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (data.success) setOrderCheck(data);
      } catch {
        /* diam */
      } finally {
        setCheckingOrder(false);
      }
    }, 400);
  };

  const onStockQuery = (v: string) => {
    setStockQuery(v);
    if (stockTimer.current) clearTimeout(stockTimer.current);
    stockTimer.current = setTimeout(() => loadStock(v), 350);
  };

  const togglePick = (a: StockAccount) => {
    if (!a.has_password) {
      toast.warning("Akun ini belum punya password");
      return;
    }
    setPicked((prev) =>
      prev.some((p) => p.username === a.username) ? prev.filter((p) => p.username !== a.username) : prev.length >= 10 ? prev : [...prev, a]
    );
  };

  const updateRow = (key: number, patch: Partial<NewRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // ── Validasi & kirim ───────────────────────────────────────
  const orderId = normalizeOrder(orderInput);
  const orderOk = /^OD\d{6,}$/.test(orderId);
  const orderBlocked = !!orderCheck && ((orderCheck.income_usernames?.length || 0) > 0 || !!orderCheck.in_progress);
  const filledRows = rows.filter((r) => r.username.trim() || r.password);
  const newRowsOk =
    filledRows.length > 0 &&
    filledRows.every((r) => isRobloxUsername(r.username.trim()) && r.password.trim()) &&
    new Set(filledRows.map((r) => r.username.trim().toLowerCase())).size === filledRows.length;
  const canSubmit =
    orderOk && !orderBlocked && !submitting && (source === "stock" ? picked.length > 0 : newRowsOk && !!owner);

  const submit = async () => {
    if (!canSubmit) return;
    const names = source === "stock" ? picked.map((p) => p.username) : filledRows.map((r) => r.username.trim());
    const ownerText =
      source === "stock"
        ? [...new Set(picked.map((p) => cap(p.added_by || "ellan")))].join(", ")
        : cap(owner || "");
    const ok = await confirm({
      title: "Kirim akun ke order ini?",
      message:
        `Order ${orderId}\nAkun: ${names.join(", ")}\n\n` +
        (source === "stock" ? "Bot akan menghapus akun ini dari link kategori Itemku, lalu " : "Bot akan ") +
        `mengirim username & password ke pembeli lewat chat, mencatat pendapatan untuk ${ownerText}, ` +
        "lalu akun ditandai laku.",
      variant: "warning",
      confirmText: "Ya, kirim",
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/kirim-akun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          source === "stock"
            ? { order_id: orderId, source, stock_usernames: names }
            : {
                order_id: orderId,
                source,
                owner,
                kategori,
                new_accounts: filledRows.map((r) => ({ username: r.username.trim(), password: r.password })),
              }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Gagal membuat permintaan");
        return;
      }
      toast.success(data.message || "Permintaan dikirim");
      setOrderInput("");
      setOrderCheck(null);
      setPicked([]);
      setRows([emptyRow()]);
      loadHistory();
      loadStock(stockQuery);
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  const historyAction = async (d: Delivery, action: "retry" | "cancel" | "finalize") => {
    if (action === "cancel") {
      const ok = await confirm({
        title: "Batalkan pengiriman?",
        message: `Order ${d.order_id} tidak akan diproses bot.`,
        variant: "danger",
        confirmText: "Batalkan",
      });
      if (!ok) return;
    }
    setBusyId(d.id);
    try {
      const res = await fetch("/api/admin/kirim-akun", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, action }),
      });
      const data = await res.json();
      if (data.success) toast.success(data.message || "Berhasil");
      else toast.error(data.message || "Gagal");
      loadHistory();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setBusyId(null);
    }
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  const header = (
    <AdminHeader
      icon="fa-paper-plane"
      iconClassName="from-sky-600 via-blue-600 to-indigo-500 shadow-blue-600/30"
      title="Kirim Akun Manual"
      subtitle="Kirim akun ke order Itemku — chat, pendapatan & status akun diurus bot"
    />
  );

  if (userLoading) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center">
          <i className="fa-solid fa-spinner fa-spin text-blue-500 text-2xl"></i>
        </div>
      </>
    );
  }

  if (!isEllan) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-500/20">
              <i className="fa-solid fa-lock text-2xl"></i>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1">Akses ditolak</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Halaman ini khusus Ellan.</p>
          </div>
        </div>
      </>
    );
  }

  const ownerOptions: MenuOption<string>[] = users.map((u) => ({ value: u.username, label: cap(u.display_name || u.username) }));
  const kategoriOptions: MenuOption<string>[] = kategoriList.map((k) => ({ value: k, label: k, icon: "fa-tag" }));

  return (
    <>
      {header}
      {confirmDialog}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {!ready && (
            <div className="rounded-2xl border border-dashed border-amber-300 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 px-4 py-3 flex items-center gap-3">
              <i className="fa-solid fa-database text-amber-600 dark:text-amber-400"></i>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Fitur ini belum aktif. Jalankan <code className="font-mono text-amber-700 dark:text-amber-300">sql/011_manual_deliveries.sql</code> di Supabase.
              </p>
            </div>
          )}

          {/* ═══ 1. ORDER ═══ */}
          <section className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6">
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">1</span>
              Order tujuan
            </h2>
            <div className="relative">
              <i className="fa-solid fa-hashtag absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                value={orderInput}
                onChange={(e) => onOrderChange(e.target.value)}
                placeholder="Order ID, contoh OD000000167663006 atau 167663006"
                className={`${inputCls} pl-10 font-mono`}
              />
              {checkingOrder && <i className="fa-solid fa-spinner fa-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-500 text-sm"></i>}
            </div>
            <div className="mt-2 text-xs">
              {orderInput && !orderOk && (
                <p className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-xmark"></i> Format Order ID belum benar
                </p>
              )}
              {orderOk && orderCheck?.in_progress && (
                <p className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-hourglass-half"></i> Order ini sedang diproses kirim manual — cek riwayat di bawah
                </p>
              )}
              {orderOk && !!orderCheck?.income_usernames?.length && (
                <p className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  Order ini sudah punya pendapatan ({orderCheck.income_usernames.join(", ")}). Kalau akunnya bermasalah, pakai Ganti Akun.
                </p>
              )}
              {orderOk && orderCheck && !orderBlocked && (
                <p className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check"></i> <span className="font-mono">{orderCheck.order_id}</span> siap dikirimi akun
                </p>
              )}
            </div>
          </section>

          {/* ═══ 2. AKUN ═══ */}
          <section className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">2</span>
                Akun yang dikirim
              </h2>
              <SegmentedChoice
                ariaLabel="Sumber akun"
                size="sm"
                value={source}
                onChange={setSource}
                options={[
                  { value: "stock", label: "Dari stok Itemku", icon: "fa-store", activeClass: "bg-blue-600 text-white border-blue-600 shadow-blue-600/30" },
                  { value: "new", label: "Akun baru", icon: "fa-user-plus", activeClass: "bg-violet-600 text-white border-violet-600 shadow-violet-600/30" },
                ]}
              />
            </div>

            {source === "stock" ? (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Akun yang sedang dijual di Itemku. Bot menghapusnya dari link kategori dulu supaya tidak terjual dua kali.
                  Pendapatan masuk ke pemilik akun masing-masing.
                </p>
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                  <input
                    value={stockQuery}
                    onChange={(e) => onStockQuery(e.target.value)}
                    placeholder="Cari username atau kategori"
                    className={`${inputCls} pl-10`}
                  />
                  {stockLoading && <i className="fa-solid fa-spinner fa-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-500 text-sm"></i>}
                </div>

                {picked.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {picked.map((p) => (
                      <button
                        key={p.username}
                        type="button"
                        onClick={() => togglePick(p)}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold"
                        title="Klik untuk batal pilih"
                      >
                        <span className="font-mono">{p.username}</span>
                        <i className="fa-solid fa-xmark text-[10px] opacity-80"></i>
                      </button>
                    ))}
                  </div>
                )}

                {stock.length === 0 && !stockLoading ? (
                  <div className="py-8 text-center">
                    <i className="fa-solid fa-box-open text-2xl text-slate-300 dark:text-slate-600 mb-2"></i>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada stok Itemku yang cocok.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                    {stock.map((a) => {
                      const active = picked.some((p) => p.username === a.username);
                      return (
                        <button
                          key={a.username}
                          type="button"
                          onClick={() => togglePick(a)}
                          className={`text-left rounded-xl border px-4 py-3 transition flex items-center gap-3 ${
                            active
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-2 ring-blue-500/30"
                              : a.has_password
                                ? "border-slate-200 dark:border-slate-800 hover:border-blue-400"
                                : "border-slate-200 dark:border-slate-800 opacity-50"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                              active ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 dark:border-slate-600"
                            }`}
                          >
                            {active && <i className="fa-solid fa-check text-[10px]"></i>}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="font-mono font-bold text-sm text-slate-900 dark:text-white block truncate">{a.username}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                              <i className="fa-solid fa-tag text-[9px]"></i>
                              {a.kategori || "-"}
                              <span>·</span>
                              {cap(a.added_by || "-")}
                              <span>·</span>
                              sejak {fmtDate(a.listed_at)}
                            </span>
                          </span>
                          {!a.has_password && <span className="text-[10px] font-bold text-rose-500 shrink-0">tanpa password</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Akun yang belum pernah diinput ke My Task Manager. Setelah terkirim, akun disimpan sebagai akun laku milik pemilik yang dipilih.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Pemilik akun (dapat pendapatan)</FieldLabel>
                    <SelectMenu
                      options={ownerOptions}
                      value={owner}
                      onChange={setOwner}
                      placeholder="Pilih owner / staff"
                      searchable
                      ariaLabel="Pemilik akun"
                    />
                    {owner && (
                      <div className="mt-1.5">
                        <RoleBadge username={owner} />
                      </div>
                    )}
                  </div>
                  <div>
                    <FieldLabel>Kategori (opsional)</FieldLabel>
                    <SelectMenu
                      options={kategoriOptions}
                      value={kategori}
                      onChange={setKategori}
                      placeholder="Pilih kategori"
                      searchable
                      ariaLabel="Kategori akun"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Akun</FieldLabel>
                  {rows.map((r, i) => {
                    const userBad = !!r.username.trim() && !isRobloxUsername(r.username.trim());
                    return (
                      <div key={r.key} className="flex items-start gap-2">
                        <span className="w-6 h-10 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">{i + 1}</span>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <input
                              value={r.username}
                              onChange={(e) => updateRow(r.key, { username: e.target.value })}
                              placeholder="Username Roblox"
                              autoComplete="off"
                              className={`${inputCls} font-mono ${userBad ? "border-rose-400 dark:border-rose-500/60" : ""}`}
                            />
                            {userBad && <p className="text-[11px] text-rose-500 mt-1">3–20 huruf, angka, atau _</p>}
                          </div>
                          <div className="relative">
                            <input
                              value={r.password}
                              onChange={(e) => updateRow(r.key, { password: e.target.value })}
                              placeholder="Password"
                              type={r.show ? "text" : "password"}
                              autoComplete="new-password"
                              className={`${inputCls} pr-10 font-mono`}
                            />
                            <button
                              type="button"
                              onClick={() => updateRow(r.key, { show: !r.show })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              aria-label={r.show ? "Sembunyikan password" : "Tampilkan password"}
                            >
                              <i className={`fa-solid ${r.show ? "fa-eye-slash" : "fa-eye"} text-xs`}></i>
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== r.key) : [emptyRow()]))}
                          className="w-10 h-10 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0"
                          aria-label="Hapus baris"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    );
                  })}
                  {rows.length < 10 && (
                    <button
                      type="button"
                      onClick={() => setRows((prev) => [...prev, emptyRow()])}
                      className="ml-8 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-plus text-[10px]"></i> Tambah akun
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          {/* ═══ 3. KIRIM ═══ */}
          <section className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6">
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">3</span>
              Yang dikerjakan bot
            </h2>
            <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5 mb-5">
              <li className="flex gap-2"><i className="fa-solid fa-file-lines text-slate-400 mt-1 w-4"></i>Membaca rincian order (produk, total pendapatan, pembeli)</li>
              {source === "stock" && (
                <li className="flex gap-2"><i className="fa-solid fa-store-slash text-slate-400 mt-1 w-4"></i>Menghapus akun dari link kategori Itemku</li>
              )}
              <li className="flex gap-2"><i className="fa-solid fa-comment-dots text-slate-400 mt-1 w-4"></i>Mengirim username & password ke pembeli lewat chat (template order akun + panduan Discord)</li>
              <li className="flex gap-2"><i className="fa-solid fa-sack-dollar text-slate-400 mt-1 w-4"></i>Mencatat pendapatan untuk pemilik akun (dibagi rata per akun)</li>
              <li className="flex gap-2"><i className="fa-solid fa-circle-check text-slate-400 mt-1 w-4"></i>Menandai akun sebagai laku</li>
            </ol>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/25 disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2 transition"
            >
              {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
              Kirim akun ke order
            </button>
          </section>

          {/* ═══ RIWAYAT ═══ */}
          <section className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-slate-400"></i> Riwayat
              </h2>
              {hasActive && (
                <span className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-rotate fa-spin text-[10px]"></i> diperbarui otomatis
                </span>
              )}
            </div>
            {historyLoading ? (
              <div className="py-10 text-center text-sm text-slate-500">
                <i className="fa-solid fa-spinner fa-spin mr-2 text-blue-500"></i>Memuat...
              </div>
            ) : history.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Belum ada pengiriman manual.</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((h) => {
                  const s = STATUS_INFO[h.status] || STATUS_INFO.pending;
                  return (
                    <div key={h.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-bold ${s.cls}`}>
                          <i className={`fa-solid ${s.icon} text-[10px]`}></i>
                          {s.label}
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{h.order_id}</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                          {h.source === "stock" ? "Stok Itemku" : "Akun baru"}
                        </span>
                        <span className="text-xs text-slate-400 ml-auto">{fmtDate(h.created_at)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {h.accounts.map((a) => (
                          <span
                            key={a.username}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]"
                          >
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{a.username}</span>
                            <span className="text-slate-500">· {cap(a.owner)}</span>
                          </span>
                        ))}
                      </div>
                      {h.result && <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400">{h.result}</p>}
                      {h.error && (
                        <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-2.5 py-1.5 wrap-break-word">
                          {h.step ? `Gagal saat ${STEP_LABEL[h.step] || h.step}: ` : ""}
                          {h.error}
                        </p>
                      )}
                      {h.status === "processing" && h.step && (
                        <p className="mt-2 text-[11px] text-blue-600 dark:text-blue-400">Sedang {STEP_LABEL[h.step] || h.step}…</p>
                      )}
                      {["failed", "pending", "finalize_failed"].includes(h.status) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {h.status === "failed" && (
                            <button
                              type="button"
                              disabled={busyId === h.id}
                              onClick={() => historyAction(h, "retry")}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <i className="fa-solid fa-rotate-right text-[10px]"></i> Ulangi
                            </button>
                          )}
                          {h.status === "finalize_failed" && (
                            <button
                              type="button"
                              disabled={busyId === h.id}
                              onClick={() => historyAction(h, "finalize")}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <i className="fa-solid fa-flag-checkered text-[10px]"></i> Selesaikan
                            </button>
                          )}
                          {["failed", "pending"].includes(h.status) && (
                            <button
                              type="button"
                              disabled={busyId === h.id}
                              onClick={() => historyAction(h, "cancel")}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-rose-400 hover:text-rose-600 disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <i className="fa-solid fa-ban text-[10px]"></i> Batalkan
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
