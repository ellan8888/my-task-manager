import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// POST — Mark stock sebagai USED (setelah input ke itemku)
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { username, order_id } = await req.json();

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Username wajib" },
        { status: 400 }
      );
    }

    // Guard: cek existing
    const { data: existing, error: fetchErr } = await supabase
      .from("accounts_stock")
      .select("username, used")
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

    if (existing.used) {
      return NextResponse.json({
        success: true,
        message: "Udah pernah di-mark used",
        skipped: true,
      });
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

    return NextResponse.json({
      success: true,
      message: `${username} di-mark used`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}