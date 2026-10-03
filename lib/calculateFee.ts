// lib/calculateFee.ts
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ══════════════════════════════════════════════════════════════
// CACHE — biar nggak query DB tiap request
// ══════════════════════════════════════════════════════════════
let feeCache: Record<string, number> = {};
let feeCacheTime = 0;
const CACHE_TTL_MS = 60_000; // 1 menit

async function loadFeeCache(): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("joki_fee_rules")
      .select("joki_name, fee_amount")
      .eq("is_active", true);

    if (error) {
      console.error("[calculateFee] Error load fee:", error.message);
      return;
    }

    feeCache = {};
    for (const row of data || []) {
      feeCache[row.joki_name.toLowerCase()] = row.fee_amount || 0;
    }
    feeCacheTime = Date.now();
  } catch (err) {
    console.error("[calculateFee] Exception:", err);
  }
}

async function getFeeForJoki(jokiName: string): Promise<number> {
  if (!jokiName) return 0;

  const now = Date.now();
  if (now - feeCacheTime > CACHE_TTL_MS) {
    await loadFeeCache();
  }

  // Fallback: kalau joki nggak ada di tabel, pake fee default Rp 500
  // KECUALI ellan (owner) — selalu 0
  const lower = jokiName.toLowerCase();
  if (lower === "ellan") return 0;
  
  return feeCache[lower] ?? 500;
}

// ══════════════════════════════════════════════════════════════
// MAIN HELPER
// ══════════════════════════════════════════════════════════════
export type FeeResult = {
  grossAmount: number;  // amount asli
  fee: number;          // potongan
  netAmount: number;    // amount setelah dipotong
};

export async function applyFee(
  jokiName: string,
  amount: number
): Promise<FeeResult> {
  const fee = await getFeeForJoki(jokiName);
  const netAmount = Math.max(0, amount - fee); // jangan minus

  return {
    grossAmount: amount,
    fee,
    netAmount,
  };
}