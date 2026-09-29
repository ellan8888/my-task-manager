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

    const { data, error } = await supabase
      .from("income_log")
      .select("id")
      .eq("order_id", order_id)
      .eq("roblox_username", roblox_username)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      exists: !!data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}