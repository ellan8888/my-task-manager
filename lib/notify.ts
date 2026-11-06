// lib/notify.ts — satu-satunya pintu kirim notifikasi (khusus server)
//
//   await notify({ to: "ellan", title: "Akun Laku", body: "...", url: "/admin/akun-laku", kind: "akun_laku" })
//
// Yang dilakukan:
//   1. Simpan ke riwayat (ikon lonceng di My Task) — selalu, walau push gagal / dibisukan.
//   2. Cek pengaturan user: jenis yang dibisukan & jam tenang → push dilewati (riwayat tetap ada).
//   3. Kirim push ke semua perangkat user SEKALIGUS (paralel), hapus perangkat yang sudah mati.
// Emoji di judul/isi dibuang (aturan tampilan My Task: pakai ikon, bukan emoji).
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const NOTIFY_KINDS = ["akun_laku", "penarikan", "transfer", "joki", "bot", "reminder", "sistem"] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];

export const KIND_LABEL: Record<NotifyKind, string> = {
  akun_laku: "Akun laku",
  penarikan: "Penarikan saldo",
  transfer: "Transfer & redeem",
  joki: "Order jokian",
  bot: "Status bot",
  reminder: "Pengingat task",
  sistem: "Lainnya",
};

/** Jenis penting: tetap bunyi walau jam tenang (tapi tetap bisa dibisukan manual) */
const CRITICAL_KINDS: NotifyKind[] = ["bot"];

type Sub = { id?: number; endpoint: string; p256dh: string; auth: string; username: string | null };

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.error("[notify] VAPID key belum diatur di environment");
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  vapidReady = true;
  return true;
}

/** Buang emoji & simbol gambar, rapikan spasi */
export function stripEmoji(text: string) {
  return (text || "")
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Tebak jenis notifikasi dari judul (untuk pemanggil lama / bot yang belum kirim `kind`) */
export function guessKind(title: string, url?: string): NotifyKind {
  const t = `${title} ${url || ""}`.toLowerCase();
  if (/akun laku|akun-laku|terjual/.test(t)) return "akun_laku";
  if (/penarikan|withdraw|tarik/.test(t)) return "penarikan";
  if (/transfer|redeem/.test(t)) return "transfer";
  if (/bot/.test(t)) return "bot";
  if (/joki|order|progress|antrian|antrean/.test(t)) return "joki";
  if (/reminder|deadline|task/.test(t)) return "reminder";
  return "sistem";
}

function wibMinutes(d = new Date()) {
  const wib = new Date(d.getTime() + 7 * 3600_000);
  return wib.getUTCHours() * 60 + wib.getUTCMinutes();
}
function toMinutes(hhmm?: string | null) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export function inQuietHours(start?: string | null, end?: string | null, now = new Date()) {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null || s === e) return false;
  const n = wibMinutes(now);
  return s < e ? n >= s && n < e : n >= s || n < e; // lewat tengah malam
}

export type NotifyInput = {
  /** username, daftar username, atau "all" (semua user) */
  to: string | string[] | "all";
  title: string;
  body?: string;
  url?: string;
  kind?: NotifyKind;
  /** abaikan bisu & jam tenang (mis. tes notifikasi) */
  force?: boolean;
};

export type NotifyResult = { recipients: number; stored: number; sent: number; failed: number; skipped: number };

async function resolveRecipients(to: NotifyInput["to"]) {
  if (to === "all") {
    const { data } = await supabaseAdmin.from("users").select("username");
    return [...new Set((data || []).map((u) => String(u.username || "").toLowerCase()).filter(Boolean))];
  }
  const list = Array.isArray(to) ? to : [to];
  return [...new Set(list.map((u) => String(u || "").toLowerCase().trim()).filter(Boolean))];
}

export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const result: NotifyResult = { recipients: 0, stored: 0, sent: 0, failed: 0, skipped: 0 };
  const title = stripEmoji(input.title) || "My Task Manager";
  const body = stripEmoji(input.body || "");
  const url = input.url || "/";
  const kind: NotifyKind = input.kind && NOTIFY_KINDS.includes(input.kind) ? input.kind : guessKind(input.title, url);

  const users = await resolveRecipients(input.to);
  result.recipients = users.length;
  if (!users.length) return result;

  // 1. Riwayat (tabel boleh belum ada → lewati diam-diam)
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("notifications")
    .insert(users.map((username) => ({ username, kind, title, body: body || null, url })))
    .select("id");
  if (insErr) {
    if (!/notifications/i.test(insErr.message)) console.error("[notify] Gagal simpan riwayat:", insErr.message);
  } else {
    result.stored = inserted?.length || 0;
  }

  // 2. Pengaturan
  const { data: prefs } = await supabaseAdmin
    .from("notification_prefs")
    .select("username, muted_kinds, quiet_start, quiet_end")
    .in("username", users);
  const prefMap = new Map((prefs || []).map((p) => [String(p.username).toLowerCase(), p]));
  const pushTo = users.filter((u) => {
    if (input.force) return true;
    const p = prefMap.get(u);
    if (!p) return true;
    if ((p.muted_kinds || []).includes(kind)) return false;
    if (!CRITICAL_KINDS.includes(kind) && inQuietHours(p.quiet_start, p.quiet_end)) return false;
    return true;
  });
  result.skipped = users.length - pushTo.length;
  if (!pushTo.length || !ensureVapid()) return result;

  // 3. Push paralel ke semua perangkat
  const { data: subs, error: subErr } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, username")
    .in("username", pushTo);
  if (subErr || !subs?.length) return result;

  // angka belum dibaca per user → ditampilkan di notifikasi
  const unread = new Map<string, number>();
  await Promise.all(
    pushTo.map(async (u) => {
      const { count } = await supabaseAdmin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("username", u)
        .is("read_at", null);
      unread.set(u, count || 0);
    })
  );

  const dead: string[] = [];
  const used: string[] = [];
  const outcomes = await Promise.allSettled(
    (subs as Sub[]).map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title,
            body,
            url,
            kind,
            tag: kind,
            unread: unread.get(String(s.username || "").toLowerCase()) || 0,
            ts: Date.now(),
            icon: "/icon-192.png",
            badge: "/icon-192.png",
          }),
          { TTL: 60 * 60 * 24 }
        )
        .then(() => used.push(s.endpoint))
        .catch((err: { statusCode?: number; body?: string; message?: string }) => {
          // 404/410 = perangkat sudah berhenti langganan → hapus
          if (err.statusCode === 404 || err.statusCode === 410) dead.push(s.endpoint);
          console.error(`[notify] Push gagal (${s.username}):`, err.statusCode, err.body || err.message);
          throw err;
        })
    )
  );
  result.sent = outcomes.filter((o) => o.status === "fulfilled").length;
  result.failed = outcomes.length - result.sent;

  if (dead.length) await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", dead);
  if (used.length) {
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .in("endpoint", used)
      .then(() => null, () => null);
  }
  return result;
}
