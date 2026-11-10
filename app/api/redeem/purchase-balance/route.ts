// app/api/redeem/purchase-balance/route.ts — beli code Redfinger pakai saldo (user yang login).
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBalance } from "@/lib/ledger";
import { getSession } from "@/lib/auth";
import { PRICE_PER_CODE, claimCode, isRedeemOwner, releaseCode } from "@/lib/redeem";

export const runtime = "nodejs";

const PURCHASE_NOTE_PREFIX = "[BELI CODE] ";

const fail = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });

export async function POST(request: NextRequest) {
  try {
    // Identitas SELALU dari sesi login — username di isi request diabaikan
    const session = getSession(request);
    if (!session) return fail("Silakan login dulu", 401);
    const user = session.username.toLowerCase().trim();
    const isFree = isRedeemOwner(session);

    // 1. Cek saldo (owner gratis)
    if (!isFree) {
      const sisa = await getBalance(user);
      if (sisa < PRICE_PER_CODE) {
        return fail(`Saldo kamu Rp ${sisa.toLocaleString("id-ID")}, butuh Rp ${PRICE_PER_CODE.toLocaleString("id-ID")}`);
      }
    }

    // 2. Kunci 1 code (aman dari dobel ambil)
    const code = await claimCode(user, isFree ? "free_admin" : "balance");
    if (!code) return fail("Stock code kosong. Hubungi admin.");

    // 3. Catat pengeluaran (trigger buku kas memotong saldo)
    if (!isFree) {
      const { data: wdRow, error: wdErr } = await supabaseAdmin
        .from("withdrawals")
        .insert({
          joki_name: user,
          amount: PRICE_PER_CODE,
          note: `${PURCHASE_NOTE_PREFIX}${code.code}`,
          status: "approved",
          requested_by: user,
          approved_by: "system",
          approved_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (wdErr || !wdRow) {
        await releaseCode(code.id, code.prevUsername);
        return fail("Gagal nyatet pengeluaran: " + (wdErr?.message || "-"), 500);
      }

      // Dua pembelian bersamaan bisa sama-sama lolos cek saldo → cek ulang setelah tercatat
      const after = await getBalance(user);
      if (after < 0) {
        await supabaseAdmin.from("withdrawals").delete().eq("id", wdRow.id);
        await releaseCode(code.id, code.prevUsername);
        return fail("Saldo tidak cukup (ada pembelian lain yang sedang diproses).");
      }
    }

    // 4. Jejak audit
    await supabaseAdmin.from("redeem_purchases").insert({
      username: user,
      amount: isFree ? 0 : PRICE_PER_CODE,
      payment_method: isFree ? "free_admin" : "balance",
      status: "approved",
      code_id: code.id,
      approved_at: new Date().toISOString(),
      approved_by: isFree ? "system_free" : "system",
    });

    return NextResponse.json({ success: true, data: { code: code.code, is_free: isFree } });
  } catch (err: unknown) {
    return fail(err instanceof Error ? err.message : "Terjadi kesalahan", 500);
  }
}
