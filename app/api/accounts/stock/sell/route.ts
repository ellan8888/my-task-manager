// app/api/accounts/stock/sell/route.ts
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

    // Cek existing
    const { data: existing, error: fetchErr } = await supabase
      .from("accounts_stock")
      .select("username, status, used")
      .eq("username", username)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json(
        { success: false, message: fetchErr.message },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Username nggak ada di stock" },
        { status: 404 }
      );
    }

    if (existing.status === "listed") {
      return NextResponse.json({
        success: false,
        message: "Akun udah pernah dijual & masuk itemku",
      });
    }

    if (existing.status === "queued_for_sale") {
      return NextResponse.json({
        success: false,
        message: "Akun udah dalam antrian jual",
      });
    }

    // ★ Update status → queued_for_sale
    const { error } = await supabase
      .from("accounts_stock")
      .update({
        status: "queued_for_sale",
        updated_at: new Date().toISOString(),
      })
      .eq("username", username);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Akun "${username}" masuk antrian jual. Bot akan input ke itemku.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}