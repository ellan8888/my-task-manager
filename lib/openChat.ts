// lib/openChat.ts — notif chat pembeli membawa url "/?chat=<conversation_id>".
// Di dalam My Task (lonceng / halaman Notifikasi) tidak perlu pindah halaman: ChatDock langsung membuka ruang chat itu.
// Dari push notif (service worker) halaman dibuka dengan ?chat=… lalu ChatDock membacanya saat dimuat.
export const OPEN_CHAT_EVENT = "mytask:open-chat";

export function chatIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url, "http://x").searchParams.get("chat");
  } catch {
    return null;
  }
}

/** true kalau url ini notif chat dan ruang chatnya sudah dibuka */
export function openChatFromUrl(url: string | null | undefined): boolean {
  const id = chatIdFromUrl(url);
  if (!id || typeof window === "undefined") return false;
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: id }));
  return true;
}
