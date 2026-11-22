// lib/cronAuth.ts — memastikan route tugas terjadwal hanya dijalankan oleh penjadwal kita.
//
// Dua jalur yang sah:
//  1. Panggilan dari Cron Trigger Worker (worker/index.ts). Worker membuat token acak SEKALI
//     per isolate, menyimpannya di globalThis, dan mengirimnya di header x-internal-cron.
//     Route berjalan di isolate yang sama, jadi token bisa dicocokkan tanpa env apa pun,
//     dan orang luar tidak mungkin menebaknya (berubah tiap isolate baru).
//  2. Header "Authorization: Bearer <CRON_SECRET>" — untuk penjadwal luar / uji manual.
//     Hanya berlaku kalau CRON_SECRET benar-benar diisi.
export const INTERNAL_CRON_HEADER = "x-internal-cron";

type CronGlobal = { __internalCronToken?: string };

/** Dipanggil worker: ambil (atau buat) token isolate ini. */
export function internalCronToken(): string {
  const g = globalThis as CronGlobal;
  if (!g.__internalCronToken) g.__internalCronToken = crypto.randomUUID();
  return g.__internalCronToken;
}

/** true kalau request berasal dari penjadwal yang sah. */
export function isCronRequest(req: Request): boolean {
  const g = globalThis as CronGlobal;
  const internal = req.headers.get(INTERNAL_CRON_HEADER);
  if (internal && g.__internalCronToken && internal === g.__internalCronToken) return true;
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}
