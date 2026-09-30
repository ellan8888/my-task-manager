import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ⭐ Pake service role biar bypass RLS (search bebas)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json(
        { success: false, error: "Query kosong" },
        { status: 400 }
      );
    }

    // Sanitize query — cegah karakter aneh di ilike
    const safe = query.replace(/[%_,()]/g, "");

    // ⭐ Search di income_log — partial match, case-insensitive
    const { data, error } = await supabase
      .from("income_log")
      .select("*")
      .or(
        `order_id.ilike.%${safe}%,` +
          `roblox_username.ilike.%${safe}%,` +
          `joki_name.ilike.%${safe}%,` +
          `product_title.ilike.%${safe}%`
      )
      .order("completed_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[income/search] Supabase error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      data: data || [],
    });
  } catch (err: any) {
    console.error("[income/search] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}