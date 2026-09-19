import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// GET — Ambil stock yang belum dipakai (used = false)
// ============================================================
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("accounts_stock")
      .select("id, username, password, kategori, added_by, roblox_cookie, created_at")
      .eq("used", false)
      .order("created_at", { ascending: true });  // FIFO — yang lama duluan

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      data: data || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}