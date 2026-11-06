// lib/email.ts — kirim email lewat Gmail (SMTP + App Password). Khusus server.
//
// Environment variable (Vercel → Settings → Environment Variables):
//   SMTP_USER       alamat Gmail pengirim, mis. tokokamu@gmail.com
//   SMTP_PASS       App Password 16 huruf dari akun Google itu (BUKAN password login biasa)
//   SMTP_FROM_NAME  (opsional) nama pengirim, default "My Task Manager"
//   SMTP_HOST / SMTP_PORT (opsional) default smtp.gmail.com / 465
//
// Saat ini dipakai untuk notifikasi PENARIKAN saldo:
//   • request baru      → email ke owner
//   • disetujui/ditolak → email ke staff pemilik saldo
// Alamat email & on/off diatur tiap user di halaman Notifikasi (tabel notification_prefs).
import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://my-task-manager-self.vercel.app").replace(/\/$/, "");
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let transporter: nodemailer.Transporter | null = null;
export function emailConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}
function getTransporter() {
  if (!emailConfigured()) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const t = getTransporter();
  if (!t) return { ok: false, error: "Email belum diatur (SMTP_USER / SMTP_PASS kosong)" };
  try {
    await t.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "My Task Manager"}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text,
    });
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[email] Gagal kirim ke ${to}:`, msg);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────
// Template
// ──────────────────────────────────────────────────────────────
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const rupiah = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
export const maskAccount = (n?: string | null) => {
  const v = String(n || "").replace(/\s/g, "");
  return v.length > 4 ? `•••• ${v.slice(-4)}` : v || "-";
};
const wib = (d = new Date()) =>
  d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB";

type Tone = "amber" | "green" | "red" | "violet";
const TONES: Record<Tone, { bg: string; fg: string; soft: string }> = {
  amber: { bg: "#f59e0b", fg: "#92400e", soft: "#fef3c7" },
  green: { bg: "#10b981", fg: "#065f46", soft: "#d1fae5" },
  red: { bg: "#ef4444", fg: "#991b1b", soft: "#fee2e2" },
  violet: { bg: "#7c3aed", fg: "#4c1d95", soft: "#ede9fe" },
};

export function renderEmail(opts: {
  tone: Tone;
  badge: string;
  title: string;
  intro: string;
  amount?: number;
  rows: [string, string][];
  buttonText: string;
  path: string;
  extraLink?: { text: string; url: string };
}) {
  const t = TONES[opts.tone];
  const url = SITE_URL + opts.path;
  const rows = opts.rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;width:40%">${esc(k)}</td>` +
        `<td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right">${esc(v)}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:20px 24px;color:#fff;font-size:15px;font-weight:700;letter-spacing:.3px">My Task Manager</td></tr>
<tr><td style="padding:24px">
<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${t.soft};color:${t.fg};font-size:12px;font-weight:700">${esc(opts.badge)}</span>
<h1 style="margin:14px 0 6px;font-size:20px;color:#0f172a">${esc(opts.title)}</h1>
<p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.6">${esc(opts.intro)}</p>
${opts.amount !== undefined ? `<div style="padding:16px;border-radius:12px;background:${t.soft};text-align:center;margin-bottom:12px"><div style="font-size:12px;color:${t.fg};font-weight:600">Jumlah</div><div style="font-size:26px;font-weight:800;color:${t.fg};margin-top:2px">${esc(rupiah(opts.amount))}</div></div>` : ""}
<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<div style="text-align:center;margin-top:22px"><a href="${esc(url)}" style="display:inline-block;background:${t.bg};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">${esc(opts.buttonText)}</a></div>
${opts.extraLink ? `<p style="text-align:center;margin:12px 0 0;font-size:13px"><a href="${esc(opts.extraLink.url)}" style="color:#7c3aed">${esc(opts.extraLink.text)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:12px;line-height:1.5">Email otomatis dari My Task Manager. Atur notifikasi email di menu Notifikasi.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    opts.title,
    "",
    opts.intro,
    opts.amount !== undefined ? `Jumlah: ${rupiah(opts.amount)}` : "",
    ...opts.rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    "",
    `${opts.buttonText}: ${url}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");
  return { html, text };
}

// ──────────────────────────────────────────────────────────────
// Penarikan
// ──────────────────────────────────────────────────────────────
type Withdrawal = {
  joki_name: string;
  amount: number;
  note?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_holder?: string | null;
  transfer_note?: string | null;
  reject_reason?: string | null;
  payment_proof_url?: string | null;
};

/** Alamat email user yang mengaktifkan email penarikan */
async function withdrawRecipients(usernames: string[]) {
  const { data, error } = await supabaseAdmin
    .from("notification_prefs")
    .select("username, email, email_penarikan")
    .in("username", usernames.map((u) => u.toLowerCase()));
  if (error) return [];
  return (data || [])
    .filter((p) => p.email && EMAIL_RE.test(p.email) && p.email_penarikan !== false)
    .map((p) => ({ username: p.username as string, email: p.email as string }));
}

/** Email ke owner saat ada request tarik baru */
export async function emailWithdrawRequest(ownerUsernames: string[], w: Withdrawal) {
  if (!emailConfigured()) return;
  const to = await withdrawRecipients(ownerUsernames);
  if (!to.length) return;
  const { html, text } = renderEmail({
    tone: "amber",
    badge: "Request penarikan",
    title: `${w.joki_name} mengajukan penarikan saldo`,
    intro: "Ada request penarikan baru yang menunggu persetujuanmu.",
    amount: w.amount,
    rows: [
      ["Pemilik saldo", w.joki_name],
      ["Bank", w.bank_name || "-"],
      ["No. rekening", w.account_number || "-"],
      ["Atas nama", w.account_holder || "-"],
      ["Catatan", w.note || ""],
      ["Waktu", wib()],
    ],
    buttonText: "Proses penarikan",
    path: "/admin/withdrawals",
  });
  await Promise.all(to.map((r) => sendEmail(r.email, `Request penarikan ${rupiah(w.amount)} dari ${w.joki_name}`, html, text)));
}

/** Email ke staff saat penarikannya disetujui / ditolak */
export async function emailWithdrawResult(w: Withdrawal, action: "approve" | "reject") {
  if (!emailConfigured()) return;
  const to = await withdrawRecipients([w.joki_name]);
  if (!to.length) return;
  const approved = action === "approve";
  const { html, text } = renderEmail({
    tone: approved ? "green" : "red",
    badge: approved ? "Penarikan disetujui" : "Penarikan ditolak",
    title: approved ? "Penarikan saldo kamu sudah ditransfer" : "Penarikan saldo kamu ditolak",
    intro: approved
      ? "Dana sudah dikirim ke rekening kamu. Silakan cek mutasi rekening."
      : "Request penarikan kamu belum bisa diproses. Saldo tetap utuh dan bisa diajukan lagi.",
    amount: w.amount,
    rows: [
      ["Bank", w.bank_name || "-"],
      ["No. rekening", maskAccount(w.account_number)],
      ["Atas nama", w.account_holder || "-"],
      [approved ? "Catatan transfer" : "Alasan", (approved ? w.transfer_note : w.reject_reason) || (approved ? "" : "-")],
      ["Waktu", wib()],
    ],
    buttonText: "Lihat riwayat saldo",
    path: "/admin/riwayat-saldo",
    extraLink: approved && w.payment_proof_url ? { text: "Lihat bukti transfer", url: w.payment_proof_url } : undefined,
  });
  await Promise.all(
    to.map((r) =>
      sendEmail(r.email, approved ? `Penarikan ${rupiah(w.amount)} sudah ditransfer` : `Penarikan ${rupiah(w.amount)} ditolak`, html, text)
    )
  );
}
