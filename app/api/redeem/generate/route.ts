// app/api/admin/redeem/generate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OWNER_USERNAMES = ["ellan"];
function isOwner(u: string | null) {
  return !!u && OWNER_USERNAMES.includes(u.toLowerCase());
}

// POST — generate code buat user
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, code, notes } = body;

    if (!isOwner(username)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { target_username, code_value, notes: codeNotes } = body;
    if (!target_username || !code_value) {
      return NextResponse.json(
        { success: false, message: "target_username & code_value wajib" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("redeem_codes")
      .insert({
        code: code_value.toUpperCase().trim(),
        username: target_username.toLowerCase().trim(),
        status: "available",
        price: 20000,
        notes: codeNotes || null,
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