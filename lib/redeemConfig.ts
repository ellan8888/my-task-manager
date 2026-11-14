// lib/redeemConfig.ts — pengaturan code Redfinger yang aman dipakai di server maupun halaman.

/** Code yang sudah dibeli disimpan 2 hari, lalu dihapus otomatis (cron cleanup-redeem-codes).
 *  Jejak pembelian tetap ada di redeem_purchases, penarikan & Riwayat Saldo. */
export const CODE_KEEP_HOURS = 48;

export const codeExpiryCutoff = (now = Date.now()) => new Date(now - CODE_KEEP_HOURS * 3600_000).toISOString();
