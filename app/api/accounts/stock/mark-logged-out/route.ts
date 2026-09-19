// app/api/accounts/stock/mark-logged-out/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Username wajib" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("accounts_stock")
      .update({
        logged_out: true,
        logged_out_at: new Date().toISOString(),
        roblox_cookie: null,   // hapus cookie biar aman
        updated_at: new Date().toISOString(),
      })
      .eq("username", username);

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