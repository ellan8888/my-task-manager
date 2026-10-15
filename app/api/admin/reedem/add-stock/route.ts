// app/api/admin/redeem/add-stock/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OWNER_USERNAMES = ["ellan"];

export async function POST(request: Request) {
  try {
    const { username, code, target_username, notes } = await request.json();

    if (!OWNER_USERNAMES.includes(username?.toLowerCase())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { success: false, message: "code wajib" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("redeem_codes")
      .insert({
        code: code.toUpperCase().trim(),
        username: target_username?.toLowerCase().trim() || null,
        status: "available",
        price: 20000,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}