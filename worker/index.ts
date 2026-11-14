// worker/index.ts — pintu masuk Worker Cloudflare.
// • fetch     → semua halaman & API web (vinext)
// • scheduled → pengganti cron Vercel + layanan cron luar. Satu Cron Trigger tiap menit,
//               lalu dibagi di sini supaya jadwal semua tugas ada di satu tempat.
import handler from "vinext/server/fetch-handler";

type Ctx = { waitUntil(p: Promise<unknown>): void; passThroughOnException?(): void };
type Env = Record<string, unknown> & { CRON_SECRET?: string };

// Jadwal tugas (menit/jam dalam UTC; WIB = UTC+7)
const JOBS: { path: string; when: (d: Date) => boolean; auth?: boolean }[] = [
  // Pengingat tugas & notifikasi jokian selesai — tiap menit
  { path: "/api/reminder", when: () => true },
  // Bot offline / macet — tiap 5 menit
  { path: "/api/cron/check-bot", when: (d) => d.getUTCMinutes() % 5 === 0, auth: true },
  // Egg yang belum punya order — tiap 5 menit (geser 2 menit supaya tidak bareng)
  { path: "/api/cron/reclaim-eggs", when: (d) => d.getUTCMinutes() % 5 === 2, auth: true },
  // Code Redfinger yang sudah dibeli > 2 hari — tiap jam (menit ke-12)
  { path: "/api/cron/cleanup-redeem-codes", when: (d) => d.getUTCMinutes() === 12, auth: true },
  // Hapus log egg lama — tiap hari 03:00 UTC (10:00 WIB), sama seperti di Vercel
  { path: "/api/cron/cleanup-eggs", when: (d) => d.getUTCHours() === 3 && d.getUTCMinutes() === 0, auth: true },
  // Ringkasan tugas harian ke Telegram — 07:00 WIB (route-nya sendiri menjaga sekali sehari)
  { path: "/api/telegram", when: (d) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0 },
];

export default {
  fetch(request: Request, env: Env, ctx: Ctx) {
    return handler.fetch(request, env, ctx);
  },

  async scheduled(controller: { scheduledTime: number; cron: string }, env: Env, ctx: Ctx) {
    const now = new Date(controller.scheduledTime);
    const due = JOBS.filter((j) => j.when(now));
    await Promise.all(
      due.map(async (job) => {
        const headers = new Headers({ "user-agent": "cloudflare-cron" });
        if (job.auth && env.CRON_SECRET) headers.set("authorization", `Bearer ${env.CRON_SECRET}`);
        try {
          const res = await handler.fetch(new Request(`https://cron.internal${job.path}`, { headers }), env, ctx);
          if (!res.ok) console.error(`[cron] ${job.path} → HTTP ${res.status}`);
          await res.body?.cancel();
        } catch (e) {
          console.error(`[cron] ${job.path} gagal:`, e);
        }
      })
    );
  },
};
