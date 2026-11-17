// app/api/market/watch/route.ts — pilih / lepas pesaing yang dipantau untuk satu produk kita (staff yang login)
//   POST { our_product_id, competitor_id, watch: true|false }
//   POST { our_product_id, link }  → tambah manual dari link Itemku (produk yang tidak ada di daftar kandidat)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { loadOurProducts } from "@/lib/marketData";

export const dynamic = "force-dynamic";

const MAX_PER_PRODUCT = 15;
const fail = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });

/** Link produk Itemku → { id, url } (www.itemku.com/.../<id>, juga tokoku …/kode/<id>) */
function parseLink(raw: string) {
  const s = String(raw || "").trim();
  if (/^\d{5,}$/.test(s)) return { id: Number(s), url: null as string | null };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!/(^|\.)itemku\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/\/(\d{5,})\/?$/);
  if (!m) return null;
  const isPublic = /^www\.itemku\.com$/i.test(u.hostname) || /^itemku\.com$/i.test(u.hostname);
  return { id: Number(m[1]), url: isPublic ? `https://www.itemku.com${u.pathname.replace(/\/$/, "")}` : null };
}

export async function POST(req: Request) {
  const session = getSession(req);
  if (!session) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const our = Number(body.our_product_id);
  if (!Number.isSafeInteger(our) || our <= 0) return fail("Data tidak valid");

  let comp = Number(body.competitor_id);
  let manualUrl: string | null = null;
  if (body.link != null) {
    const parsed = parseLink(String(body.link));
    if (!parsed) return fail("Link belum benar. Contoh: https://www.itemku.com/id/dagangan/nama-produk/4340221");
    comp = parsed.id;
    manualUrl = parsed.url;
  }
  if (!Number.isSafeInteger(comp) || comp <= 0 || our === comp) return fail("Data tidak valid");

  if (body.watch === false) {
    const { error } = await supabaseAdmin.from("market_watch").delete().eq("our_product_id", our).eq("competitor_id", comp);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ success: true });
  }

  // satu pesaing hanya untuk satu produk kita
  const { data: taken } = await supabaseAdmin.from("market_watch").select("our_product_id").eq("competitor_id", comp).maybeSingle();
  if (taken) {
    if (Number(taken.our_product_id) === our) return NextResponse.json({ success: true, already: true });
    const { data: links } = await supabaseAdmin.from("kategori_links").select("nama_produk, link");
    const owner = (links || []).find((l) => String(l.link || "").match(new RegExp(`/${taken.our_product_id}/?$`)));
    return fail(`Pesaing ini sudah dipantau untuk "${owner?.nama_produk || taken.our_product_id}" — lepas dulu di sana`, 409);
  }

  const { count } = await supabaseAdmin
    .from("market_watch")
    .select("competitor_id", { count: "exact", head: true })
    .eq("our_product_id", our);
  if ((count || 0) >= MAX_PER_PRODUCT) return fail(`Maksimal ${MAX_PER_PRODUCT} pesaing per produk — lepas yang tidak perlu dulu`);

  const { data: exists } = await supabaseAdmin.from("market_listings").select("product_id, is_own").eq("product_id", comp).maybeSingle();
  let added = false;
  if (!exists) {
    if (body.link == null) return fail("Produk pesaing tidak ditemukan", 404);
    if (!manualUrl) return fail("Tempel link produk dari www.itemku.com (buka produknya di Itemku, salin link-nya)");
    // Tambah manual: produk belum pernah terbaca di kategori → dibuat dulu, worker membaca halamannya
    const products = await loadOurProducts();
    const mine = products.find((p) => p.product_id === our);
    if (!mine) return fail("Produk kita tidak ditemukan di Live Stock", 404);
    if (products.some((p) => p.product_id === comp)) return fail("Itu produk toko kita sendiri");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("market_listings").insert({
      product_id: comp,
      game_slug: mine.game_slug,
      url: manualUrl,
      manual: true,
      active: true,
      first_seen: now,
      last_seen: now,
      updated_at: now,
    });
    if (error) return fail(error.message, 500);
    added = true;
  } else if (exists.is_own) {
    return fail("Itu produk toko kita sendiri");
  } else if (body.link != null) {
    // ditempel manual walau sudah ada → tandai manual supaya tetap dicek langsung kalau hilang dari kategori
    await supabaseAdmin.from("market_listings").update({ manual: true }).eq("product_id", comp);
  }

  const { error } = await supabaseAdmin
    .from("market_watch")
    .upsert({ our_product_id: our, competitor_id: comp, added_by: session.username }, { onConflict: "our_product_id,competitor_id" });
  if (error) return fail(error.message, 500);
  return NextResponse.json({ success: true, competitor_id: comp, created: added });
}
