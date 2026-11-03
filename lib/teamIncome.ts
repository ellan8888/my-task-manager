// lib/teamIncome.ts — helper halaman Pendapatan Tim (server only)
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyFee } from "@/lib/calculateFee";

/** Anggota tim yang selalu ditampilkan walaupun belum ada pendapatan */
export const TEAM = ["ellan", "rizki", "ridho"];

/**
 * Normalisasi input nomor order:
 *  "OD000000167663006 (ID)" → "OD000000167663006"
 *  "167663006"              → "OD000000167663006"
 */
export function normalizeOrderInput(raw: string): string {
  const v = raw.replace(/\s*\([A-Z]{2}\)\s*$/i, "").replace(/[#\s]/g, "").toUpperCase();
  if (/^\d+$/.test(v)) return `OD${v.padStart(15, "0")}`;
  return v;
}

/** Ambil semua baris (menembus batas 1000 baris Supabase) */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  max = 20000
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

/**
 * Catat pendapatan satu order (logika sama dengan /api/income/insert):
 * amount di income_log = NET, potongan dicatat di income_fee_log.
 */
export async function recordIncome(params: {
  order_id: string;
  joki_name: string;
  product_title: string | null;
  amount: number;
  completed_at: string | null;
  roblox_username: string | null;
  buyer_name: string | null;
}) {
  const { data: existing } = await supabaseAdmin
    .from("income_log")
    .select("id")
    .eq("order_id", params.order_id)
    .eq("roblox_username", params.roblox_username || "")
    .maybeSingle();
  if (existing) return { already: true };

  const joki = (params.joki_name || "ellan").toLowerCase();
  const { grossAmount, fee, netAmount, feePercent } = await applyFee(joki, params.amount);

  const { data: inc, error } = await supabaseAdmin
    .from("income_log")
    .upsert(
      {
        order_id: params.order_id,
        joki_name: joki,
        product_title: params.product_title || "",
        amount: netAmount,
        completed_at: params.completed_at || new Date().toISOString(),
        buyer_name: params.buyer_name || null,
        roblox_username: params.roblox_username || null,
      },
      { onConflict: "order_id,roblox_username", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (fee > 0 && inc?.id) {
    await supabaseAdmin.from("income_fee_log").insert({
      income_log_id: inc.id,
      order_id: params.order_id,
      joki_name: joki,
      gross_amount: grossAmount,
      fee_amount: fee,
      net_amount: netAmount,
      fee_percent: feePercent,
    });
  }
  return { already: false, net: netAmount, gross: grossAmount, fee };
}
