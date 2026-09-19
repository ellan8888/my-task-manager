import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — list semua kategori
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") !== "false";

    let query = supabase
      .from("kategori_links")
      .select("*")
      .order("kategori", { ascending: true });

    if (activeOnly) query = query.eq("active", true);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    // Return object { kategori: link } + list
    const mapping: Record<string, string> = {};
    (data || []).forEach((row) => {
      mapping[row.kategori] = row.link;
    });

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      data: mapping,
      list: data || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

// POST — tambah / update kategori
export async function POST(req: NextRequest) {
  try {
    const { kategori, link } = await req.json();

    if (!kategori || !link) {
      return NextResponse.json(
        { success: false, message: "kategori & link wajib" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("kategori_links")
      .upsert(
        {
          kategori: kategori.toLowerCase().trim(),
          link: link.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "kategori" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Kategori "${kategori}" disimpan`,
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

// DELETE — hapus kategori
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const kategori = searchParams.get("kategori");

    if (!kategori) {
      return NextResponse.json(
        { success: false, message: "kategori wajib" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("kategori_links")
      .delete()
      .eq("kategori", kategori);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Kategori "${kategori}" dihapus`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}