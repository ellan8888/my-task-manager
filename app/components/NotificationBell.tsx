"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getPushStatus, registerPushSubscription } from "@/lib/push";
import { useToast } from "@/app/components/ToastProvider";

type Notif = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

export const KIND_STYLE: Record<string, { icon: string; cls: string; label: string }> = {
  akun_laku: { icon: "fa-bag-shopping", cls: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400", label: "Akun laku" },
  penarikan: { icon: "fa-money-bill-transfer", cls: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", label: "Penarikan" },
  transfer: { icon: "fa-right-left", cls: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400", label: "Transfer" },
  joki: { icon: "fa-gamepad", cls: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400", label: "Jokian" },
  bot: { icon: "fa-robot", cls: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400", label: "Bot" },
  reminder: { icon: "fa-clock", cls: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400", label: "Pengingat" },
  sistem: { icon: "fa-circle-info", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", label: "Info" },
};

export function timeAgo(iso: string) {
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const POLL_MS = 30_000;

/** Ikon lonceng + panel riwayat notifikasi. Dipasang di header (AdminHeader & AppShell). */
export default function NotificationBell() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pushState, setPushState] = useState<"unknown" | "on" | "off" | "unsupported" | "denied">("unknown");
  const [enabling, setEnabling] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const boundRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=30", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setItems(data.data || []);
        setUnread(data.unread || 0);
      }
    } catch {
      /* offline — coba lagi nanti */
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPushState = useCallback(async () => {
    const s = await getPushStatus();
    if (!s.supported) return setPushState("unsupported");
    if (s.permission === "denied") return setPushState("denied");
    if (s.permission === "granted" && s.subscribed) {
      setPushState("on");
      // Perangkat lama (didaftarkan tanpa nama user) → ikat ulang ke user yang login, sekali per sesi
      if (!boundRef.current) {
        boundRef.current = true;
        registerPushSubscription().catch(() => null);
      }
      return;
    }
    setPushState("off");
  }, []);

  useEffect(() => {
    const first = setTimeout(() => {
      load();
      refreshPushState();
    }, 0);
    const t = setInterval(load, POLL_MS);
    const onFocus = () => load();
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "notif:new") load();
    };
    window.addEventListener("focus", onFocus);
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      navigator.serviceWorker?.removeEventListener("message", onMsg);
    };
  }, [load, refreshPushState]);

  // Angka di ikon aplikasi (PWA) ikut angka belum dibaca
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (unread > 0) nav.setAppBadge?.(unread).catch(() => null);
    else nav.clearAppBadge?.().catch(() => null);
  }, [unread]);

  // Tutup saat klik di luar / tekan Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = async (body: { ids?: number[]; all?: boolean }) => {
    setItems((prev) =>
      prev.map((n) => (body.all || body.ids?.includes(n.id) ? { ...n, read_at: n.read_at || new Date().toISOString() } : n))
    );
    setUnread((u) => (body.all ? 0 : Math.max(0, u - (body.ids?.length || 0))));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    }).catch(() => null);
  };

  const openItem = async (n: Notif) => {
    if (!n.read_at) markRead({ ids: [n.id] });
    setOpen(false);
    if (n.url && n.url.startsWith("/")) router.push(n.url);
  };

  const enablePush = async () => {
    setEnabling(true);
    try {
      await registerPushSubscription();
      toast.success("Notifikasi di perangkat ini sudah aktif");
      setPushState("on");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengaktifkan notifikasi");
      refreshPushState();
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="relative shrink-0" ref={boxRef}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition"
        title="Notifikasi"
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
      >
        <i className={`fa-${unread ? "solid" : "regular"} fa-bell text-base ${unread ? "text-violet-600 dark:text-violet-400" : ""}`}></i>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-16 sm:top-12 sm:w-96 z-50 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifikasi</h3>
              {unread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[11px] font-bold">
                  {unread} baru
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => markRead({ all: true })}
                  className="px-2 py-1 rounded-lg text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                >
                  <i className="fa-solid fa-check-double mr-1"></i>Tandai dibaca
                </button>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/admin/notifikasi");
                }}
                className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                title="Pengaturan notifikasi"
              >
                <i className="fa-solid fa-gear text-sm"></i>
              </button>
            </div>
          </div>

          {pushState !== "on" && pushState !== "unknown" && (
            <div className="mx-3 mt-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5 flex items-start gap-2.5">
              <i className="fa-solid fa-mobile-screen-button text-amber-600 dark:text-amber-400 mt-0.5"></i>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {pushState === "unsupported"
                    ? "Browser ini tidak mendukung notifikasi HP"
                    : pushState === "denied"
                    ? "Izin notifikasi diblokir di browser ini"
                    : "Notifikasi HP belum aktif di perangkat ini"}
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                  {pushState === "denied"
                    ? "Buka pengaturan situs di browser, izinkan Notifikasi, lalu muat ulang."
                    : pushState === "unsupported"
                    ? "Di iPhone, tambahkan web ini ke Layar Utama dulu."
                    : "Riwayat tetap tersimpan di sini, tapi HP tidak berbunyi."}
                </p>
              </div>
              {pushState === "off" && (
                <button
                  onClick={enablePush}
                  disabled={enabling}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold disabled:opacity-60"
                >
                  {enabling ? <i className="fa-solid fa-spinner fa-spin"></i> : "Aktifkan"}
                </button>
              )}
            </div>
          )}

          <div className="max-h-[min(28rem,70vh)] overflow-y-auto custom-scrollbar py-1.5">
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-400">
                <i className="fa-solid fa-spinner fa-spin mr-2"></i>Memuat...
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <i className="fa-regular fa-bell-slash text-lg"></i>
                </div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada notifikasi</p>
                <p className="text-xs text-slate-400 mt-1">Kabar akun laku, penarikan, dan lainnya muncul di sini.</p>
              </div>
            ) : (
              items.map((n) => {
                const st = KIND_STYLE[n.kind] || KIND_STYLE.sistem;
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      n.read_at ? "" : "bg-violet-50/60 dark:bg-violet-500/5"
                    }`}
                  >
                    <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${st.cls}`}>
                      <i className={`fa-solid ${st.icon} text-sm`}></i>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={`text-sm truncate ${n.read_at ? "font-medium text-slate-700 dark:text-slate-300" : "font-bold text-slate-900 dark:text-white"}`}>
                          {n.title}
                        </span>
                        {!n.read_at && <span className="w-2 h-2 shrink-0 rounded-full bg-violet-500"></span>}
                      </span>
                      {n.body && <span className="block text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{n.body}</span>}
                      <span className="block text-[11px] text-slate-400 mt-1">
                        {st.label} · {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              router.push("/admin/notifikasi");
            }}
            className="w-full border-t border-slate-100 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            Lihat semua & pengaturan<i className="fa-solid fa-arrow-right ml-1.5 text-[10px]"></i>
          </button>
        </div>
      )}
    </div>
  );
}
