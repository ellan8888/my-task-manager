import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ⭐ Helper verify session — SAMA kayak auth/check
function verifySession(
  signedValue: string,
  secret: string
): Record<string, any> | null {
  const parts = signedValue.split(".");
  if (parts.length < 2) return null;

  const signature = parts[parts.length - 1];
  const value = parts.slice(0, -1).join(".");

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(value);
  const expectedSig = hmac.digest("hex");

  if (signature !== expectedSig) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

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
    // ⭐ 1. Cek auth — pakai verifySession (SAMA kayak auth/check)
    const cookieStore = await cookies();
    const signedValue = cookieStore.get("auth_session")?.value;

    if (!signedValue) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const session = verifySession(signedValue, process.env.AUTH_SECRET!);

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // ⭐ Cuma superadmin yang boleh update
    if (session.role !== "superadmin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
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