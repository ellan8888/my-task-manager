import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifySession(signedValue: string, secret: string) {
  const parts = signedValue.split(".");
  if (parts.length < 2) return null;
  const signature = parts[parts.length - 1];
  const value = parts.slice(0, -1).join(".");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(value);
  if (signature !== hmac.digest("hex")) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// ⭐ GET — list bank accounts
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

    const { data, error } = await supabaseAdmin
      .from("user_bank_accounts")
      .select("*")
      .eq("username", parsed.username)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// ⭐ POST — tambah bank account
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { bank_name, account_number, account_holder, set_default } = body;

    if (!bank_name || !account_number) {
      return NextResponse.json(
        { success: false, message: "Nama bank & nomor rekening wajib" },
        { status: 400 }
      );
    }

    // ⭐ Kalau set_default = true, unset default yang lain
    if (set_default) {
      await supabaseAdmin
        .from("user_bank_accounts")
        .update({ is_default: false })
        .eq("username", parsed.username);
    }

    // Cek user udah punya rekening? Kalau belum, otomatis jadi default
    const { data: existing } = await supabaseAdmin
      .from("user_bank_accounts")
      .select("id")
      .eq("username", parsed.username);

    const shouldBeDefault = set_default || !existing || existing.length === 0;

    const { data, error } = await supabaseAdmin
      .from("user_bank_accounts")
      .insert([
        {
          username: parsed.username,
          bank_name,
          account_number,
          account_holder: account_holder || null,
          is_default: shouldBeDefault,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// ⭐ PATCH — set default / update
export async function PATCH(req: NextRequest) {
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

    const body = await req.json();
    const { id, is_default } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "id wajib" },
        { status: 400 }
      );
    }

    // Pastiin rekening ini milik user yang login
    const { data: existing } = await supabaseAdmin
      .from("user_bank_accounts")
      .select("id")
      .eq("id", id)
      .eq("username", parsed.username)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Rekening nggak ketemu" },
        { status: 404 }
      );
    }

    // ⭐ Kalau set_default = true, unset default yang lain
    if (is_default === true) {
      await supabaseAdmin
        .from("user_bank_accounts")
        .update({ is_default: false })
        .eq("username", parsed.username);
    }

    const { data, error } = await supabaseAdmin
      .from("user_bank_accounts")
      .update({ is_default: is_default === true })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// ⭐ DELETE — hapus bank account
export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "id wajib" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("user_bank_accounts")
      .delete()
      .eq("id", id)
      .eq("username", parsed.username);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}