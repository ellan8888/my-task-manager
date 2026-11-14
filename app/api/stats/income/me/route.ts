import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);



export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("auth_session")?.value;
    const parsed = session
      ? verifySession(session, process.env.AUTH_SECRET!)
      : null;

    if (!parsed) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const jokiName = parsed.username;

    // Total income all-time — dibaca per 1000 baris (Supabase membatasi 1000 baris per request,
    // jadi tanpa ini total terpotong begitu pendapatan seseorang lewat 1000 transaksi)
    let totalIncome = 0;
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabaseAdmin
        .from("income_log")
        .select("amount")
        .eq("joki_name", jokiName)
        .order("id", { ascending: true })
        .range(from, from + 999);

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      totalIncome += (page || []).reduce((sum, r) => sum + (r.amount || 0), 0);
      if (!page || page.length < 1000) break;
    }

    return NextResponse.json({
      success: true,
      joki_name: jokiName,
      total: totalIncome,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}