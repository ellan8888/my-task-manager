// chatAttach.ts — siapkan foto sebelum dikirim ke pembeli: kecilkan di browser lalu unggah dengan progres.
// Dikecilkan dulu supaya cepat walau sinyal HP lemah, dan supaya ukuran wajar di chat Itemku.

export type ChatFile = { path: string; name: string; mime: string; size: number };

export type Attachment = {
  id: string;
  name: string;
  preview: string;                 // object URL untuk pratinjau
  status: "compressing" | "uploading" | "ready" | "error";
  progress: number;                // 0..1 (unggah)
  error?: string;
  uploaded?: ChatFile;
  blob?: Blob;                     // hasil kecilkan (dipakai lagi kalau unggah diulang)
};

export const MAX_ATTACH = 6;
const MAX_SIDE = 1920;
const QUALITY = 0.85;
const MAX_UPLOAD = 8 * 1024 * 1024;
const PASS_THROUGH = 600 * 1024;   // foto kecil (≤ 600 KB) tidak perlu dikompres ulang

/** Kecilkan foto: sisi terpanjang maks. 1920 px, JPEG 85%. GIF dibiarkan (supaya tetap bergerak). */
export async function compressImage(file: File): Promise<Blob> {
  if (file.type === "image/gif") {
    if (file.size > MAX_UPLOAD) throw new Error("GIF terlalu besar (maks. 8 MB)");
    return file;
  }
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
      throw new Error("Foto HEIC belum didukung browser ini — kirim sebagai JPG");
    }
    throw new Error("File ini bukan foto yang bisa dibuka");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size <= PASS_THROUGH && /^image\/(jpeg|png|webp)$/.test(file.type)) {
    bmp.close();
    return file;
  }
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak bisa memproses foto");
  ctx.fillStyle = "#fff";                     // PNG transparan → latar putih (JPEG tidak punya transparansi)
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALITY));
  if (!out) throw new Error("Gagal memproses foto");
  // kompres malah lebih besar (foto sudah kecil) → pakai aslinya
  const best = out.size < file.size || file.size > MAX_UPLOAD || !/^image\/(jpeg|png|webp)$/.test(file.type) ? out : file;
  if (best.size > MAX_UPLOAD) throw new Error("Foto terlalu besar walau sudah dikecilkan");
  return best;
}

/** Unggah dengan progres (fetch belum bisa melaporkan progres unggah). */
export function uploadAttachment(conv: string, blob: Blob, onProgress: (p: number) => void): Promise<ChatFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/chat/upload?c=${encodeURIComponent(conv)}`);
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let d: { success?: boolean; message?: string; file?: ChatFile } = {};
      try {
        d = JSON.parse(xhr.responseText);
      } catch {
        /* bukan JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && d.success && d.file) resolve(d.file);
      else reject(new Error(d.message || `Unggah gagal (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Koneksi terputus saat mengunggah"));
    xhr.ontimeout = () => reject(new Error("Unggah terlalu lama, coba lagi"));
    xhr.timeout = 120_000;
    xhr.send(blob);
  });
}

/** Ambil file foto dari paste / drop (abaikan teks). */
export function imagesFrom(list: FileList | DataTransferItemList | null | undefined): File[] {
  if (!list) return [];
  const out: File[] = [];
  for (const it of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const f = it instanceof File ? it : it.kind === "file" ? it.getAsFile() : null;
    if (f && (f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|hei[cf])$/i.test(f.name))) out.push(f);
  }
  return out;
}

/** Sumber gambar untuk lampiran chat: salinan di My Task, atau link lama. */
export function mediaSrc(f: ChatFile | string): string | null {
  if (typeof f === "string") return f;
  return f.path ? `/api/chat/media?p=${encodeURIComponent(f.path)}` : null;
}
export function mediaKind(f: ChatFile | string): "image" | "video" | "file" {
  const s = typeof f === "string" ? f : `${f.mime} ${f.name}`;
  if (/video\/|\.(mp4|mov|webm)(\?|$|\s)/i.test(s)) return "video";
  if (/image\/|\.(jpe?g|png|gif|webp|heic)(\?|$|\s)/i.test(s)) return "image";
  if (typeof f !== "string" && !f.mime && !/\./.test(f.name)) return "image";
  return "file";
}
