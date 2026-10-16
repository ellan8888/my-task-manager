// app/api/redeem/purchase-balance/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRICE_PER_CODE = 20000;
const OWNER_USERNAMES = ["ellan"];
const PURCHASE_NOTE_PREFIX = "[BELI CODE] ";

function isOwner(u: string | null) {
  return !!u && OWNER_USERNAMES.includes(u.toLowerCase());
}

export async function POST(request: Request) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json(
        { success: false, message: "username wajib" },
        { status: 400 }
      );
    }

    const user = username.toLowerCase().trim();
    const isFree = isOwner(user);

    // 1. Cek saldo (skip kalau owner)
    if (!isFree) {
      const { data: income } = await supabaseAdmin
        .from("income_log")
        .select("amount")
        .eq("joki_name", user);

      const totalIncome = (income || []).reduce(
        (s, r) => s + (r.amount || 0),
        0
      );

      const { data: wd } = await supabaseAdmin
        .from("withdrawals")
        .select("amount, status")
        .eq("joki_name", user)
        .in("status", ["approved", "pending"]);

      const totalWd = (wd || []).reduce((s, r) => s + (r.amount || 0), 0);
      const sisa = totalIncome - totalWd;

      if (sisa < PRICE_PER_CODE) {
        return NextResponse.json(
          {
            success: false,
            message: `Saldo kamu Rp ${sisa.toLocaleString("id-ID")}, butuh Rp 20.000`,
          },
          { status: 400 }
        );
      }
    }

    // 2. Ambil code RANDOM dari stock available
    let code: any = null;

    const { data: ownCode } = await supabaseAdmin
      .from("redeem_codes")
      .select("id, code")
      .eq("username", user)
      .eq("status", "available")
      .limit(1)
      .maybeSingle();

    if (ownCode) code = ownCode;

    if (!code) {
      const { data: anyCode } = await supabaseAdmin
        .from("redeem_codes")
        .select("id, code")
        .or(`username.is.null,username.eq.`)
        .eq("status", "available")
        .limit(1)
        .maybeSingle();

      if (anyCode) code = anyCode;
    }

    if (!code) {
      return NextResponse.json(
        { success: false, message: "Stock code kosong. Hubungi admin." },
        { status: 400 }
      );
    }

    // 3. ⭐ INSERT WITHDRAWAL DULU (biar saldo berkurang)
    let withdrawalId: number | null = null;

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

      if (wdErr) {
        console.error("[purchase-balance] Gagal insert withdrawal:", wdErr);
        return NextResponse.json(
          { success: false, message: "Gagal nyatet pengeluaran: " + wdErr.message },
          { status: 500 }
        );
      }

      withdrawalId = wdRow.id;
    }

    // 4. Update code → used, assign ke user
    const { error: err } = await supabaseAdmin
      .from("redeem_codes")
      .update({
        username: user,
        status: "used",
        payment_method: isFree ? "free_admin" : "balance",
        used_at: new Date().toISOString(),
      })
      .eq("id", code.id);

    if (err) {
      // ⚠️ Rollback: hapus withdrawal kalau update code gagal
      if (withdrawalId) {
        await supabaseAdmin.from("withdrawals").delete().eq("id", withdrawalId);
        console.warn("[purchase-balance] Rollback withdrawal id:", withdrawalId);
      }
      return NextResponse.json(
        { success: false, message: err.message },
        { status: 500 }
      );
    }

    // 5. Audit trail di redeem_purchases
    await supabaseAdmin.from("redeem_purchases").insert({
      username: user,
      amount: isFree ? 0 : PRICE_PER_CODE,
      payment_method: isFree ? "free_admin" : "balance",
      status: "approved",
      code_id: code.id,
      approved_at: new Date().toISOString(),
      approved_by: isFree ? "system_free" : "system",
    });

    return NextResponse.json({
      success: true,
      data: {
        code: code.code,
        is_free: isFree,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}