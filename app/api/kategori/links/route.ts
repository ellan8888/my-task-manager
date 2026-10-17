// app/api/kategori/links/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_API_URL = process.env.BOT_API_URL || "http://localhost:5001";

// ══════════════════════════════════════════════════════════════
// GET — list semua kategori
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// POST — tambah / edit link / edit produk
// ══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      kategori, 
      link, 
      nama_produk, 
      image_url, 
      mode,
      default_income,   // ⭐ NEW
      default_speed,    // ⭐ NEW
    } = body;

    if (!kategori || !link) {
      return NextResponse.json(
        { success: false, message: "kategori & link wajib" },
        { status: 400 }
      );
    }

    const kategoriClean = kategori.toLowerCase().trim();
    const linkClean = link.trim();

    // ═══════════════════════════════════════════════════════
    // MODE: ADD
    // ═══════════════════════════════════════════════════════
    if (!mode || mode === "add") {
      if (!nama_produk || !image_url) {
        return NextResponse.json(
          { success: false, message: "Nama produk & foto wajib untuk kategori baru" },
          { status: 400 }
        );
      }

      const { data: existing } = await supabase
        .from("kategori_links")
        .select("id")
        .eq("kategori", kategoriClean)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { success: false, message: `Kategori "${kategori}" udah ada` },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("kategori_links")
        .insert({
          kategori: kategoriClean,
          link: linkClean,
          nama_produk,
          image_url,
          default_income: default_income?.trim() || null,   // ⭐ NEW
          default_speed: default_speed?.trim() || null,     // ⭐ NEW
          active: true,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, message: error.message },
          { status: 500 }
        );
      }

      const botSent = await queueAndSendNotif({
        kategori: kategoriClean,
        nama_produk,
        image_url,
      });

      return NextResponse.json({
        success: true,
        data,
        bot_sent: botSent,
        message: botSent
          ? "Kategori + produk terkirim ke Discord!"
          : "Kategori ditambahkan (bot offline — notif disimpan)",
      });
    }

    // ═══════════════════════════════════════════════════════
    // MODE: EDIT_LINK
    // ═══════════════════════════════════════════════════════
    if (mode === "edit_link") {
      const updateData: any = {
        link: linkClean,
        updated_at: new Date().toISOString(),
      };
      
      // ⭐ Update default_income & default_speed kalau dikirim
      if (default_income !== undefined) {
        updateData.default_income = default_income?.trim() || null;
      }
      if (default_speed !== undefined) {
        updateData.default_speed = default_speed?.trim() || null;
      }

      const { data, error } = await supabase
        .from("kategori_links")
        .update(updateData)
        .eq("kategori", kategoriClean)
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
        data,
        bot_sent: false,
        message: "Link kategori di-update",
      });
    }

    // ═══════════════════════════════════════════════════════
    // MODE: EDIT_PRODUCT
    // ═══════════════════════════════════════════════════════
    if (mode === "edit_product") {
      if (!nama_produk || !image_url) {
        return NextResponse.json(
          { success: false, message: "Nama produk & foto wajib diisi" },
          { status: 400 }
        );
      }

      const updateData: any = {
        link: linkClean,
        nama_produk,
        image_url,
        updated_at: new Date().toISOString(),
      };
      
      // ⭐ Update default_income & default_speed kalau dikirim
      if (default_income !== undefined) {
        updateData.default_income = default_income?.trim() || null;
      }
      if (default_speed !== undefined) {
        updateData.default_speed = default_speed?.trim() || null;
      }

      const { data, error } = await supabase
        .from("kategori_links")
        .update(updateData)
        .eq("kategori", kategoriClean)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, message: error.message },
          { status: 500 }
        );
      }

      const botSent = await queueAndSendNotif({
        kategori: kategoriClean,
        nama_produk,
        image_url,
      });

      return NextResponse.json({
        success: true,
        data,
        bot_sent: botSent,
        message: botSent
          ? "Produk di-update + terkirim ke Discord!"
          : "Produk di-update (bot offline — notif disimpan)",
      });
    }

    return NextResponse.json(
      { success: false, message: `Mode "${mode}" nggak valid` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════════
// DELETE — hapus kategori
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// HELPER — Simpan ke DB pending + coba kirim ke bot
// ══════════════════════════════════════════════════════════════
async function queueAndSendNotif(data: {
  kategori: string;
  nama_produk: string;
  image_url: string;
}): Promise<boolean> {
  // 1. Selalu simpan ke DB dulu
  const { data: notifRow, error: insertError } = await supabase
    .from("pending_product_notifs")
    .insert({
      kategori: data.kategori,
      nama_produk: data.nama_produk,
      image_url: data.image_url,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[queueAndSendNotif] Insert error:", insertError);
    // Tetep coba kirim ke bot walaupun DB error
  }

  // 2. Coba kirim ke bot
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${BOT_API_URL}/api/notify-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        notif_id: notifRow?.id,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok && notifRow?.id) {
      // Update status jadi sent
      await supabase
        .from("pending_product_notifs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: 1,
        })
        .eq("id", notifRow.id);

      return true;
    }

    return false;
  } catch (err: any) {
    console.warn(
      "[queueAndSendNotif] Bot nggak respond:",
      err.name === "AbortError" ? "timeout 5s" : err.message
    );
    return false;
  }
}