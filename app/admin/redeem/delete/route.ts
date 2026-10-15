// app/api/admin/redeem/delete/route.ts
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    const id = searchParams.get("id");

    if (!isOwner(username)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { success: false, message: "id wajib" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("redeem_codes")
      .delete()
      .eq("id", parseInt(id));

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