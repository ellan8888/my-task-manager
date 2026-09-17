// app/api/queue/settings/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET — ambil setting (publik, siapa saja boleh baca)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("queue_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      console.error("[Queue Settings] error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      max_parallel: data.max_parallel,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// POST — update setting (HANYA ADMIN)
export async function POST(request: Request) {
  try {
    // 1. Cek auth
    const cookieStore = await cookies();
    const session = cookieStore.get("auth_session")?.value;

    if (session !== process.env.AUTH_SECRET) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // 2. Ambil body
    const { max_parallel } = await request.json();

    if (typeof max_parallel !== "number" || max_parallel < 1 || max_parallel > 100) {
      return NextResponse.json(
        { success: false, error: "max_parallel harus angka 1-100" },
        { status: 400 }
      );
    }

    // 3. Update
    const { data, error } = await supabaseAdmin
      .from("queue_settings")
      .update({ max_parallel, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select()
      .single();

    if (error) {
      console.error("[Queue Settings Update] error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      max_parallel: data.max_parallel,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}