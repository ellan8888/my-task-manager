self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activated");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  console.log("📨 Push notification received");

  let data = {
    title: "My Task Manager",
    body: "Ada reminder task!",
    icon: "/icon-192.png",
    url: "/",
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (error) {
      console.error("Gagal membaca push data:", error);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    // ⭐ Simpan URL ke data → buat redirect pas klik
    data: {
      url: data.url || data.data?.url || "/",
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // ⭐ Ambil URL dari data notification
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      // Cari tab yang udah buka origin kita
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          // Navigate tab itu ke target URL
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      // Kalau nggak ada tab → buka baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});