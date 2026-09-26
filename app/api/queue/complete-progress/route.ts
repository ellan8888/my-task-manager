// app/api/queue/complete-progress/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const botKey = request.headers.get("x-bot-api-key");
    if (botKey !== process.env.BOT_API_KEY) {
      console.warn("[complete-progress] Unauthorized — invalid bot key");
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, message: "order_id wajib" },
        { status: 400 }
      );
    }

    // ⭐ CUMA hapus eternal_egg_logs — JANGAN sentuh joki_orders
    const { error, count } = await supabaseAdmin
      .from("eternal_egg_logs")
      .delete({ count: "exact" })
      .eq("order_id", order_id);

    if (error) {
      console.error("[CompleteProgress] Error:", error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    console.log(
      `[CompleteProgress] ✅ ${count} eternal_egg_logs dihapus untuk ${order_id}`
    );

    return NextResponse.json({
      success: true,
      deleted_count: count,
      message: `Hapus ${count} egg logs (joki_orders tetap ada)`,
    });
  } catch (err: any) {
    console.error("[CompleteProgress] Catch:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}