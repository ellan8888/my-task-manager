"use client";

import { useEffect, useState } from "react";

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number; // berapa lama splash tampil sebelum menutup (ms)
}

const TITLE = "My Task Manager";
const SESSION_KEY = "mtm_splash_seen";
const EXIT_MS = 450;

/**
 * Jalan langsung saat HTML dibaca browser (sebelum splash tergambar):
 * kalau splash sudah pernah tampil di sesi ini, atau HP/PC memakai
 * "kurangi animasi", tandai <html> supaya splash disembunyikan lewat CSS.
 * Jadi tidak ada kedipan splash saat refresh.
 */
const SKIP_SCRIPT = `(function(){try{var s=sessionStorage.getItem("${SESSION_KEY}")==="1";var r=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(s||r){document.documentElement.setAttribute("data-splash-skip","1")}else{sessionStorage.setItem("${SESSION_KEY}","1")}}catch(e){}})();`;

export default function LoadingScreen({ onComplete, duration = 1500 }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Cadangan kalau script di atas tidak jalan (misalnya navigasi tanpa reload)
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* sessionStorage diblokir — abaikan */
    }

    const exitTimer = setTimeout(() => setIsExiting(true), duration);
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, duration + EXIT_MS);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [duration, onComplete]);

  // ⭐ Klik / tap → lewati
  const skip = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, EXIT_MS);
  };

  if (!isVisible) return null;

  return (
    <>
      <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SKIP_SCRIPT }} />

      <style>{`
        html[data-splash-skip] .ls-root { display: none !important; }

        @keyframes ls-pop {
          from { transform: scale(0.4); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes ls-orbit { to { transform: rotate(360deg); } }
        @keyframes ls-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ls-drop {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ls-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ls-exit {
          to { transform: scale(1.15); opacity: 0; filter: blur(6px); }
        }

        .ls-logo   { animation: ls-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .ls-orbit  { animation: ls-orbit 1.4s linear infinite, ls-fade-in 0.3s 0.2s both; }
        .ls-letter { display: inline-block; opacity: 0; animation: ls-drop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .ls-sub    { animation: ls-up 0.5s 1s both; }
        .ls-exit .ls-content { animation: ls-exit ${EXIT_MS}ms ease-in forwards; }
      `}</style>

      <div
        className={`ls-root fixed inset-0 z-9999 flex items-center justify-center bg-[#0b0f19] cursor-pointer select-none transition-opacity ease-in ${
          isExiting ? "ls-exit opacity-0" : "opacity-100"
        }`}
        style={{ transitionDuration: `${EXIT_MS}ms` }}
        onClick={skip}
        role="status"
        aria-label="Memuat My Task Manager"
      >
        <div className="ls-content flex flex-col items-center text-center px-6">
          {/* Logo + titik orbit */}
          <div className="ls-logo relative w-16 h-16 rounded-[18px] bg-violet-600 flex items-center justify-center shadow-[0_10px_40px_-8px_rgba(124,58,237,0.7)]">
            <div className="ls-orbit absolute -inset-4 rounded-full border border-dashed border-violet-400/35">
              <span className="absolute -top-1 left-1/2 -ml-1 w-2 h-2 rounded-full bg-violet-300 shadow-[0_0_10px_#a78bfa]"></span>
            </div>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="#fff"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Judul — huruf jatuh bergantian */}
          <h1 className="mt-9 text-2xl md:text-3xl font-black text-white tracking-wide" aria-hidden="true">
            {TITLE.split("").map((ch, i) => (
              <span key={i} className="ls-letter" style={{ animationDelay: `${0.3 + i * 0.04}s` }}>
                {ch === " " ? " " : ch}
              </span>
            ))}
          </h1>

          <p className="ls-sub mt-3 text-xs text-slate-400 font-medium">Menyiapkan tugas dan order kamu...</p>
        </div>
      </div>
    </>
  );
}
