// lib/calculateFee.ts
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ══════════════════════════════════════════════════════════════
// CACHE — biar nggak query DB tiap request
// ══════════════════════════════════════════════════════════════
let feeCache: Record<string, number> = {}; // joki_name → fee_percent
let feeCacheTime = 0;
const CACHE_TTL_MS = 60_000; // 1 menit

// ⭐ Default fee — kalau joki nggak ada di tabel
const DEFAULT_FEE_PERCENT = 4;

async function loadFeeCache(): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("joki_fee_rules")
      .select("joki_name, fee_percent")
      .eq("is_active", true);

    if (error) {
      console.error("[calculateFee] Error load fee:", error.message);
      return;
    }

    feeCache = {};
    for (const row of data || []) {
      feeCache[row.joki_name.toLowerCase()] = Number(row.fee_percent) || 0;
    }
    feeCacheTime = Date.now();

    console.log(
      `[calculateFee] Fee cache loaded:`,
      Object.entries(feeCache)
        .map(([k, v]) => `${k}=${v}%`)
        .join(", ")
    );
  } catch (err) {
    console.error("[calculateFee] Exception:", err);
  }
}

async function getFeePercentForJoki(jokiName: string): Promise<number> {
  if (!jokiName) return 0;

  const now = Date.now();
  if (now - feeCacheTime > CACHE_TTL_MS) {
    await loadFeeCache();
  }

  const lower = jokiName.toLowerCase();

  // ⭐ Owner (ellan) selalu 0%
  if (lower === "ellan") return 0;

  // ⭐ Fallback: kalau joki nggak ada di tabel, pake default 4%
  return feeCache[lower] ?? DEFAULT_FEE_PERCENT;
}

// ══════════════════════════════════════════════════════════════
// MAIN HELPER
// ══════════════════════════════════════════════════════════════
export type FeeResult = {
  grossAmount: number;  // amount asli
  fee: number;          // potongan (dalam Rupiah)
  netAmount: number;    // amount setelah dipotong
  feePercent: number;   // persen yang dipakai (buat audit)
};

export async function applyFee(
  jokiName: string,
  amount: number
): Promise<FeeResult> {
  const feePercent = await getFeePercentForJoki(jokiName);

  // Hitung fee — pembulatan ke integer (Rupiah)
  const fee = Math.round((amount * feePercent) / 100);
  const netAmount = Math.max(0, amount - fee);

  return {
    grossAmount: amount,
    fee,
    netAmount,
    feePercent,
  };
}