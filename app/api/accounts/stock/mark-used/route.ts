// app/api/accounts/stock/mark-used/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { username, order_id } = await req.json();

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Username wajib diisi" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("accounts_stock")
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_order_id: order_id || null,
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