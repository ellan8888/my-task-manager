import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("bot_status")
      .select("*")
      .eq("bot_name", "itemku-bot")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({
        success: true,
        bot: null,
        isOnline: false,
        lastHeartbeatHuman: "belum pernah",
      });
    }

    const now = new Date();
    const lastHb = new Date(data.last_heartbeat);
    const diffSeconds = Math.floor((now.getTime() - lastHb.getTime()) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);

    // Bot dianggap ONLINE kalau heartbeat < 3 menit
    const isOnline = diffMinutes < 3;

    return NextResponse.json({
      success: true,
      bot: data,
      isOnline,
      diffSeconds,
      diffMinutes,
      lastHeartbeatHuman: diffMinutes < 1
        ? `${diffSeconds}s lalu`
        : diffMinutes < 60
        ? `${diffMinutes}m lalu`
        : `${Math.floor(diffMinutes / 60)}h lalu`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}