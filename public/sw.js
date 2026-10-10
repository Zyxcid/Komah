// Service worker KOMAH — cache shell sederhana agar aplikasi tetap terbuka
// saat koneksi lambat/terputus sesaat (strategi network-first untuk navigasi).
const CACHE = "komah-v1";
const SHELL = ["/", "/manifest.webmanifest", "/logo.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  // API selalu segar (jangan pernah cache respons API).
  if (url.pathname.startsWith("/api/")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("/")))
  );
});

// ===== Web Push: pesanan baru untuk driver (walau tab KOMAH ditutup) =====
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: "Pesanan baru KOMAH", body: "Ada pesanan menunggumu. Buka KOMAH untuk menerimanya." };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || "Pesanan baru KOMAH", {
      body: data.body || "Ada pesanan menunggumu. Buka KOMAH untuk menerimanya.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "komah-order",
      renotify: true,
      data: { url: data.url || "/#/mode-driver" },
      vibrate: [200, 100, 200],
    })
  );
});

// Klik notifikasi: fokuskan jendela KOMAH yang terbuka, atau buka baru.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow((e.notification.data && e.notification.data.url) || "/#/mode-driver");
    })
  );
});
