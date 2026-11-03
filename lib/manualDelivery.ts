// lib/manualDelivery.ts — helper fitur Kirim Akun Manual (server only, SQL 011)
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Status yang masih berjalan (akunnya sedang "dipesan") */
export const ACTIVE_DELIVERY_STATUSES = ["pending", "processing", "failed", "finalize_failed"];

export type DeliveryAccount = {
  username: string;
  password?: string | null; // hanya akun baru
  kategori?: string | null;
  owner: string;
};

export type DeliveryRow = {
  id: number;
  order_id: string;
  detail_url: string | null;
  source: "stock" | "new";
  accounts: DeliveryAccount[];
  kategori: string | null;
  status: string;
  step: string | null;
  error: string | null;
  result: string | null;
  attempts: number;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
  done_at: string | null;
};

/** Username Roblox: 3–20 huruf/angka/underscore */
export const isRobloxUsername = (v: string) => /^[A-Za-z0-9_]{3,20}$/.test(v);

/** Hapus password sebelum dikirim ke browser */
export function publicDelivery(row: DeliveryRow) {
  return {
    ...row,
    accounts: (row.accounts || []).map((a) => ({ username: a.username, kategori: a.kategori ?? null, owner: a.owner })),
  };
}

/**
 * Setelah bot berhasil mengirim chat & mencatat pendapatan:
 *  - akun stok  → ditandai laku (logged_out) untuk order ini
 *  - akun baru  → dibuat di accounts_stock langsung sebagai akun laku
 * Aman diulang (idempotent).
 */
export async function finalizeDelivery(row: DeliveryRow): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();

  for (const acc of row.accounts || []) {
    const { data: existing, error: getErr } = await supabaseAdmin
      .from("accounts_stock")
      .select("id")
      .ilike("username", acc.username)
      .maybeSingle();
    if (getErr) return { ok: false, error: `Gagal cek ${acc.username}: ${getErr.message}` };

    if (existing) {
      const { error } = await supabaseAdmin
        .from("accounts_stock")
        .update({ logged_out: true, logged_out_at: now, used_order_id: row.order_id, updated_at: now })
        .eq("id", existing.id);
      if (error) return { ok: false, error: `Gagal tandai ${acc.username} laku: ${error.message}` };
      continue;
    }

    if (row.source !== "new") return { ok: false, error: `Akun stok ${acc.username} tidak ditemukan lagi` };

    const { error } = await supabaseAdmin.from("accounts_stock").insert({
      username: acc.username,
      password: acc.password || null,
      kategori: acc.kategori || row.kategori || "akun",
      added_by: acc.owner,
      used: true,
      used_at: now,
      logged_out: true,
      logged_out_at: now,
      idle: false,
      deleted: false,
      status: "listed",
      used_order_id: row.order_id,
    });
    if (error) return { ok: false, error: `Gagal simpan akun baru ${acc.username}: ${error.message}` };
  }
  return { ok: true };
}
