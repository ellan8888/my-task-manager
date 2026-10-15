// app/api/redeem/buy-with-balance/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRICE_PER_CODE = 20000;

// ⭐ Owner yang bisa ambil code gratis
const OWNER_USERNAMES = ["ellan"];
function isOwner(username: string | null) {
  return !!username && OWNER_USERNAMES.includes(username.toLowerCase());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, message: "username wajib" },
        { status: 400 }
      );
    }

    const isFreeAdmin = isOwner(username);

    // ═══════════════════════════════════════════════════════
    // 1. Cek saldo user (SKIP kalo owner)
    // ═══════════════════════════════════════════════════════
    if (!isFreeAdmin) {
      const { data: incomeData } = await supabaseAdmin
        .from("income_log")
        .select("amount")
        .eq("joki_name", username);

      const totalIncome = (incomeData || []).reduce(
        (sum, row) => sum + (row.amount || 0),
        0
      );

      const { data: withdrawData } = await supabaseAdmin
        .from("withdrawals")
        .select("amount, status")
        .eq("joki_name", username)
        .in("status", ["approved", "pending"]);

      const totalWithdrawn = (withdrawData || []).reduce(
        (sum, row) => sum + (row.amount || 0),
        0
      );

      const sisa = totalIncome - totalWithdrawn;

      if (sisa < PRICE_PER_CODE) {
        return NextResponse.json(
          {
            success: false,
            message: `Saldo kamu cuma Rp ${sisa.toLocaleString("id-ID")}, butuh Rp 20.000`,
          },
          { status: 400 }
        );
      }
    } else {
      console.log(`👑 [Redeem] Owner ${username} ambil code GRATIS`);
    }

    // ═══════════════════════════════════════════════════════
    // 2. Ambil 1 code yang available
    //    ⭐ Prioritas: code yang udah di-assign ke user ini dulu.
    //    Kalo nggak ada, owner bisa ambil code apa aja yang available.
    // ═══════════════════════════════════════════════════════
    let code: { id: number; code: string } | null = null;

    // Prioritas 1: code yang di-assign ke username ini
    const { data: ownCode } = await supabaseAdmin
      .from("redeem_codes")
      .select("id, code")
      .eq("username", username)
      .eq("status", "available")
      .limit(1)
      .maybeSingle();

    if (ownCode) {
      code = ownCode;
    } else if (isFreeAdmin) {
      // ⭐ Owner bisa ambil code apa aja yang available
      const { data: anyCode } = await supabaseAdmin
        .from("redeem_codes")
        .select("id, code")
        .eq("status", "available")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (anyCode) code = anyCode;
    }

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message: isFreeAdmin
            ? "Stok code kosong. Tambahin code dulu di /admin/redeem-admin."
            : "Nggak ada code available buat kamu. Hubungi admin.",
        },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════
    // 3. Update code jadi "used" + catat pembelian
    // ═══════════════════════════════════════════════════════
    const { error: codeError } = await supabaseAdmin
      .from("redeem_codes")
      .update({
        status: "used",
        payment_method: isFreeAdmin ? "free_admin" : "balance",
        username: username.toLowerCase().trim(), // ⭐ Pastiin owner code-nya ke-assign ke dia
        used_at: new Date().toISOString(),
      })
      .eq("id", code.id);

    if (codeError) {
      return NextResponse.json(
        { success: false, message: codeError.message },
        { status: 500 }
      );
    }

    // Catat di redeem_purchases
    await supabaseAdmin.from("redeem_purchases").insert({
      username: username.toLowerCase().trim(),
      amount: isFreeAdmin ? 0 : PRICE_PER_CODE, // ⭐ Owner: amount 0
      payment_method: isFreeAdmin ? "free_admin" : "balance",
      status: "approved",
      code_id: code.id,
      approved_at: new Date().toISOString(),
      approved_by: isFreeAdmin ? "system_free_admin" : "system",
      notes: isFreeAdmin ? "Owner free access" : null,
    });

    return NextResponse.json({
      success: true,
      data: {
        code: code.code,
        is_free_admin: isFreeAdmin,
        message: isFreeAdmin
          ? "👑 Owner ambil code GRATIS: " + code.code
          : "Pembelian berhasil! Code kamu: " + code.code,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}