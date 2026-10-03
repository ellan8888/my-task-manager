// app/api/income/insert/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyFee } from "@/lib/calculateFee";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      order_id,
      joki_name,
      product_title,
      amount,
      completed_at,
      buyer_name,
      roblox_username,
    } = body;

    // ══════════════════════════════════════════════════════════
    // VALIDASI
    // ══════════════════════════════════════════════════════════
    if (!order_id || typeof amount !== "number") {
      return NextResponse.json(
        { success: false, message: "order_id & amount wajib" },
        { status: 400 }
      );
    }

    if (amount < 0) {
      return NextResponse.json(
        { success: false, message: "amount nggak boleh negatif" },
        { status: 400 }
      );
    }

    // ══════════════════════════════════════════════════════════
    // APPLY FEE — potong Rp 500 kalau bukan ellan
    // ══════════════════════════════════════════════════════════
    const finalJokiName = joki_name || "ellan";
    const { grossAmount, fee, netAmount } = await applyFee(
      finalJokiName,
      amount
    );

    console.log(
      `💰 [Income Insert] order=${order_id} joki=${finalJokiName} ` +
      `gross=Rp ${grossAmount.toLocaleString("id-ID")} ` +
      `fee=Rp ${fee.toLocaleString("id-ID")} ` +
      `net=Rp ${netAmount.toLocaleString("id-ID")}`
    );

    // ══════════════════════════════════════════════════════════
    // UPSERT — dengan composite unique (order_id + roblox_username)
    // ══════════════════════════════════════════════════════════
    const { error } = await supabaseAdmin
      .from("income_log")
      .upsert(
        {
          order_id,
          joki_name: finalJokiName,
          product_title: product_title || "",
          amount: netAmount,              // ⭐ NET (setelah fee)
          gross_amount: grossAmount,      // ⭐ GROSS (asli, buat audit)
          fee,                            // ⭐ FEE (buat audit)
          completed_at: completed_at || new Date().toISOString(),
          buyer_name: buyer_name || null,
          roblox_username: roblox_username || null,
        },
        {
          onConflict: "order_id,roblox_username",
          ignoreDuplicates: true,
        }
      );

    if (error) {
      console.error("[Income Insert] Supabase error:", error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id,
        joki_name: finalJokiName,
        gross_amount: grossAmount,
        fee,
        net_amount: netAmount,
      },
    });
  } catch (err: any) {
    console.error("[Income Insert] Exception:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}