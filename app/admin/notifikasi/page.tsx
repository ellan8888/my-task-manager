"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/app/components/AdminHeader";
import { useToast } from "@/app/components/ToastProvider";
import { useConfirmAsync } from "@/app/components/ConfirmDialog";
import { KIND_STYLE, timeAgo } from "@/app/components/NotificationBell";
import { getPushStatus, registerPushSubscription, sendTestPush, unregisterPushSubscription } from "@/lib/push";

type Notif = { id: number; kind: string; title: string; body: string | null; url: string | null; read_at: string | null; created_at: string };
type Device = { id: number; endpoint: string; user_agent?: string | null; created_at?: string | null; last_used_at?: string | null };
type Prefs = { muted_kinds: string[]; quiet_start: string | null; quiet_end: string | null };

function describeDevice(ua?: string | null) {
  const s = ua || "";
  const os = /iPhone|iPad/.test(s) ? "iPhone / iPad" : /Android/.test(s) ? "Android" : /Windows/.test(s) ? "Windows" : /Mac OS/.test(s) ? "Mac" : /Linux/.test(s) ? "Linux" : "Perangkat";
  const br = /Edg\//.test(s) ? "Edge" : /OPR\//.test(s) ? "Opera" : /Chrome\//.test(s) ? "Chrome" : /Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : "Browser";
  const icon = /iPhone|iPad|Android/.test(s) ? "fa-mobile-screen-button" : "fa-desktop";
  return { label: ua ? `${br} · ${os}` : "Perangkat (info belum tersedia)", icon };
}

export default function NotifikasiPage() {
  const router = useRouter();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirmAsync();

  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [prefs, setPrefs] = useState<Prefs>({ muted_kinds: [], quiet_start: null, quiet_end: null });
  const [kinds, setKinds] = useState<{ key: string; label: string }[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [emailReady, setEmailReady] = useState(true);
  const [emailSetupNeeded, setEmailSetupNeeded] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [defaultReminder, setDefaultReminder] = useState("20:00");

  const [push, setPush] = useState<{ supported: boolean; permission: string; subscribed: boolean } | null>(null);
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async (before?: number) => {
    const res = await fetch(`/api/notifications?limit=40${before ? `&before=${before}` : ""}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      setItems((prev) => (before ? [...prev, ...data.data] : data.data));
      setUnread(data.unread || 0);
      setHasMore((data.data || []).length === 40);
      if (data.setup_needed) setSetupNeeded(true);
    }
    setLoading(false);
  }, []);

  const loadPrefs = useCallback(async () => {
    const res = await fetch("/api/notifications/prefs", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      setPrefs({ muted_kinds: data.prefs.muted_kinds || [], quiet_start: data.prefs.quiet_start, quiet_end: data.prefs.quiet_end });
      setEmail(data.prefs.email || "");
      setSavedEmail(data.prefs.email || "");
      setEmailReady(data.email_ready !== false);
      setEmailSetupNeeded(!!data.email_setup_needed);
      setKinds(data.kinds || []);
      setDevices(data.devices || []);
      if (data.setup_needed) setSetupNeeded(true);
    }
  }, []);

  const loadPush = useCallback(async () => {
    setPush(await getPushStatus());
    try {
      const reg = await navigator.serviceWorker?.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setThisEndpoint(sub?.endpoint || null);
    } catch {
      setThisEndpoint(null);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setDefaultReminder(localStorage.getItem("defaultReminder") || "20:00");
      } catch {}
      loadList();
      loadPrefs();
      loadPush();
    }, 0);
    return () => clearTimeout(t);
  }, [loadList, loadPrefs, loadPush]);

  const saveEmail = async (next: { email?: string }) => {
    setEmailBusy(true);
    const res = await fetch("/api/notifications/prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...prefs, ...next }),
    });
    const data = await res.json().catch(() => ({}));
    setEmailBusy(false);
    if (!data.success) {
      toast.error(data.message || "Gagal menyimpan email");
      return false;
    }
    if ("email" in next) {
      setSavedEmail(next.email || "");
      toast.success(next.email ? "Email disimpan" : "Email dihapus");
    }
    return true;
  };

  const testEmail = async () => {
    setEmailBusy(true);
    const res = await fetch("/api/notifications/email-test", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setEmailBusy(false);
    if (data.success) toast.success(data.message || "Email tes terkirim");
    else toast.error(data.message || "Gagal mengirim email tes");
  };

  const savePrefs = async (next: Prefs) => {
    setPrefs(next);
    setSaving(true);
    const res = await fetch("/api/notifications/prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!data.success) toast.error(data.message || "Gagal menyimpan pengaturan");
  };

  const toggleKind = (key: string) => {
    const muted = prefs.muted_kinds.includes(key) ? prefs.muted_kinds.filter((k) => k !== key) : [...prefs.muted_kinds, key];
    savePrefs({ ...prefs, muted_kinds: muted });
  };

  const quietOn = !!(prefs.quiet_start && prefs.quiet_end);

  const enableHere = async () => {
    setBusy(true);
    try {
      await registerPushSubscription();
      toast.success("Notifikasi di perangkat ini sudah aktif");
      await Promise.all([loadPush(), loadPrefs()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengaktifkan notifikasi");
    } finally {
      setBusy(false);
    }
  };

  const testHere = async () => {
    setBusy(true);
    const r = await sendTestPush();
    setBusy(false);
    if (r.success && (r.sent || 0) > 0) toast.success(`Notifikasi tes terkirim ke ${r.sent} perangkat kamu`);
    else toast.warning(r.message || "Belum ada perangkat aktif — aktifkan dulu di perangkat ini");
    loadList();
  };

  const disableHere = async () => {
    if (!(await confirm({ title: "Matikan notifikasi di perangkat ini?", message: "Riwayat tetap tersimpan, tapi perangkat ini tidak berbunyi lagi.", variant: "warning", confirmText: "Matikan" }))) return;
    await unregisterPushSubscription();
    toast.success("Notifikasi di perangkat ini dimatikan");
    loadPush();
    loadPrefs();
  };

  const removeDevice = async (d: Device) => {
    if (!(await confirm({ title: "Hapus perangkat ini?", message: "Perangkat tidak akan menerima notifikasi lagi sampai diaktifkan ulang.", variant: "danger", confirmText: "Hapus" }))) return;
    const res = await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id }),
    });
    if (res.ok) {
      toast.success("Perangkat dihapus");
      setDevices((list) => list.filter((x) => x.id !== d.id));
      loadPush();
    } else toast.error("Gagal menghapus perangkat");
  };

  const markAll = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    setItems((l) => l.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnread(0);
  };

  const clearAll = async () => {
    if (!(await confirm({ title: "Hapus semua riwayat notifikasi?", message: "Riwayat yang dihapus tidak bisa dikembalikan.", variant: "danger", confirmText: "Hapus semua" }))) return;
    await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    setItems([]);
    setUnread(0);
    toast.success("Riwayat notifikasi dihapus");
  };

  const openItem = (n: Notif) => {
    if (!n.read_at) {
      fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) });
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.url && n.url.startsWith("/")) router.push(n.url);
  };

  const shown = filter === "all" ? items : filter === "unread" ? items.filter((n) => !n.read_at) : items.filter((n) => n.kind === filter);
  const thisDeviceOn = !!push?.subscribed && push?.permission === "granted";

  const card = "bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm";

  return (
    <>
      <AdminHeader icon="fa-bell" title="Notifikasi" subtitle="Riwayat, perangkat, dan pengaturan notifikasi kamu" />
      {confirmDialog}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-4 md:px-8 py-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start [&>*]:min-w-0">
          {setupNeeded && (
            <div className="lg:col-span-2 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation"></i>
              Jalankan <span className="font-mono font-semibold">sql/012_notifications.sql</span> di Supabase supaya riwayat & pengaturan bisa disimpan.
            </div>
          )}

          {/* ── RIWAYAT ─────────────────────────────── */}
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left text-violet-600 dark:text-violet-400"></i>Riwayat
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{unread ? `${unread} belum dibaca` : "Semua sudah dibaca"}</p>
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAll} className="px-3 py-2 rounded-xl text-xs font-semibold bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-100">
                    <i className="fa-solid fa-check-double mr-1.5"></i>Tandai semua dibaca
                  </button>
                )}
                {items.length > 0 && (
                  <button onClick={clearAll} className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600">
                    <i className="fa-solid fa-trash-can mr-1.5"></i>Hapus semua
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 custom-scrollbar">
              {[{ key: "all", label: "Semua" }, { key: "unread", label: "Belum dibaca" }, ...Object.entries(KIND_STYLE).map(([key, v]) => ({ key, label: v.label }))].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    filter === f.key ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-slate-400"><i className="fa-solid fa-spinner fa-spin mr-2"></i>Memuat...</div>
            ) : shown.length === 0 ? (
              <div className="py-14 text-center">
                <i className="fa-regular fa-bell-slash text-2xl text-slate-300 dark:text-slate-600"></i>
                <p className="text-sm text-slate-500 mt-2">Tidak ada notifikasi di sini</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 -mx-2">
                {shown.map((n) => {
                  const st = KIND_STYLE[n.kind] || KIND_STYLE.sistem;
                  return (
                    <button key={n.id} onClick={() => openItem(n)} className={`w-full text-left px-2 py-3 flex items-start gap-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 ${n.read_at ? "" : "bg-violet-50/50 dark:bg-violet-500/5"}`}>
                      <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${st.cls}`}>
                        <i className={`fa-solid ${st.icon} text-sm`}></i>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className={`text-sm truncate ${n.read_at ? "font-medium text-slate-700 dark:text-slate-300" : "font-bold text-slate-900 dark:text-white"}`}>{n.title}</span>
                          {!n.read_at && <span className="w-2 h-2 shrink-0 rounded-full bg-violet-500"></span>}
                        </span>
                        {n.body && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.body}</span>}
                        <span className="block text-[11px] text-slate-400 mt-1">
                          {st.label} · {timeAgo(n.created_at)} · {new Date(n.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                      {n.url && n.url !== "/" && <i className="fa-solid fa-chevron-right text-xs text-slate-300 mt-3"></i>}
                    </button>
                  );
                })}
              </div>
            )}
            {hasMore && filter === "all" && (
              <button onClick={() => loadList(items[items.length - 1]?.id)} className="mt-3 w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200">
                Muat lebih banyak
              </button>
            )}
          </section>

          <div className="space-y-5">
            {/* ── PERANGKAT INI ─────────────────────── */}
            <section className={card}>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <i className="fa-solid fa-mobile-screen-button text-violet-600 dark:text-violet-400"></i>Perangkat ini
              </h3>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 px-3.5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifikasi HP / browser</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {!push ? "Memeriksa..." : !push.supported ? "Tidak didukung browser ini" : push.permission === "denied" ? "Diblokir di pengaturan browser" : thisDeviceOn ? "Aktif — perangkat ini akan berbunyi" : "Belum aktif"}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${thisDeviceOn ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
                  {thisDeviceOn ? "AKTIF" : "MATI"}
                </span>
              </div>
              {push && !push.supported && (
                <p className="text-xs text-slate-500 mt-2">Di iPhone: buka web ini di Safari → Bagikan → Tambahkan ke Layar Utama, lalu buka dari ikon tersebut.</p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-3">
                {!thisDeviceOn ? (
                  <button onClick={enableHere} disabled={busy || !push?.supported || push?.permission === "denied"} className="col-span-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50">
                    <i className="fa-solid fa-bell mr-2"></i>Aktifkan di perangkat ini
                  </button>
                ) : (
                  <>
                    <button onClick={testHere} disabled={busy} className="py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50">
                      <i className="fa-solid fa-paper-plane mr-2"></i>Tes
                    </button>
                    <button onClick={disableHere} className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200">
                      <i className="fa-solid fa-bell-slash mr-2"></i>Matikan
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* ── EMAIL ─────────────────────────────── */}
            <section className={card}>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <i className="fa-solid fa-envelope text-violet-600 dark:text-violet-400"></i>Email
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Notifikasi <b>penarikan saldo</b> juga dikirim ke email ini — request baru (owner) serta disetujui / ditolak (pemilik saldo).
                Matikan lewat toggle <b>Penarikan saldo</b> di Jenis notifikasi.
              </p>
              {emailSetupNeeded && (
                <p className="mb-3 text-xs rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2">
                  Jalankan <span className="font-mono">sql/013_email_notif.sql</span> di Supabase dulu.
                </p>
              )}
              {!emailReady && (
                <p className="mb-3 text-xs rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2">
                  Pengirim email belum diatur di server (SMTP_USER &amp; SMTP_PASS). Email belum akan terkirim.
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEmail({ email: email.trim() });
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1 min-w-0">
                  <i className="fa-regular fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="namakamu@gmail.com"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-200 outline-none focus:border-violet-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={emailBusy || email.trim() === savedEmail}
                  className="shrink-0 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Simpan
                </button>
              </form>
              {savedEmail && (
                <button
                  onClick={testEmail}
                  disabled={emailBusy || !emailReady}
                  className="mt-3 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50"
                >
                  {emailBusy ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-paper-plane mr-2"></i>}
                  Kirim email tes
                </button>
              )}
            </section>

            {/* ── PENGINGAT TUGAS KULIAH ────────────── */}
            <section className={card}>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <i className="fa-solid fa-book-open text-violet-600 dark:text-violet-400"></i>Pengingat tugas kuliah
              </h3>
              <p className="text-xs text-slate-500 mb-3">Jam pengingat harian bawaan saat membuat tugas baru (format 24 jam).</p>
              <div className="relative">
                <input
                  type="time"
                  value={defaultReminder}
                  onChange={(e) => {
                    setDefaultReminder(e.target.value);
                    try {
                      if (e.target.value) localStorage.setItem("defaultReminder", e.target.value);
                    } catch {}
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-200 outline-none focus:border-violet-500"
                />
              </div>
            </section>

            {/* ── JENIS NOTIFIKASI ──────────────────── */}
            <section className={card}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-sliders text-violet-600 dark:text-violet-400"></i>Jenis notifikasi
                </h3>
                {saving && <i className="fa-solid fa-spinner fa-spin text-xs text-slate-400"></i>}
              </div>
              <p className="text-xs text-slate-500 mb-3">Yang dimatikan tidak dikirim ke HP maupun email, tapi tetap masuk riwayat.</p>
              <div className="space-y-1.5">
                {kinds.map((k) => {
                  const on = !prefs.muted_kinds.includes(k.key);
                  const st = KIND_STYLE[k.key] || KIND_STYLE.sistem;
                  return (
                    <button key={k.key} onClick={() => toggleKind(k.key)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${st.cls}`}><i className={`fa-solid ${st.icon} text-xs`}></i></span>
                      <span className="flex-1 text-left text-sm font-medium text-slate-700 dark:text-slate-200">{k.label}</span>
                      <span className={`relative w-10 h-6 rounded-full transition ${on ? "bg-violet-600" : "bg-slate-300 dark:bg-slate-700"}`}>
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? "left-5" : "left-1"}`}></span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── JAM TENANG ────────────────────────── */}
            <section className={card}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-moon text-violet-600 dark:text-violet-400"></i>Jam tenang
                </h3>
                <button
                  onClick={() => savePrefs(quietOn ? { ...prefs, quiet_start: null, quiet_end: null } : { ...prefs, quiet_start: "23:00", quiet_end: "07:00" })}
                  className={`relative w-10 h-6 rounded-full transition ${quietOn ? "bg-violet-600" : "bg-slate-300 dark:bg-slate-700"}`}
                  aria-label="Jam tenang"
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${quietOn ? "left-5" : "left-1"}`}></span>
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">HP tidak berbunyi di jam ini (WIB). Notifikasi <b>Status bot</b> tetap berbunyi karena penting.</p>
              {quietOn && (
                <div className="grid grid-cols-2 gap-3">
                  {(["quiet_start", "quiet_end"] as const).map((f) => (
                    <label key={f} className="block">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{f === "quiet_start" ? "Mulai" : "Selesai"}</span>
                      <input
                        type="time"
                        value={prefs[f] || ""}
                        onChange={(e) => setPrefs({ ...prefs, [f]: e.target.value })}
                        onBlur={() => savePrefs(prefs)}
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-200 outline-none focus:border-violet-500"
                      />
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* ── PERANGKAT TERDAFTAR ───────────────── */}
            <section className={card}>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <i className="fa-solid fa-laptop-mobile text-violet-600 dark:text-violet-400"></i>Perangkat terdaftar
                <span className="text-xs font-semibold text-slate-400">({devices.length})</span>
              </h3>
              {devices.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada perangkat yang menerima notifikasi.</p>
              ) : (
                <div className="space-y-2">
                  {devices.map((d) => {
                    const info = describeDevice(d.user_agent);
                    const isThis = d.endpoint === thisEndpoint;
                    return (
                      <div key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                        <i className={`fa-solid ${info.icon} text-slate-400 w-5 text-center`}></i>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                            {info.label}
                            {isThis && <span className="ml-2 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[10px] font-bold">INI</span>}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {d.last_used_at ? `Terakhir menerima ${timeAgo(d.last_used_at)}` : d.created_at ? `Didaftarkan ${timeAgo(d.created_at)}` : "—"}
                          </p>
                        </div>
                        <button onClick={() => removeDevice(d)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Hapus perangkat">
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
