"use client";

// VersionWatcher — halaman My Task yang dibiarkan terbuka lama tetap memakai kode lama walaupun web sudah
// diperbarui (fitur baru / perbaikan tidak terasa sampai di-refresh manual). Komponen ini mengecek versi server:
//   • tab sedang tidak dilihat → langsung dimuat ulang diam-diam saat kembali dibuka
//   • tab sedang dipakai      → muncul pita kecil "Versi baru tersedia · Muat ulang" (tidak memotong ketikan)

import { useEffect, useState } from "react";

declare const __BUILD_ID__: string;
const MINE = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "";
const CHECK_MS = 2 * 60_000;

export default function VersionWatcher() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!MINE) return;
    let newer = false;
    let alive = true;
    const check = async () => {
      if (newer) return;
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const d = await r.json();
        if (alive && d?.build && d.build !== MINE) {
          newer = true;
          setStale(true);
        }
      } catch {
        /* offline — coba lagi nanti */
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (newer) window.location.reload();          // kembali ke tab yang sudah usang → muat ulang otomatis
      else check();
    };
    const t = setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", onVisible);
    check();
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!stale) return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl shadow-slate-900/25 pl-4 pr-1.5 py-1.5 text-sm">
      <i className="fa-solid fa-arrows-rotate text-xs"></i>
      <span className="font-medium">Versi baru My Task tersedia</span>
      <button
        onClick={() => window.location.reload()}
        className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3.5 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
      >
        Muat ulang
      </button>
    </div>
  );
}
