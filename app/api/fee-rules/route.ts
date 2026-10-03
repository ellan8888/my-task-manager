// app/api/fee-rules/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OWNER_USERNAMES = ["ellan"];

// ══════════════════════════════════════════════════════════════
// HELPER — cek owner
// ══════════════════════════════════════════════════════════════
function isOwner(username: string | null): boolean {
  return !!username && OWNER_USERNAMES.includes(username.toLowerCase());
}

// ══════════════════════════════════════════════════════════════
// GET — ambil semua fee rules
// ══════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!isOwner(username)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("joki_fee_rules")
      .select("*")
      .order("joki_name");

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════════
// POST — tambah joki baru
// ══════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, joki_name, fee_amount, description } = body;

    if (!isOwner(username)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!joki_name || typeof fee_amount !== "number") {
      return NextResponse.json(
        { success: false, message: "joki_name & fee_amount wajib" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("joki_fee_rules")
      .insert({
        joki_name: joki_name.toLowerCase().trim(),
        fee_amount,
        description: description || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════════
// PATCH — update fee
// ══════════════════════════════════════════════════════════════
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { username, joki_name, fee_amount, is_active, description } = body;

    if (!isOwner(username)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!joki_name) {
      return NextResponse.json(
        { success: false, message: "joki_name wajib" },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof fee_amount === "number") updates.fee_amount = fee_amount;
    if (typeof is_active === "boolean") updates.is_active = is_active;
    if (description !== undefined) updates.description = description;

    const { data, error } = await supabaseAdmin
      .from("joki_fee_rules")
      .update(updates)
      .eq("joki_name", joki_name.toLowerCase())
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════════
// DELETE — hapus fee rule
// ══════════════════════════════════════════════════════════════
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    const joki_name = searchParams.get("joki_name");

    if (!isOwner(username)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!joki_name) {
      return NextResponse.json(
        { success: false, message: "joki_name wajib" },
        { status: 400 }
      );
    }

    // Guard: jangan hapus ellan
    if (joki_name.toLowerCase() === "ellan") {
      return NextResponse.json(
        { success: false, message: "Nggak bisa hapus owner" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("joki_fee_rules")
      .delete()
      .eq("joki_name", joki_name.toLowerCase());

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