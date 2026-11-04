"use client";

// Migrasi Massal — pindahkan akun yang SEDANG DIJUAL dari satu kategori ke kategori lain.
// Aman: akun laku, Stok Pribadi, dan yang sedang diproses tidak ikut; pemilik akun tidak berubah.

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/app/components/ToastProvider";
import { useConfirmAsync } from "@/app/components/ConfirmDialog";
import AdminHeader from "@/app/components/AdminHeader";
import RoleBadge from "@/app/components/RoleBadge";
import { Avatar } from "@/app/components/Pickers";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import KategoriDropdown from "../stock/KategoriDropdown";

type Preview = {
  from: string;
  total: number;
  owners: { owner: string; total: number; listed: number; queued: number }[];
  skipped: { sold: number; personal: number; deleting: number; busy: number; other: number };
};

type QueueRow = { from: string; to: string; waiting: number; failed: number; stuck: number; last_error: string | null };

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const SKIP_LABEL: { key: keyof Preview["skipped"]; label: string; icon: string }[] = [
  { key: "sold", label: "sudah laku", icon: "fa-circle-check" },
  { key: "personal", label: "Stok Pribadi", icon: "fa-box-archive" },
  { key: "deleting", label: "sedang dihapus / dipindah", icon: "fa-trash-can" },
  { key: "busy", label: "dipakai Ganti Akun / Kirim Manual", icon: "fa-right-left" },
  { key: "other", label: "status lain", icon: "fa-circle-question" },
];

export default function BulkMigratePage() {
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirmAsync();
  const { user, loading: loadingUser } = useCurrentUser();
  const allowed = user?.username?.toLowerCase() === "ellan" || user?.role === "superadmin";

  const [kategoriList, setKategoriList] = useState<{ id: number; kategori: string }[]>([]);
  const [fromKategori, setFromKategori] = useState("");
  const [targetKategori, setTargetKategori] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/kategori/links")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setKategoriList(data.list || []);
      })
      .catch(() => {});
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts/stock/bulk-move");
      const data = await res.json();
      if (data.success) setQueue(data.queue || []);
    } catch {
      /* dicoba lagi berikutnya */
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const t = setTimeout(loadQueue, 0);
    return () => clearTimeout(t);
  }, [allowed, loadQueue]);

  useEffect(() => {
    if (!allowed || queue.length === 0) return;
    const t = setInterval(loadQueue, 15000);
    return () => clearInterval(t);
  }, [allowed, queue.length, loadQueue]);

  // Pratinjau saat kategori asal dipilih
  useEffect(() => {
    if (!allowed || !fromKategori) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch(`/api/accounts/stock/bulk-move?from=${encodeURIComponent(fromKategori)}`);
        const data = await res.json();
        if (!cancelled) {
          if (data.success) setPreview(data);
          else toast.error(data.message || "Gagal memuat pratinjau");
        }
      } catch {
        if (!cancelled) toast.error("Gagal memuat pratinjau");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [allowed, fromKategori, toast]);

  const chooseFrom = (v: string) => {
    setPreview(null);
    setFromKategori(v);
    if (v && v.toLowerCase() === targetKategori.toLowerCase()) setTargetKategori("");
  };

  const handleMigrate = async () => {
    if (!fromKategori || !targetKategori || !preview || preview.total === 0) return;
    const perOwner = preview.owners.map((o) => `${cap(o.owner)}: ${o.total} akun`).join("\n");
    const ok = await confirm({
      title: `Pindahkan ${preview.total} akun?`,
      message:
        `Dari "${fromKategori}" ke "${targetKategori}".\n\n${perOwner}\n\n` +
        "Bot akan menghapus akun-akun ini dari link Itemku lama, lalu memajangnya di kategori baru. " +
        "Pemilik akun tetap sama. Akun laku dan Stok Pribadi tidak ikut.",
      variant: "warning",
      confirmText: "Ya, pindahkan",
    });
    if (!ok) return;

    setIsMigrating(true);
    try {
      const res = await fetch("/api/accounts/stock/bulk-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromKategori, targetKategori }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setFromKategori("");
        setTargetKategori("");
        setPreview(null);
        loadQueue();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Terjadi kesalahan saat memproses migrasi massal.");
    } finally {
      setIsMigrating(false);
    }
  };

  const cancelQueue = async (row: QueueRow) => {
    const ok = await confirm({
      title: "Batalkan migrasi?",
      message:
        `${row.waiting + row.failed + row.stuck} akun "${row.from}" → "${row.to}" yang belum diproses bot akan kembali normal.\n\n` +
        "Akun yang sedang dihapus bot saat ini otomatis dipajang ulang di kategori lamanya.",
      variant: "danger",
      confirmText: "Batalkan migrasi",
    });
    if (!ok) return;
    const key = `${row.from}→${row.to}`;
    setCancelling(key);
    try {
      const res = await fetch("/api/accounts/stock/bulk-move", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromKategori: row.from, targetKategori: row.to }),
      });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.error(data.message || "Gagal membatalkan");
      loadQueue();
    } catch {
      toast.error("Gagal membatalkan");
    } finally {
      setCancelling(null);
    }
  };

  const header = (
    <AdminHeader
      icon="fa-people-carry-box"
      iconClassName="from-orange-500 to-amber-500 shadow-orange-500/30"
      title="Migrasi Massal"
      subtitle="Pindahkan akun yang sedang dijual antar kategori sekaligus"
    />
  );

  if (loadingUser) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-orange-500"></i>
        </div>
      </>
    );
  }

  if (!allowed) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-500/20">
              <i className="fa-solid fa-lock text-2xl"></i>
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Akses Ditolak</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Halaman ini cuma bisa diakses oleh Owner.</p>
          </div>
        </div>
      </>
    );
  }

  const skippedTotal = preview ? Object.values(preview.skipped).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      {header}
      {confirmDialog}

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* ═══ ANTREAN BERJALAN ═══ */}
          {queue.length > 0 && (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-hourglass-half text-amber-600 dark:text-amber-400"></i>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Migrasi sedang berjalan</h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-auto flex items-center gap-1.5">
                  <i className="fa-solid fa-rotate fa-spin text-[9px]"></i> diperbarui tiap 15 detik
                </span>
              </div>
              <div className="space-y-2">
                {queue.map((q) => {
                  const key = `${q.from}→${q.to}`;
                  return (
                    <div
                      key={key}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-white dark:bg-slate-900/60 border border-amber-200 dark:border-amber-500/20 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                          {q.from}
                          <i className="fa-solid fa-arrow-right-long text-xs text-amber-500"></i>
                          {q.to}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                          <span>{q.waiting} menunggu bot</span>
                          {q.failed > 0 && <span className="text-orange-600 dark:text-orange-400">{q.failed} gagal, dicoba ulang</span>}
                          {q.stuck > 0 && <span className="text-rose-600 dark:text-rose-400">{q.stuck} berhenti (gagal 5x)</span>}
                        </p>
                        {q.last_error && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 truncate" title={q.last_error}>
                            Error terakhir: {q.last_error}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => cancelQueue(q)}
                        disabled={cancelling === key}
                        className="px-3 py-2 rounded-xl text-xs font-bold border border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {cancelling === key ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-ban"></i>}
                        Batalkan migrasi
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ FORM ═══ */}
          <div className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative">
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 dark:bg-orange-500/5 rounded-full blur-2xl"></div>
            </div>

            <div className="relative z-10">
              <h2 className="font-bold mb-5 flex items-center gap-2 text-slate-900 dark:text-white">
                <i className="fa-solid fa-people-carry-box text-orange-600 dark:text-orange-400"></i>
                <span>Form Migrasi Kategori</span>
              </h2>

              <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 mb-6 space-y-1.5">
                <p className="flex gap-2">
                  <i className="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i>
                  <span>Yang ikut: akun yang <strong>sedang dijual</strong> atau <strong>menunggu dipajang</strong> di Itemku.</span>
                </p>
                <p className="flex gap-2">
                  <i className="fa-solid fa-user-shield text-emerald-500 mt-0.5"></i>
                  <span>Pemilik akun <strong>tidak berubah</strong>, pendapatan tetap masuk ke pemiliknya.</span>
                </p>
                <p className="flex gap-2">
                  <i className="fa-solid fa-ban text-slate-400 mt-0.5"></i>
                  <span>Tidak ikut: akun laku, Stok Pribadi, dan akun yang sedang diproses.</span>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Dari Kategori (Asal)</label>
                  <KategoriDropdown
                    value={fromKategori}
                    onChange={chooseFrom}
                    options={kategoriList.map((k) => ({ id: k.id, kategori: k.kategori }))}
                    placeholder="Pilih kategori asal..."
                    hideLabel={true}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Ke Kategori (Tujuan)</label>
                  <KategoriDropdown
                    value={targetKategori}
                    onChange={setTargetKategori}
                    options={kategoriList
                      .filter((k) => k.kategori.toLowerCase() !== fromKategori.toLowerCase())
                      .map((k) => ({ id: k.id, kategori: k.kategori }))}
                    placeholder="Pilih kategori tujuan..."
                    hideLabel={true}
                  />
                </div>
              </div>

              {/* ═══ PRATINJAU ═══ */}
              {fromKategori && (
                <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    <i className="fa-solid fa-list-check text-orange-500"></i>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Pratinjau</span>
                    {previewLoading && <i className="fa-solid fa-spinner fa-spin text-orange-500 text-xs ml-auto"></i>}
                    {preview && !previewLoading && (
                      <span className="ml-auto text-xs font-bold text-slate-600 dark:text-slate-300">{preview.total} akun akan dipindah</span>
                    )}
                  </div>

                  {preview && !previewLoading && (
                    <div className="p-4 space-y-4">
                      {preview.total === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <i className="fa-solid fa-box-open text-slate-400"></i>
                          Tidak ada akun yang sedang dijual di kategori ini.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {preview.owners.map((o) => (
                            <div key={o.owner} className="py-2.5 flex items-center gap-3">
                              <Avatar label={o.owner} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                  {cap(o.owner)} <RoleBadge username={o.owner} />
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {o.listed} sedang dijual · {o.queued} menunggu dipajang
                                </p>
                              </div>
                              <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{o.total}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {skippedTotal > 0 && (
                        <div className="rounded-lg bg-slate-50 dark:bg-slate-950/50 px-3 py-2.5">
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">{skippedTotal} akun tidak ikut</p>
                          <div className="flex flex-wrap gap-1.5">
                            {SKIP_LABEL.filter((s) => preview.skipped[s.key] > 0).map((s) => (
                              <span
                                key={s.key}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300"
                              >
                                <i className={`fa-solid ${s.icon} text-[9px] text-slate-400`}></i>
                                {preview.skipped[s.key]} {s.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleMigrate}
                disabled={isMigrating || !fromKategori || !targetKategori || !preview || preview.total === 0}
                className="w-full bg-linear-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {isMigrating ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-base"></i>
                    <span>Memproses Migrasi...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-people-carry-box text-base"></i>
                    <span>{preview && preview.total > 0 ? `Pindahkan ${preview.total} akun` : "Mulai Migrasi Massal"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
