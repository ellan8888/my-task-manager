// app/api/fee-rules/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canSeeFee, getSession } from "@/lib/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fee rahasia — akses dicek dari session login, bukan dari username yang dikirim
function isOwner(request: Request): boolean {
  return canSeeFee(getSession(request));
}

// ══════════════════════════════════════════════════════════════
// GET — ambil semua fee rules
// ══════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  try {
    if (!isOwner(request)) {
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
    const { joki_name, fee_percent, description } = body;

    if (!isOwner(request)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    if (!joki_name || typeof fee_percent !== "number") {
      return NextResponse.json(
        { success: false, message: "joki_name & fee_percent wajib" },
        { status: 400 }
      );
    }

    if (fee_percent < 0 || fee_percent > 100) {
      return NextResponse.json(
        { success: false, message: "fee_percent harus antara 0-100" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("joki_fee_rules")
      .insert({
        joki_name: joki_name.toLowerCase().trim(),
        fee_percent,
        fee_amount: 0,        // legacy field — tetap 0
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
    const { joki_name, fee_percent, is_active, description } = body;

    if (!isOwner(request)) {
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

    if (typeof fee_percent === "number") {
      if (fee_percent < 0 || fee_percent > 100) {
        return NextResponse.json(
          { success: false, message: "fee_percent harus antara 0-100" },
          { status: 400 }
        );
      }
      updates.fee_percent = fee_percent;
    }

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
    const joki_name = searchParams.get("joki_name");

    if (!isOwner(request)) {
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