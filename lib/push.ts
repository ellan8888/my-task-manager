// lib/push.ts — daftarkan perangkat ini untuk menerima notifikasi (dipakai di browser)
// Data perangkat dikirim ke server lewat /api/push/subscribe (wajib login) — tidak lagi ditulis
// langsung ke database dari browser.

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing || navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Status perangkat ini: izin browser & apakah sudah terdaftar */
export async function getPushStatus(): Promise<{ supported: boolean; permission: NotificationPermission | "unsupported"; subscribed: boolean }> {
  if (!pushSupported()) return { supported: false, permission: "unsupported", subscribed: false };
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return { supported: true, permission: Notification.permission, subscribed: !!sub };
  } catch {
    return { supported: true, permission: Notification.permission, subscribed: false };
  }
}

/**
 * Minta izin (kalau belum), daftarkan perangkat, lalu simpan ke server atas nama user yang login.
 * Parameter username dibiarkan demi kompatibilitas — server memakai user dari sesi login.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function registerPushSubscription(_username?: string) {
  if (!pushSupported()) throw new Error("Browser ini tidak mendukung notifikasi push.");

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Izin notifikasi ditolak. Aktifkan dari pengaturan browser.");

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY belum diatur.");

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(sub.toJSON()),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.message || "Gagal menyimpan perangkat");
  return sub;
}

/** Berhenti menerima notifikasi di perangkat ini */
export async function unregisterPushSubscription() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => null);
  await sub.unsubscribe().catch(() => null);
}

/** Kirim notifikasi tes ke perangkat milik user yang login */
export async function sendTestPush() {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ test: true }),
  });
  return (await res.json().catch(() => ({}))) as { success?: boolean; sent?: number; failed?: number; message?: string };
}
