// app/api/redeem/purchase-balance/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRICE_PER_CODE = 20000;
const OWNER_USERNAMES = ["ellan"];

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

    // ═══════════════════════════════════════════════════════
    // 1. Cek saldo (skip kalo owner)
    // ═══════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════
    // 2. Ambil code RANDOM dari stock available
    //    Prioritas: code yang di-assign ke user ini dulu,
    //    terus kalo nggak ada, ambil code kosong (username null)
    // ═══════════════════════════════════════════════════════
    let code: any = null;

    // Prioritas 1: code khusus user ini (username = user)
    const { data: ownCode } = await supabaseAdmin
      .from("redeem_codes")
      .select("id, code")
      .eq("username", user)
      .eq("status", "available")
      .limit(1)
      .maybeSingle();

    if (ownCode) code = ownCode;

    // Prioritas 2: code kosong (username null / '')
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

    // ═══════════════════════════════════════════════════════
    // 3. Update code → used, assign ke user
    // ═══════════════════════════════════════════════════════
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
      return NextResponse.json(
        { success: false, message: err.message },
        { status: 500 }
      );
    }

    // Audit trail
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