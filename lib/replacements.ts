// lib/replacements.ts — helper fitur Ganti Akun (server only)
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyFee } from "@/lib/calculateFee";
import type { Session } from "@/lib/auth";

/** Status yang dianggap masih berjalan (akun pengganti sedang "dipesan") */
export const ACTIVE_STATUSES = ["pending", "processing", "failed", "finalize_failed"];

export const isEllan = (s: Session | null) => s?.username?.toLowerCase() === "ellan";

/** "OD000000167663006 (ID)" → "OD000000167663006" */
export const cleanOrderId = (v: string) => v.replace(/\s*\([A-Z]{2}\)\s*$/i, "").trim().toUpperCase();

/** Link rincian order Itemku dari nomor order: OD000000167663006 → .../rincian/167663006 */
export function orderDetailUrl(orderId: string): string | null {
  const m = cleanOrderId(orderId).match(/^OD0*(\d+)$/i);
  return m ? `https://tokoku.itemku.com/riwayat-pesanan/rincian/${m[1]}` : null;
}

export type ReplacementRow = {
  id: number;
  order_id: string;
  detail_url: string | null;
  kategori: string | null;
  old_username: string;
  old_added_by: string | null;
  new_username: string;
  new_added_by: string | null;
  status: string;
  step: string | null;
  error: string | null;
  note: string | null;
  attempts: number;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
  done_at: string | null;
};

/**
 * Selesaikan data setelah bot berhasil mengirim akun pengganti ke pembeli:
 *  1. akun pengganti ditandai laku (logged_out)
 *  2. pendapatan order dipindah ke pemilik akun pengganti + fee dihitung ulang
 *  3. akun bermasalah dihapus permanen dari stok
 * Aman diulang (idempotent).
 */
export async function finalizeReplacement(rep: ReplacementRow): Promise<{ ok: boolean; note?: string; error?: string }> {
  const notes: string[] = [];
  const now = new Date().toISOString();

  // 1. Akun pengganti → laku
  const { error: newErr } = await supabaseAdmin
    .from("accounts_stock")
    .update({ logged_out: true, logged_out_at: now, used_order_id: rep.order_id })
    .eq("username", rep.new_username);
  if (newErr) return { ok: false, error: `Gagal tandai akun pengganti laku: ${newErr.message}` };

  // 2. Pindahkan pendapatan
  const { data: incomeRows, error: incErr } = await supabaseAdmin
    .from("income_log")
    .select("id, amount, joki_name, roblox_username")
    .eq("order_id", rep.order_id)
    .in("roblox_username", [rep.old_username, rep.new_username]);
  if (incErr) return { ok: false, error: `Gagal baca pendapatan: ${incErr.message}` };

  const already = (incomeRows || []).find((r) => r.roblox_username === rep.new_username);
  const income = (incomeRows || []).find((r) => r.roblox_username === rep.old_username);

  if (already) {
    notes.push("Pendapatan sudah atas akun pengganti");
  } else if (!income) {
    notes.push("Pendapatan order ini tidak ditemukan — fee tidak dipindah");
  } else {
    const { data: feeLog } = await supabaseAdmin
      .from("income_fee_log")
      .select("gross_amount")
      .eq("income_log_id", income.id)
      .maybeSingle();

    const gross = Number(feeLog?.gross_amount ?? income.amount) || 0;
    const newOwner = rep.new_added_by || "ellan";
    const { fee, netAmount, feePercent } = await applyFee(newOwner, gross);

    const { error: updErr } = await supabaseAdmin
      .from("income_log")
      .update({ joki_name: newOwner, roblox_username: rep.new_username, amount: netAmount })
      .eq("id", income.id);
    if (updErr) return { ok: false, error: `Gagal pindah pendapatan: ${updErr.message}` };

    await supabaseAdmin.from("income_fee_log").delete().eq("income_log_id", income.id);
    if (fee > 0) {
      const { error: feeErr } = await supabaseAdmin.from("income_fee_log").insert({
        income_log_id: income.id,
        order_id: rep.order_id,
        joki_name: newOwner,
        gross_amount: gross,
        fee_amount: fee,
        net_amount: netAmount,
        fee_percent: feePercent,
      });
      if (feeErr) notes.push(`Fee log gagal dicatat: ${feeErr.message}`);
    }
    notes.push(`Pendapatan dipindah ${income.joki_name || "-"} → ${newOwner}`);
  }

  // 3. Hapus permanen akun bermasalah
  const { error: delErr } = await supabaseAdmin.from("accounts_stock").delete().eq("username", rep.old_username);
  if (delErr) return { ok: false, error: `Gagal hapus akun bermasalah: ${delErr.message}` };

  return { ok: true, note: notes.join(" · ") || undefined };
}
