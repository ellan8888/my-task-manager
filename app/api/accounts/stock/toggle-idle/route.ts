// app/api/accounts/stock/toggle-idle/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, idle } = body;

    if (!username || typeof idle !== "boolean") {
      return NextResponse.json(
        { success: false, message: "username & idle wajib" },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {
      idle,
      idle_marked_at: idle ? new Date().toISOString() : null,
    };

    const { data, error } = await supabaseAdmin
      .from("accounts_stock")
      .update(updates)
      .eq("username", username)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: idle ? "Ditandai idle" : "Idle dihapus",
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}