// app/api/income/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // ⭐ Cek bot API key
    const botApiKey = req.headers.get("x-bot-api-key");
    if (botApiKey !== process.env.BOT_API_KEY) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const order_id = searchParams.get("order_id");
    const roblox_username = searchParams.get("roblox_username");

    if (!order_id || !roblox_username) {
      return NextResponse.json(
        { success: false, message: "order_id & roblox_username wajib" },
        { status: 400 }
      );
    }

    // ⭐ Ambil income_log + fee log (kalau ada)
    const { data, error } = await supabase
      .from("income_log")
      .select("id, amount, joki_name, order_id, roblox_username")
      .eq("order_id", order_id)
      .eq("roblox_username", roblox_username)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Kalau nggak ada → exists: false
    if (!data) {
      return NextResponse.json({
        success: true,
        exists: false,
      });
    }

    // ⭐ Ambil fee log biar dapet gross + fee + percent
    const { data: feeLog } = await supabase
      .from("income_fee_log")
      .select("gross_amount, fee_amount, net_amount, fee_percent")
      .eq("income_log_id", data.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      exists: true,
      data: {
        order_id: data.order_id,
        joki_name: data.joki_name,
        roblox_username: data.roblox_username,
        gross_amount: feeLog?.gross_amount ?? data.amount,
        fee: feeLog?.fee_amount ?? 0,
        net_amount: data.amount,
        fee_percent: feeLog?.fee_percent ?? 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}