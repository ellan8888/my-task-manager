"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { registerPushSubscription } from "@/lib/push";
import type { CurrentUser } from "@/lib/types";

type ActivePage = "tasks" | "joki";

type AppShellProps = {
  active: ActivePage;
  title: string;
  subtitle: string;
  currentUser: CurrentUser | null;
  headerActions?: ReactNode;
  /** Ganti nilai ini tiap data berubah biar badge sidebar ikut refresh */
  refreshKey?: string | number;
  children: ReactNode;
};

// ══════════════════════════════════════════════════════════════
// NAV STYLES
// ══════════════════════════════════════════════════════════════

const navBase =
  "w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-sm transition-all group border";
const navActive =
  "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200 font-semibold border-violet-200 dark:border-violet-500/40";
const navIdle =
  "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 font-medium border-transparent";

function NavIcon({ icon, active }: { icon: string; active: boolean }) {
  return (
    <i
      className={`fa-solid ${icon} w-5 text-center transition ${
        active
          ? "text-violet-600 dark:text-violet-300"
          : "group-hover:text-violet-500 dark:group-hover:text-violet-400"
      }`}
    ></i>
  );
}

function NavBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={`ml-auto text-xs px-2.5 py-0.5 rounded-full font-bold ${
        active
          ? "bg-violet-600 text-white"
          : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
      }`}
    >
      {count}
    </span>
  );
}

function NavGroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {children}
    </p>
  );
}

async function getBotStatus(): Promise<{ isOnline: boolean; lastHeartbeatHuman: string } | null> {
  try {
    const res = await fetch("/api/bot/status");
    const data = await res.json();
    if (data.success) return { isOnline: data.isOnline, lastHeartbeatHuman: data.lastHeartbeatHuman };
  } catch (err) {
    console.error("Fetch bot status error:", err);
  }
  return null;
}

// ══════════════════════════════════════════════════════════════
// APP SHELL
// ══════════════════════════════════════════════════════════════

export default function AppShell({
  active,
  title,
  subtitle,
  currentUser,
  headerActions,
  refreshKey,
  children,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHydrated, setSidebarHydrated] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const [botStatus, setBotStatus] = useState<{ isOnline: boolean; lastHeartbeatHuman: string } | null>(null);
  const [restarting, setRestarting] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [defaultReminder, setDefaultReminder] = useState("20:00");

  const [counts, setCounts] = useState({ tasksTotal: 0, tasksDone: 0, joki: 0 });

  // ── Font Awesome ─────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById("fa-css")) return;
    const link = document.createElement("link");
    link.id = "fa-css";
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    document.head.appendChild(link);
  }, []);

  // ── Service worker ───────────────────────────────────────────
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => console.error("Service Worker registration failed:", error));
    }
  }, []);

  // ── Theme ────────────────────────────────────────────────────
  // Nilai dari localStorage cuma bisa dibaca setelah mount (biar nggak hydration mismatch)
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const darkMode = savedTheme ? savedTheme === "dark" : prefersDark;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(darkMode);
    document.documentElement.classList.toggle("dark", darkMode);
  }, []);

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem("theme", newMode ? "dark" : "light");
    document.documentElement.classList.toggle("dark", newMode);
  };

  // ── Sidebar persist ──────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("sidebarOpen");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved !== null) setSidebarOpen(saved === "true");
    setSidebarHydrated(true);
  }, []);

  useEffect(() => {
    if (sidebarHydrated) localStorage.setItem("sidebarOpen", String(sidebarOpen));
  }, [sidebarOpen, sidebarHydrated]);

  // Di HP, tutup sidebar setelah pindah halaman
  const closeOnMobile = () => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // ── Notification settings ───────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if ("Notification" in window) setNotificationPermission(Notification.permission);
    const saved = localStorage.getItem("defaultReminder");
    if (saved) setDefaultReminder(saved);
  }, []);

  const updateDefaultReminder = (value: string) => {
    setDefaultReminder(value);
    localStorage.setItem("defaultReminder", value);
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      alert("Browser kamu tidak mendukung notifikasi.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== "granted") {
        alert("Permission notifikasi ditolak.");
        return;
      }
      if (!currentUser?.username) {
        alert("User belum siap. Coba refresh halaman.");
        return;
      }
      await registerPushSubscription(currentUser.username);
      alert("Push notification berhasil diaktifkan!");
    } catch (error) {
      console.error("Gagal mengaktifkan push notification:", error);
      alert("Gagal mengaktifkan push notification. Cek Console.");
    }
  };

  const testPushNotification = async () => {
    try {
      const response = await fetch("/api/push", { method: "POST" });
      const result = await response.json();
      if (result.success) {
        alert(`Push berhasil dikirim!\n\nTerkirim: ${result.sent}\nGagal: ${result.failed}`);
      } else {
        alert(`Push gagal:\n${result.message || result.error}`);
      }
    } catch (error) {
      console.error("Test push error:", error);
      alert("Gagal menghubungi Push API.");
    }
  };

  // ── Bot status ───────────────────────────────────────────────
  const fetchBotStatus = () =>
    getBotStatus().then((status) => {
      if (status) setBotStatus(status);
    });

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRestartBot = async () => {
    if (!confirm("Jalankan ulang bot?\n\nIni bakal menjalankan login.py di komputer kamu.")) return;
    setRestarting(true);
    try {
      const res = await fetch("/api/bot/restart", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("✅ Bot sedang di-restart...\n\nTunggu 30-60 detik.");
        setTimeout(fetchBotStatus, 5000);
        setTimeout(fetchBotStatus, 15000);
      } else {
        alert(`❌ Gagal: ${data.message}`);
      }
    } catch {
      alert("❌ Gagal menghubungi restart server");
    } finally {
      setRestarting(false);
    }
  };

  // ── Badge counts (task & joki) ───────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const u = currentUser.username;

    (async () => {
      const [total, done, joki] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("username", u),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("username", u).eq("completed", true),
        supabase.from("joki_orders").select("id", { count: "exact", head: true }).eq("joki_name", u).eq("completed", false),
      ]);
      setCounts({
        tasksTotal: total.count ?? 0,
        tasksDone: done.count ?? 0,
        joki: joki.count ?? 0,
      });
    })();
  }, [currentUser, refreshKey]);

  const tasksOpen = counts.tasksTotal - counts.tasksDone;
  const progressPct = counts.tasksTotal > 0 ? Math.round((counts.tasksDone / counts.tasksTotal) * 100) : 0;
  const initial = (currentUser?.display_name || currentUser?.username || "?").charAt(0).toUpperCase();

  // ══════════════════════════════════════════════════════════════
  // JSX
  // ══════════════════════════════════════════════════════════════

  return (
    <>
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          opacity: 0; cursor: pointer; position: absolute;
          right: 0; top: 0; width: 100%; height: 100%;
        }
        input[type="date"], input[type="time"] { color-scheme: dark; }
        html:not(.dark) input[type="date"],
        html:not(.dark) input[type="time"] { color-scheme: light; }

        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-in { animation: modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes indeterminate {
          0%   { left: -35%; right: 100%; }
          50%  { left: 100%; right: -35%; }
          100% { left: -35%; right: 100%; }
        }

        body, aside, main, header {
          transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
        }
        .custom-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .custom-scrollbar::-webkit-scrollbar { display: none; }
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-violet-500 selection:text-white flex flex-col relative">
        {/* OVERLAY (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 h-screen bg-white dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between p-5 transform-gpu will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="overflow-y-auto custom-scrollbar">
            {/* Brand + bot status */}
            <div className="flex items-center space-x-3.5 pb-6 border-b border-slate-200 dark:border-slate-800/80">
              <div className="w-11 h-11 rounded-2xl bg-linear-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30 ring-2 ring-violet-500/20">
                <i className="fa-solid fa-gamepad text-xl"></i>
              </div>
              <div>
                <h1 className="font-extrabold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">
                  My Task Manager
                </h1>
                <div className="text-xs font-medium flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {botStatus === null ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      <span className="text-slate-500 dark:text-slate-400">Cek bot...</span>
                    </>
                  ) : botStatus.isOnline ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Bot Online • {botStatus.lastHeartbeatHuman}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      <span className="text-rose-600 dark:text-rose-400">
                        Bot Offline • {botStatus.lastHeartbeatHuman}
                      </span>
                      <button
                        onClick={handleRestartBot}
                        disabled={restarting}
                        className="ml-1 px-2 py-0.5 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold transition disabled:opacity-50 flex items-center gap-1"
                        title="Jalankan ulang bot"
                      >
                        {restarting ? (
                          <i className="fa-solid fa-spinner fa-spin"></i>
                        ) : (
                          <>
                            <i className="fa-solid fa-rotate-right"></i>
                            <span>Restart</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* NAV */}
            <nav className="mt-4 space-y-1.5">
              <NavGroupLabel>Kuliah</NavGroupLabel>
              <Link
                href="/"
                onClick={closeOnMobile}
                className={`${navBase} ${active === "tasks" ? navActive : navIdle}`}
              >
                <NavIcon icon="fa-book-open" active={active === "tasks"} />
                <span>Tugas Kuliah</span>
                <NavBadge count={tasksOpen} active={active === "tasks"} />
              </Link>

              <NavGroupLabel>Jokian</NavGroupLabel>
              <Link
                href="/joki"
                onClick={closeOnMobile}
                className={`${navBase} ${active === "joki" ? navActive : navIdle}`}
              >
                <NavIcon icon="fa-list-check" active={active === "joki"} />
                <span>Daftar Order Jokian</span>
                <NavBadge count={counts.joki} active={active === "joki"} />
              </Link>
              <Link href="/queue" onClick={closeOnMobile} className={`${navBase} ${navIdle}`}>
                <NavIcon icon="fa-list-ol" active={false} />
                <span>Queue Jokian</span>
                <span className="ml-auto text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-mono">
                  Live
                </span>
              </Link>

              <NavGroupLabel>Lainnya</NavGroupLabel>
              <button
                onClick={() => setShowSettings((v) => !v)}
                className={`${navBase} ${showSettings ? navActive : navIdle}`}
              >
                <NavIcon icon="fa-bell" active={showSettings} />
                <span>Notification</span>
                <span
                  className={`ml-auto w-2 h-2 rounded-full ${
                    notificationPermission === "granted" ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                ></span>
              </button>
            </nav>

            {/* Progres tugas kuliah */}
            <div className="mt-6 p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Progres Tugas Kuliah</span>
                <span className="text-violet-600 dark:text-violet-400">{progressPct}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-linear-to-r from-violet-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-500">
                {counts.tasksDone} dari {counts.tasksTotal} tugas selesai
              </p>
            </div>
          </div>

          {/* Footer sidebar */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
            <Link
              href="/admin"
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all group cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                    {initial}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition">
                    {currentUser?.display_name || "Loading..."}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition flex items-center gap-1">
                    <i className="fa-solid fa-shield-halved text-[9px]"></i>
                    {currentUser?.role === "superadmin" ? "Superadmin" : "User"}
                  </p>
                </div>
              </div>
              <i className="fa-solid fa-chevron-right text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all text-xs"></i>
            </Link>

            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center space-x-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            >
              <i className={`fa-solid ${isDark ? "fa-sun" : "fa-moon"} text-sm text-slate-700 dark:text-slate-300`}></i>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isDark ? "Mode Terang" : "Mode Gelap"}
              </span>
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main
          className={`flex-1 flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            sidebarOpen ? "md:ml-72" : "md:ml-0"
          }`}
        >
          <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                title={sidebarOpen ? "Tutup Sidebar" : "Buka Sidebar"}
              >
                <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
              </button>
              <div>
                <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">{subtitle}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                onClick={testPushNotification}
                className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold border border-slate-200 dark:border-slate-800 transition shadow-sm active:scale-95"
              >
                <i className="fa-solid fa-bolt text-amber-500 dark:text-amber-400"></i>
                <span className="hidden sm:inline">Simulasi Webhook</span>
              </button>
              {headerActions}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-4 md:px-8 py-4 space-y-4">
              {/* NOTIFICATION SETTINGS */}
              {showSettings && (
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <i className="fa-solid fa-bell text-violet-600 dark:text-violet-400"></i>
                        <span>Notification Settings</span>
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Atur pengaturan reminder My Task Manager.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Push Notification</p>
                        <p className="text-xs text-slate-500">Terima reminder meskipun aplikasi tidak sedang dibuka.</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          notificationPermission === "granted"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {notificationPermission === "granted" ? "ON" : "OFF"}
                      </span>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Default Daily Reminder (Tugas)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={defaultReminder}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^0-9:]/g, "");
                            if (val.length === 2 && !val.includes(":")) val = val + ":";
                            updateDefaultReminder(val.slice(0, 5));
                          }}
                          placeholder="20:00"
                          maxLength={5}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 pr-11 text-sm text-slate-900 dark:text-slate-200 outline-none transition focus:border-violet-500 font-mono"
                        />
                        <i className="fa-regular fa-clock absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Format 24 jam (HH:MM), contoh: <span className="font-mono">20:00</span>
                      </p>
                    </div>
                    {notificationPermission !== "granted" && (
                      <button
                        onClick={enableNotifications}
                        className="w-full rounded-xl bg-slate-200 dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-bell"></i>
                        <span>Enable Push Notification</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {children}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
