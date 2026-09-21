import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { bot_name, status, message, metadata } = await req.json();

    if (!bot_name) {
      return NextResponse.json(
        { success: false, message: "bot_name wajib" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("bot_status")
      .upsert(
        {
          bot_name,
          status: status || "online",
          message: message || null,
          metadata: metadata || null,
          last_heartbeat: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "bot_name" }
      );

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}