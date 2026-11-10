// app/api/redeem/my-codes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Hanya code milik user yang login (parameter ?username diabaikan)
    const username = getSession(request)?.username;

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Silakan login dulu" },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("redeem_codes")
      .select("*")
      .eq("username", username.toLowerCase().trim())
      .eq("status", "used")
      .order("used_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}