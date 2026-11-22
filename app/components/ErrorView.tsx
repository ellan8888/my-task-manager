"use client";
// Tampilan saat halaman gagal dimuat (dipakai app/error.tsx, app/global-error.tsx, app/not-found.tsx).
// Tanpa ini, error di satu komponen membuat seluruh layar putih kosong.
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  kind: "error" | "notfound";
  error?: unknown;
  /** vinext memberi `reset`, Next 16.4 memberi `retry` — dukung keduanya */
  onRetry?: () => void;
};

export default function ErrorView({ kind, error, onRetry }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const err = error instanceof Error ? (error as Error & { digest?: string }) : null;
  // Chunk lama setelah deploy baru → solusi paling ampuh: muat ulang penuh
  const staleChunk = !!err && /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(err.message);

  useEffect(() => {
    if (error) console.error("[My Task] halaman error:", error);
  }, [error]);

  const notFound = kind === "notfound";
  return (
    <div className="min-h-[100dvh] grid place-items-center px-5 py-10 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md text-center motion-safe:animate-[riseIn_.45s_cubic-bezier(0.22,1,0.36,1)_both]">
        <div
          className={`mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl text-2xl ring-1 ${
            notFound
              ? "bg-violet-50 text-violet-600 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30"
              : "bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"
          }`}
        >
          <i className={`fa-solid ${notFound ? "fa-compass" : staleChunk ? "fa-rotate" : "fa-triangle-exclamation"}`} />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {notFound ? "Halaman tidak ditemukan" : staleChunk ? "Ada versi baru My Task" : "Halaman ini gagal dimuat"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {notFound
            ? "Alamatnya mungkin salah ketik atau halamannya sudah dipindah."
            : staleChunk
              ? "Muat ulang sekali supaya halaman memakai versi terbaru."
              : "Data kamu aman. Coba muat lagi; kalau masih gagal, kembali ke beranda lalu buka ulang menunya."}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="press inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-white dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-900"
          >
            <i className="fa-solid fa-house text-xs" /> Ke beranda
          </Link>
          {!notFound && (
            <button
              onClick={() => (staleChunk || !onRetry ? window.location.reload() : onRetry())}
              className="press inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/30 hover:bg-violet-700"
            >
              <i className="fa-solid fa-rotate-right text-xs" /> {staleChunk ? "Muat ulang" : "Coba lagi"}
            </button>
          )}
        </div>

        {err && !staleChunk && (
          <div className="mt-6 text-left">
            <button
              onClick={() => setShowDetail((v) => !v)}
              className="mx-auto flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              aria-expanded={showDetail}
            >
              <i className={`fa-solid fa-chevron-right text-[10px] transition-transform ${showDetail ? "rotate-90" : ""}`} />
              Detail untuk dilaporkan
            </button>
            <div className="collapse-grid mt-2" data-open={showDetail}>
              <div>
                <pre className="whitespace-pre-wrap break-words rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-200">
                  {err.message}
                  {err.digest ? `\nkode: ${err.digest}` : ""}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
