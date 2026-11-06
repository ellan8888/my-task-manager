// sw.js — service worker notifikasi My Task Manager
//  • Notifikasi sejenis digabung (mis. 3 "Akun Laku" jadi satu kartu "+2 lainnya")
//  • Getar, jam, tombol "Lihat"
//  • Angka belum dibaca di ikon aplikasi (kalau didukung perangkat)
//  • Memberi tahu tab yang terbuka supaya ikon lonceng langsung diperbarui

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function broadcast(message) {
  const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  list.forEach((c) => c.postMessage(message));
}

self.addEventListener("push", (event) => {
  let data = { title: "My Task Manager", body: "", url: "/", kind: "sistem" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }
  const tag = data.tag || data.kind || "sistem";
  const url = data.url || (data.data && data.data.url) || "/";

  event.waitUntil(
    (async () => {
      // Gabungkan dengan notifikasi sejenis yang masih tampil
      const existing = await self.registration.getNotifications({ tag });
      const prevCount = existing.reduce((n, x) => Math.max(n, (x.data && x.data.count) || 1), 0);
      const count = prevCount + 1;
      existing.forEach((x) => x.close());

      const title = count > 1 ? `${data.title} (+${count - 1} lainnya)` : data.title;

      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: data.icon || "/icon-192.png",
        badge: data.badge || "/icon-192.png",
        tag,
        renotify: true,
        vibrate: [120, 60, 120],
        timestamp: data.ts || Date.now(),
        data: { url, count, kind: data.kind },
        actions: [{ action: "open", title: "Lihat" }],
      });

      if (typeof data.unread === "number" && "setAppBadge" in self.navigator) {
        try {
          if (data.unread > 0) await self.navigator.setAppBadge(data.unread);
          else await self.navigator.clearAppBadge();
        } catch {}
      }

      await broadcast({ type: "notif:new", kind: data.kind });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          if ("navigate" in client) await client.navigate(targetUrl).catch(() => null);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })()
  );
});
