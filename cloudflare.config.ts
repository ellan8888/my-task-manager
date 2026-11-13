import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

// Rahasia (secret) web — nilainya diisi di dashboard Cloudflare: Worker → Settings → Variables and Secrets.
// Tidak dideklarasikan saat deploy supaya deploy pertama tidak gagal sebelum rahasia diisi;
// untuk uji lokal (CF_LOCAL_SECRETS=1) dideklarasikan supaya nilai dari .dev.vars terbaca.
const SECRETS = [
  "AUTH_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_KEY", "BOT_API_KEY",
  "CRON_SECRET", "BOT_API_URL", "RAM_TUNNEL_URL", "RAM_PASSWORD", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_NAME", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
  "START_QUEUE_WEBHOOK_URL", "PROGRESS_COMPLETE_WEBHOOK", "DISCORD_WEBHOOK_ORDER", "BOT_RESTART_URL",
  "BOT_RESTART_SECRET", "VZIIR0_HUB_KEY",
] as const;
const localSecrets = process.env.CF_LOCAL_SECRETS === "1"
  ? Object.fromEntries(SECRETS.map((k) => [k, bindings.secret()]))
  : {};

export default defineConfig({
  worker: defineWorker({
    name: "my-task-manager",
    // worker/index.ts meneruskan request ke vinext + menjalankan tugas terjadwal (cron)
    entrypoint: "./worker/index.ts",
    compatibilityDate: "2026-11-13",
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      ...localSecrets,
    },
    // Satu cron tiap menit — pembagian tugasnya ada di worker/index.ts
    triggers: [triggers.scheduled({ schedule: "* * * * *" })],
    observability: { enabled: true, redactQueryString: true },
    // Tanpa alamat preview acak per versi — hanya alamat utama yang bisa dibuka
    previewUrls: false,  // token di URL tidak ikut tercatat
  }),
});
