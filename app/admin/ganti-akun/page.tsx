"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminHeader from "@/app/components/AdminHeader";
import { useToast } from "@/app/components/ToastProvider";
import { useConfirmAsync } from "@/app/components/ConfirmDialog";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

type SoldAccount = {
  username: string;
  kategori: string | null;
  added_by: string | null;
  sold_at: string | null;
  order_id: string | null;
  income: number | null;
  buyer_name: string | null;
  product_title: string | null;
  has_active_replacement: boolean;
};

type Candidate = {
  username: string;
  added_by: string | null;
  listed_at: string | null;
  has_password: boolean;
};

type Replacement = {
  id: number;
  order_id: string;
  kategori: string | null;
  old_username: string;
  old_added_by: string | null;
  new_username: string;
  new_added_by: string | null;
  status: "pending" | "processing" | "done" | "failed" | "finalize_failed" | "cancelled";
  step: string | null;
  error: string | null;
  note: string | null;
  attempts: number;
  created_at: string;
  done_at: string | null;
};

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const fmtRupiah = (n: number | null) => (n == null ? "-" : `Rp ${new Intl.NumberFormat("id-ID").format(n)}`);

const STATUS_INFO: Record<Replacement["status"], { label: string; icon: string; className: string }> = {
  pending: {
    label: "Menunggu bot",
    icon: "fa-hourglass-half",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  },
  processing: {
    label: "Diproses bot",
    icon: "fa-spinner fa-spin",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  },
  done: {
    label: "Selesai",
    icon: "fa-circle-check",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  },
  failed: {
    label: "Gagal",
    icon: "fa-circle-xmark",
    className: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  },
  finalize_failed: {
    label: "Terkirim, data belum beres",
    icon: "fa-triangle-exclamation",
    className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  },
  cancelled: {
    label: "Dibatalkan",
    icon: "fa-ban",
    className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
};

const STEP_LABEL: Record<string, string> = {
  hapus_itemku: "hapus dari Itemku",
  kirim_chat: "kirim chat ke pembeli",
  finalisasi: "update data di web",
};

// ══════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════

export default function GantiAkunPage() {
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirmAsync();
  const { user, loading: userLoading } = useCurrentUser();
  const isEllan = user?.username?.toLowerCase() === "ellan";

  // Langkah 1 — akun bermasalah
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SoldAccount[]>([]);
  const [selected, setSelected] = useState<SoldAccount | null>(null);

  // Langkah 2 — pengganti
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [replacement, setReplacement] = useState<Candidate | null>(null);

  // Langkah 3 — kirim
  const [submitting, setSubmitting] = useState(false);

  // Riwayat
  const [history, setHistory] = useState<Replacement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Riwayat ────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ganti-akun");
      const data = await res.json();
      if (data.success) setHistory(data.data || []);
    } catch {
      /* diam — dicoba lagi di refresh berikutnya */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isEllan) return;
    const first = setTimeout(loadHistory, 0);
    return () => clearTimeout(first);
  }, [isEllan, loadHistory]);

  // Auto-refresh selama ada yang masih diproses bot
  const hasActive = history.some((h) => h.status === "pending" || h.status === "processing");
  useEffect(() => {
    if (!isEllan || !hasActive) return;
    const t = setInterval(loadHistory, 5000);
    return () => clearInterval(t);
  }, [isEllan, hasActive, loadHistory]);

  // ── Langkah 1: cari ────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/ganti-akun/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (data.success) setResults(data.data || []);
      else toast.error(data.message || "Gagal mencari akun");
    } catch {
      toast.error("Gagal mencari akun");
    } finally {
      setSearching(false);
    }
  }, [toast]);

  const onQueryChange = (v: string) => {
    setQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(v), 350);
  };

  // Prefill dari link: /admin/ganti-akun?u=username
  useEffect(() => {
    if (!isEllan) return;
    const u = new URLSearchParams(window.location.search).get("u");
    if (!u) return;
    const t = setTimeout(() => {
      setQuery(u);
      runSearch(u);
    }, 0);
    return () => clearTimeout(t);
  }, [isEllan, runSearch]);

  // ── Langkah 2: kandidat ────────────────────────────────────
  const pickBroken = async (acc: SoldAccount) => {
    if (acc.has_active_replacement) {
      toast.warning("Akun ini sedang dalam proses ganti — cek di Riwayat");
      return;
    }
    if (!acc.order_id) {
      toast.warning("Nomor order akun ini tidak ditemukan, jadi bot tidak bisa menghubungi pembeli");
      return;
    }
    setSelected(acc);
    setReplacement(null);
    setCandidates([]);
    if (!acc.kategori) return;

    setLoadingCandidates(true);
    try {
      const res = await fetch(`/api/admin/ganti-akun/candidates?kategori=${encodeURIComponent(acc.kategori)}`);
      const data = await res.json();
      if (data.success) setCandidates(data.data || []);
      else toast.error(data.message || "Gagal memuat calon pengganti");
    } catch {
      toast.error("Gagal memuat calon pengganti");
    } finally {
      setLoadingCandidates(false);
    }
  };

  const resetFlow = () => {
    setSelected(null);
    setReplacement(null);
    setCandidates([]);
  };

  // ── Langkah 3: kirim ───────────────────────────────────────
  const submit = async () => {
    if (!selected || !replacement || !selected.order_id) return;

    const ok = await confirm({
      title: "Ganti akun sekarang?",
      message:
        `${selected.username} akan diganti dengan ${replacement.username}.\n\n` +
        `Bot akan: menghapus ${replacement.username} dari link kategori Itemku, lalu mengirim username & password-nya ke pembeli order ${selected.order_id}.\n\n` +
        `Setelah berhasil: pendapatan pindah ke ${replacement.added_by || "-"}, dan ${selected.username} DIHAPUS PERMANEN.`,
      variant: "warning",
      confirmText: "Ya, ganti",
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/ganti-akun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_username: selected.username,
          new_username: replacement.username,
          order_id: selected.order_id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Gagal membuat permintaan");
        return;
      }
      toast.success("Permintaan dikirim — bot akan memprosesnya dalam beberapa saat");
      resetFlow();
      setQuery("");
      setResults([]);
      loadHistory();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Aksi riwayat ───────────────────────────────────────────
  const historyAction = async (rep: Replacement, action: "retry" | "cancel" | "finalize") => {
    if (action === "cancel") {
      const ok = await confirm({
        title: "Batalkan penggantian?",
        message: `${rep.old_username} → ${rep.new_username} tidak akan diproses bot.`,
        variant: "danger",
        confirmText: "Batalkan",
      });
      if (!ok) return;
    }
    setBusyId(rep.id);
    try {
      const res = await fetch("/api/admin/ganti-akun", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rep.id, action }),
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
      icon="fa-right-left"
      iconClassName="from-fuchsia-600 via-violet-600 to-indigo-500 shadow-violet-600/30"
      title="Ganti Akun"
      subtitle="Ganti akun bermasalah dengan stok Itemku — dikerjakan otomatis oleh bot"
    />
  );

  if (userLoading) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center">
          <i className="fa-solid fa-spinner fa-spin text-violet-500 text-2xl"></i>
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

  const step = !selected ? 1 : !replacement ? 2 : 3;

  return (
    <>
      {header}
      {confirmDialog}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* ═══ INDIKATOR LANGKAH ═══ */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { n: 1, label: "Akun bermasalah", short: "Akun", icon: "fa-user-xmark" },
              { n: 2, label: "Pilih pengganti", short: "Pengganti", icon: "fa-user-check" },
              { n: 3, label: "Konfirmasi", short: "Kirim", icon: "fa-paper-plane" },
            ].map((s) => (
              <div
                key={s.n}
                className={`rounded-xl px-3 py-2.5 border flex items-center gap-2 text-xs font-bold transition ${
                  step === s.n
                    ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-600/30"
                    : step > s.n
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                      : "bg-white dark:bg-slate-900/60 text-slate-400 border-slate-200 dark:border-slate-800"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    step === s.n ? "bg-white/20" : step > s.n ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  <i className={`fa-solid ${step > s.n ? "fa-check" : s.icon} text-[10px]`}></i>
                </span>
                <span className="truncate hidden sm:inline">{s.label}</span>
                <span className="truncate sm:hidden">{s.short}</span>
              </div>
            ))}
          </div>

          {/* ═══ LANGKAH 1 ═══ */}
          <section className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs">1</span>
                Akun yang bermasalah
              </h2>
              {selected && (
                <button
                  type="button"
                  onClick={resetFlow}
                  className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Ganti pilihan
                </button>
              )}
            </div>

            {selected ? (
              <BrokenCard acc={selected} />
            ) : (
              <>
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Cari username akun laku atau nomor order (OD...)"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-10 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                    autoFocus
                  />
                  {searching && (
                    <i className="fa-solid fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-violet-500 text-sm"></i>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {query.trim().length >= 3 && !searching && results.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                      Tidak ada akun laku yang cocok.
                    </p>
                  )}
                  {results.map((acc) => (
                    <button
                      key={acc.username}
                      type="button"
                      onClick={() => pickBroken(acc)}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition flex flex-wrap items-center gap-x-4 gap-y-1.5 ${
                        acc.has_active_replacement
                          ? "border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed"
                          : "border-slate-200 dark:border-slate-800 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-500/5"
                      }`}
                    >
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{acc.username}</span>
                      <Chip icon="fa-tag">{acc.kategori || "-"}</Chip>
                      <Chip icon="fa-user">{acc.added_by || "-"}</Chip>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{acc.order_id || "order ?"}</span>
                      <span className="text-xs text-slate-400 ml-auto">Laku {fmtDate(acc.sold_at)}</span>
                      {acc.has_active_replacement && (
                        <span className="w-full text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          Sedang dalam proses ganti
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* ═══ LANGKAH 2 ═══ */}
          <section
            className={`bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 transition ${
              selected ? "" : "opacity-50 pointer-events-none"
            }`}
          >
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">2</span>
              Pilih akun pengganti
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Dari stok yang sedang dijual di Itemku, kategori{" "}
              <span className="font-bold text-slate-700 dark:text-slate-200">{selected?.kategori || "-"}</span>. Stok Pribadi tidak ikut.
            </p>

            {loadingCandidates ? (
              <div className="py-8 text-center text-sm text-slate-500">
                <i className="fa-solid fa-spinner fa-spin mr-2 text-violet-500"></i>
                Memuat stok Itemku...
              </div>
            ) : selected && candidates.length === 0 ? (
              <div className="py-8 text-center">
                <i className="fa-solid fa-box-open text-2xl text-slate-300 dark:text-slate-600 mb-2"></i>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Tidak ada stok Itemku untuk kategori ini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {candidates.map((c, i) => {
                  const active = replacement?.username === c.username;
                  return (
                    <button
                      key={c.username}
                      type="button"
                      onClick={() => (c.has_password ? setReplacement(c) : toast.warning("Akun ini belum punya password"))}
                      className={`text-left rounded-xl border px-4 py-3 transition flex items-center gap-3 ${
                        active
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 ring-2 ring-violet-500/30"
                          : c.has_password
                            ? "border-slate-200 dark:border-slate-800 hover:border-violet-400"
                            : "border-slate-200 dark:border-slate-800 opacity-50"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          active ? "border-violet-500 bg-violet-500" : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {active && <span className="w-2 h-2 rounded-full bg-white"></span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-white block truncate">
                          {c.username}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {c.added_by || "-"} · di Itemku sejak {fmtDate(c.listed_at)}
                        </span>
                      </span>
                      {i === 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0">
                          Terlama
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ═══ LANGKAH 3 ═══ */}
          <section
            className={`bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 md:p-6 transition ${
              selected && replacement ? "" : "opacity-50 pointer-events-none"
            }`}
          >
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs">3</span>
              Konfirmasi
            </h2>

            <div className="flex flex-col md:flex-row items-stretch gap-3">
              <SwapSide tone="rose" title="Akun lama (dihapus permanen)" username={selected?.username} owner={selected?.added_by} />
              <div className="flex items-center justify-center text-violet-500">
                <i className="fa-solid fa-arrow-right hidden md:block"></i>
                <i className="fa-solid fa-arrow-down md:hidden"></i>
              </div>
              <SwapSide tone="emerald" title="Akun pengganti (dikirim ke pembeli)" username={replacement?.username} owner={replacement?.added_by} />
            </div>

            <ul className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex gap-2"><i className="fa-solid fa-robot text-violet-500 mt-0.5"></i>Bot menghapus akun pengganti dari link kategori Itemku.</li>
              <li className="flex gap-2"><i className="fa-regular fa-comment-dots text-violet-500 mt-0.5"></i>Bot mengirim username &amp; password pengganti ke pembeli order <span className="font-mono font-bold">{selected?.order_id || "-"}</span>.</li>
              <li className="flex gap-2"><i className="fa-solid fa-coins text-violet-500 mt-0.5"></i>Pendapatan & fee pindah ke <span className="font-bold">{replacement?.added_by || "-"}</span>.</li>
            </ul>

            <button
              type="button"
              onClick={submit}
              disabled={!selected || !replacement || submitting}
              className="mt-5 w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20"
            >
              <i className={`fa-solid ${submitting ? "fa-spinner fa-spin" : "fa-right-left"}`}></i>
              {submitting ? "Mengirim..." : "Ganti sekarang"}
            </button>
          </section>

          {/* ═══ RIWAYAT ═══ */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-slate-400"></i>
                Riwayat ganti akun
              </h2>
              {hasActive && (
                <span className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                  Update otomatis
                </span>
              )}
            </div>

            {historyLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">
                <i className="fa-solid fa-spinner fa-spin mr-2"></i>Memuat...
              </div>
            ) : history.length === 0 ? (
              <div className="bg-white dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Belum ada penggantian akun.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => {
                  const s = STATUS_INFO[h.status] || STATUS_INFO.pending;
                  return (
                    <div
                      key={h.id}
                      className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${s.className}`}>
                          <i className={`fa-solid ${s.icon} text-[10px]`}></i>
                          {s.label}
                        </span>
                        <span className="font-mono text-sm">
                          <span className="text-rose-600 dark:text-rose-400 line-through decoration-rose-400/60">{h.old_username}</span>
                          <i className="fa-solid fa-arrow-right text-[10px] text-slate-400 mx-2"></i>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{h.new_username}</span>
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{h.order_id}</span>
                        <span className="text-xs text-slate-400 ml-auto">{fmtDate(h.created_at)}</span>
                      </div>

                      <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3">
                        <span>{h.kategori || "-"}</span>
                        <span>
                          Fee: {h.old_added_by || "-"} → <span className="font-semibold text-slate-700 dark:text-slate-200">{h.new_added_by || "-"}</span>
                        </span>
                        {h.note && <span className="text-emerald-600 dark:text-emerald-400">{h.note}</span>}
                      </div>

                      {h.error && (
                        <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-2.5 py-1.5 wrap-break-word">
                          {h.step ? `Gagal saat ${STEP_LABEL[h.step] || h.step}: ` : ""}
                          {h.error}
                        </p>
                      )}

                      {(h.status === "failed" || h.status === "pending" || h.status === "finalize_failed") && (
                        <div className="mt-2.5 flex gap-2 justify-end">
                          {h.status === "failed" && (
                            <ActionButton busy={busyId === h.id} onClick={() => historyAction(h, "retry")} icon="fa-rotate-right" tone="violet">
                              Coba ulang
                            </ActionButton>
                          )}
                          {h.status === "finalize_failed" && (
                            <ActionButton busy={busyId === h.id} onClick={() => historyAction(h, "finalize")} icon="fa-database" tone="violet">
                              Selesaikan data
                            </ActionButton>
                          )}
                          {(h.status === "failed" || h.status === "pending") && (
                            <ActionButton busy={busyId === h.id} onClick={() => historyAction(h, "cancel")} icon="fa-xmark" tone="slate">
                              Batalkan
                            </ActionButton>
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

// ══════════════════════════════════════════════════════════════
// SMALL PARTS
// ══════════════════════════════════════════════════════════════

function Chip({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
      <i className={`fa-solid ${icon} text-[9px]`}></i>
      {children}
    </span>
  );
}

function BrokenCard({ acc }: { acc: SoldAccount }) {
  return (
    <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/5 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
      <Info label="Username" value={<span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{acc.username}</span>} />
      <Info label="Kategori" value={acc.kategori || "-"} />
      <Info label="Pemilik (penginput)" value={acc.added_by || "-"} />
      <Info label="Nomor order" value={<span className="font-mono">{acc.order_id || "-"}</span>} />
      <Info label="Laku" value={fmtDate(acc.sold_at)} />
      <Info label="Pembeli" value={acc.buyer_name || "-"} />
      <Info label="Pendapatan" value={fmtRupiah(acc.income)} />
      <Info label="Produk" value={<span className="line-clamp-2">{acc.product_title || "-"}</span>} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">{label}</p>
      <div className="text-slate-700 dark:text-slate-200 wrap-break-word">{value}</div>
    </div>
  );
}

function SwapSide({
  tone,
  title,
  username,
  owner,
}: {
  tone: "rose" | "emerald";
  title: string;
  username?: string;
  owner?: string | null;
}) {
  const cls =
    tone === "rose"
      ? "border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/5"
      : "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5";
  return (
    <div className={`flex-1 rounded-xl border p-4 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{title}</p>
      <p className="font-mono font-bold text-base text-slate-900 dark:text-white mt-1 truncate">{username || "—"}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Milik {owner || "-"}</p>
    </div>
  );
}

function ActionButton({
  busy,
  onClick,
  icon,
  tone,
  children,
}: {
  busy: boolean;
  onClick: () => void;
  icon: string;
  tone: "violet" | "slate";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 ${
        tone === "violet"
          ? "bg-violet-600 hover:bg-violet-500 text-white"
          : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
      }`}
    >
      <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : icon} text-[10px]`}></i>
      {children}
    </button>
  );
}
