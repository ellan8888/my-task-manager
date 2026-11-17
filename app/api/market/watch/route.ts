// app/api/market/watch/route.ts — pilih / lepas pesaing yang dipantau untuk satu produk kita (staff yang login)
//   POST { our_product_id, competitor_id, watch: true|false }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_PER_PRODUCT = 15;

export async function POST(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const our = Number(body.our_product_id);
  const comp = Number(body.competitor_id);
  if (!Number.isSafeInteger(our) || !Number.isSafeInteger(comp) || our <= 0 || comp <= 0 || our === comp) {
    return NextResponse.json({ success: false, message: "Data tidak valid" }, { status: 400 });
  }

  if (body.watch === false) {
    const { error } = await supabaseAdmin.from("market_watch").delete().eq("our_product_id", our).eq("competitor_id", comp);
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // satu pesaing hanya untuk satu produk kita
  const { data: taken } = await supabaseAdmin
    .from("market_watch")
    .select("our_product_id")
    .eq("competitor_id", comp)
    .maybeSingle();
  if (taken && Number(taken.our_product_id) !== our) {
    const { data: links } = await supabaseAdmin.from("kategori_links").select("nama_produk, link");
    const owner = (links || []).find((l) => String(l.link || "").match(new RegExp(`/${taken.our_product_id}/?$`)));
    return NextResponse.json(
      { success: false, message: `Pesaing ini sudah dipantau untuk "${owner?.nama_produk || taken.our_product_id}" — lepas dulu di sana` },
      { status: 409 },
    );
  }

  const { count } = await supabaseAdmin
    .from("market_watch")
    .select("competitor_id", { count: "exact", head: true })
    .eq("our_product_id", our);
  if ((count || 0) >= MAX_PER_PRODUCT) {
    return NextResponse.json(
      { success: false, message: `Maksimal ${MAX_PER_PRODUCT} pesaing per produk — lepas yang tidak perlu dulu` },
      { status: 400 },
    );
  }
  const { data: exists } = await supabaseAdmin.from("market_listings").select("product_id").eq("product_id", comp).maybeSingle();
  if (!exists) return NextResponse.json({ success: false, message: "Produk pesaing tidak ditemukan" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("market_watch")
    .upsert({ our_product_id: our, competitor_id: comp, added_by: session.username }, { onConflict: "our_product_id,competitor_id" });
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
