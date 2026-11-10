// lib/ram.ts — tutup akun Roblox di Roblox Account Manager (RAM) lewat tunnel. Server only.

export type RamResult = { success: boolean; status: number; message: string };

export async function removeFromRam(username: string): Promise<RamResult> {
  const ramUrl = process.env.RAM_TUNNEL_URL;
  const ramPassword = process.env.RAM_PASSWORD;
  if (!ramUrl) return { success: false, status: 500, message: "RAM_TUNNEL_URL belum diset di Vercel" };

  let targetUrl = `${ramUrl}/RemoveAccount?Account=${encodeURIComponent(username)}`;
  if (ramPassword && ramPassword.length >= 6) {
    targetUrl += `&Password=${encodeURIComponent(ramPassword)}`;
  }

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: { "Content-Type": "text/plain", "User-Agent": "MyTaskManager/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    // Jangan log URL lengkap — berisi password RAM
    console.log(`[RAM] RemoveAccount ${username}: HTTP ${res.status} ${text.slice(0, 120)}`);
    return { success: res.ok, status: res.status, message: text };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal menghubungi RAM";
    console.error(`[RAM] RemoveAccount ${username} gagal:`, message);
    return { success: false, status: 500, message };
  }
}
