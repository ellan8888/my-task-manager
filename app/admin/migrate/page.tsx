"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/app/components/ToastProvider";
import KategoriDropdown from "../stock/KategoriDropdown"; // ⚠️ Sesuaikan path jika berbeda
import { useSidebar } from "../SidebarContext"; // ⚠️ Sesuaikan path jika berbeda

export default function BulkMigratePage() {
  const toast = useToast();
  const { sidebarOpen, toggleSidebar } = useSidebar();

  // ⭐ State user & akses
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [fromKategori, setFromKategori] = useState("");
  const [targetKategori, setTargetKategori] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  const [kategoriList, setKategoriList] = useState<any[]>([]);

  // Fetch user (untuk proteksi)
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.user) {
          setUser(data.user);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingUser(false));
  }, []);

  // Fetch kategori
  useEffect(() => {
    fetch("/api/kategori/links")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setKategoriList(data.list || []);
      })
      .catch((err) => console.error("Gagal load kategori:", err));
  }, []);

  const handleMigrate = async () => {
    if (!fromKategori || !targetKategori) {
      toast.warning("Pilih kategori asal dan tujuan!");
      return;
    }

    if (fromKategori.toLowerCase() === targetKategori.toLowerCase()) {
      toast.warning("Kategori asal dan tujuan tidak boleh sama!");
      return;
    }

    const confirm = window.confirm(
      `PERINGATAN!\n\nKamu akan memindahkan SEMUA akun dari kategori:\n"${fromKategori}"\n\nKe kategori:\n"${targetKategori}"\n\nProses ini akan dijalankan di belakang layar oleh bot dan memakan waktu. Lanjutkan?`
    );

    if (!confirm) return;

    setIsMigrating(true);
    try {
      const res = await fetch("/api/accounts/stock/bulk-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromKategori,
          targetKategori,
          addedBy: user?.username || "admin",
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        // ⭐ Opsional: reset form setelah sukses
        // setFromKategori("");
        // setTargetKategori("");
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat memproses migrasi massal.");
    } finally {
      setIsMigrating(false);
    }
  };

  // ══════════════════════════════════════════════════════
  // GUARD (PROTEKSI HALAMAN)
  // ══════════════════════════════════════════════════════
  if (loadingUser) {
    return (
      <>
        <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition"
            >
              <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
            </button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-orange-500"></i>
        </div>
      </>
    );
  }

  if (user?.username !== "ellan" && user?.role !== "superadmin") {
    return (
      <>
        <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition"
            >
              <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
            </button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-500/20">
              <i className="fa-solid fa-lock text-2xl"></i>
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Akses Ditolak
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Halaman ini cuma bisa diakses oleh Owner (ellan).
            </p>
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════
  // RENDER HALAMAN UTAMA
  // ══════════════════════════════════════════════════════
  return (
    <>
      {/* Header Utama */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition"
            title={sidebarOpen ? "Tutup Sidebar" : "Buka Sidebar"}
          >
            <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
          </button>
          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
            <i className="fa-solid fa-people-carry-box text-base"></i>
          </div>
          <div>
            <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Migrasi Massal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Pindahkan semua akun antar kategori sekaligus
            </p>
          </div>
        </div>
      </header>

      {/* Konten */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Card Form */}
          <div className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            
            {/* Ornamen Background */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 dark:bg-orange-500/5 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10">
              
              {/* Judul Card */}
              <h2 className="font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                <i className="fa-solid fa-people-carry-box text-orange-600 dark:text-orange-400"></i>
                <span>Form Migrasi Kategori</span>
              </h2>

              {/* Info Box Peringatan */}
              <div className="bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 p-4 rounded-xl border border-orange-200 dark:border-orange-500/20 text-sm flex gap-3 shadow-sm mb-6">
                <i className="fa-solid fa-triangle-exclamation mt-0.5 text-base shrink-0"></i>
                <p className="leading-relaxed">
                  Fitur ini akan menandai <strong>semua akun</strong> di kategori asal untuk dihapus dari Itemku. Setelah bot selesai menghapus, akun akan otomatis dipindahkan ke kategori tujuan.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Input Asal */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                    Dari Kategori (Asal)
                  </label>
                  <KategoriDropdown
                    value={fromKategori}
                    onChange={setFromKategori}
                    options={kategoriList.map((k) => ({ id: k.id, kategori: k.kategori }))}
                    placeholder="Pilih kategori asal..."
                    hideLabel={true}
                  />
                </div>

                {/* Input Tujuan */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                    Ke Kategori (Tujuan)
                  </label>
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

              {/* Tombol Eksekusi */}
              <button
                onClick={handleMigrate}
                disabled={isMigrating || !fromKategori || !targetKategori}
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
                    <span>Mulai Migrasi Massal</span>
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