// lib/chatMedia.ts — foto/video chat pembeli Itemku di penyimpanan privat Supabase (bucket chat-media)
//
//   out/<percakapan>/IMG_<acak>.jpg   foto yang dikirim staff dari My Task (diambil bot, lalu dikirim ke Itemku)
//   in/<percakapan>/<timetoken>-<n>.<ext>  salinan foto/video dari chat Itemku (link PubNub kedaluwarsa ±3 jam
//                                          dan membawa kunci akses — tidak disimpan)
//
// File TIDAK pernah publik: halaman memanggil /api/chat/media?p=… (cek login + hak lihat percakapan)
// yang mengalihkan ke signed URL berumur pendek.
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const CHAT_BUCKET = "chat-media";
export const OUT_MAX_BYTES = 8 * 1024 * 1024;      // foto dari My Task (sudah dikecilkan di browser)
export const IN_MAX_BYTES = 25 * 1024 * 1024;      // salinan dari Itemku (video pendek)
export const OUT_KEEP_DAYS = 7;                    // kiriman My Task: cukup sampai terkirim + salinan in/ ada

/** Lampiran yang disimpan di chat_messages.files / chat_outbox.files */
export type ChatFile = { path: string; name: string; mime: string; size: number };

const CONV_RE = /^[a-z_]*?_(\d+)_(\d+)$/;
export const validConv = (c: string) => CONV_RE.test(c) && c.length <= 120;

/** Jenis file dikenali dari isi (magic bytes), bukan dari nama / header yang bisa dipalsukan. */
export function sniffMime(b: Uint8Array): string | null {
  const s = (o: number, sig: number[]) => sig.every((x, i) => b[o + i] === x);
  if (s(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (s(0, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (s(0, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (s(0, [0x52, 0x49, 0x46, 0x46]) && s(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  if (s(4, [0x66, 0x74, 0x79, 0x70])) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    if (/^(heic|heix|mif1|msf1)/.test(brand)) return "image/heic";
    if (/^qt/.test(brand)) return "video/quicktime";
    return "video/mp4";
  }
  if (s(0, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (s(0, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  return null;
}

export const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/heic": "heic",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "application/pdf": "pdf",
};

/** Nama unik yang wajar dilihat pembeli; juga dipakai mencocokkan pesan yang kembali dari Itemku. */
export function outName(ext: string) {
  const rnd = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  return `IMG_${rnd}.${ext}`;
}

/** Path aman: hanya out/ atau in/, percakapan valid, tanpa "..". */
export function safePath(p: unknown): string | null {
  const s = String(p ?? "");
  const m = s.match(/^(out|in)\/([a-z0-9_]+)\/([A-Za-z0-9_.-]{1,80})$/);
  if (!m || s.includes("..") || !validConv(m[2])) return null;
  return s;
}
export const convOfPath = (p: string) => p.split("/")[1];

export async function signedUrl(path: string, seconds = 600): Promise<string | null> {
  const { data } = await supabaseAdmin.storage.from(CHAT_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl || null;
}

/** Link PubNub tanpa kunci akses (auth/uuid/requestid/pnsdk) — hanya untuk catatan lama. */
export function stripPubnub(url: string): string {
  try {
    const u = new URL(url);
    for (const k of ["auth", "uuid", "requestid", "pnsdk", "signature", "timestamp"]) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return "";
  }
}

/** Bersihkan daftar lampiran dari bot: objek {path…} yang valid, atau link lama tanpa kunci akses. */
export function cleanFiles(list: unknown, prefix: "in" | "out" | "any" = "any"): (ChatFile | string)[] {
  if (!Array.isArray(list)) return [];
  const out: (ChatFile | string)[] = [];
  for (const f of list.slice(0, 10)) {
    if (typeof f === "string") {
      if (/^https?:\/\//.test(f)) {
        const s = stripPubnub(f);
        if (s) out.push(s);
      }
      continue;
    }
    if (f && typeof f === "object") {
      const o = f as Record<string, unknown>;
      const path = safePath(o.path);
      if (!path || (prefix !== "any" && !path.startsWith(prefix + "/"))) {
        // file yang gagal disalin: simpan namanya saja supaya terlihat "foto tidak tersedia"
        if (typeof o.name === "string" && o.missing) out.push({ path: "", name: o.name.slice(0, 80), mime: String(o.mime || ""), size: 0 });
        continue;
      }
      out.push({
        path,
        name: String(o.name || path.split("/").pop()).slice(0, 80),
        mime: String(o.mime || "").slice(0, 40),
        size: Math.max(0, Number(o.size) || 0),
      });
    }
  }
  return out;
}

/** Hapus file lebih tua dari `days` hari di out/ atau in/ (dipanggil cron cleanup-chat sekali sehari). */
export async function purgeOld(prefix: "out" | "in", days: number, maxFolders = 300): Promise<number> {
  const cutoff = Date.now() - days * 86400e3;
  const bucket = supabaseAdmin.storage.from(CHAT_BUCKET);
  const { data: folders } = await bucket.list(prefix, { limit: maxFolders });
  let removed = 0;
  for (const f of folders || []) {
    if (f.id) continue;                                   // file lepas di akar prefix (seharusnya tidak ada)
    const dir = `${prefix}/${f.name}`;
    const { data: files } = await bucket.list(dir, { limit: 1000 });
    const old = (files || [])
      .filter((x) => x.id && x.created_at && new Date(x.created_at).getTime() < cutoff)
      .map((x) => `${dir}/${x.name}`);
    for (let i = 0; i < old.length; i += 100) {
      const { error } = await bucket.remove(old.slice(i, i + 100));
      if (!error) removed += Math.min(100, old.length - i);
    }
  }
  return removed;
}
