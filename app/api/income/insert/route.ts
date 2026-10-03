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
    // APPLY FEE
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
    // INSERT KE income_log — amount = NET aja
    // ══════════════════════════════════════════════════════════
    const { data: incomeData, error: incomeError } = await supabaseAdmin
      .from("income_log")
      .upsert(
        {
          order_id,
          joki_name: finalJokiName,
          product_title: product_title || "",
          amount: netAmount,
          completed_at: completed_at || new Date().toISOString(),
          buyer_name: buyer_name || null,
          roblox_username: roblox_username || null,
        },
        {
          onConflict: "order_id,roblox_username",
          ignoreDuplicates: true,
        }
      )
      .select("id")
      .maybeSingle();

    if (incomeError) {
      console.error("[Income Insert] Supabase error:", incomeError);
      return NextResponse.json(
        { success: false, message: incomeError.message },
        { status: 500 }
      );
    }

    // ══════════════════════════════════════════════════════════
    // INSERT KE income_fee_log (kalau ada fee)
    // ══════════════════════════════════════════════════════════
    if (fee > 0 && incomeData?.id) {
      const { error: feeError } = await supabaseAdmin
        .from("income_fee_log")
        .insert({
          income_log_id: incomeData.id,
          order_id,
          joki_name: finalJokiName,
          gross_amount: grossAmount,
          fee_amount: fee,
          net_amount: netAmount,
        });

      if (feeError) {
        console.error("[Income Insert] Fee log error:", feeError);
      }
    }

    // ══════════════════════════════════════════════════════════
    // RESPONSE — TANPA info fee
    // ══════════════════════════════════════════════════════════
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Income Insert] Exception:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}