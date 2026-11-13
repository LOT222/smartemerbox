/* SEB v2 service worker — app shell cache + Web Push */
const VERSION = "seb-v2.13.0-2";
const SHELL = [
  "./", "./index.html", "./styles.css", "./config.js", "./manifest.webmanifest",
  "./vendor/qrcode.js", "./vendor/fonts.css", "./vendor/icons.css", "./js/consent-text.js", "./js/core.js", "./js/consent.js", "./js/app.js", "./js/pages.js", "./js/print.js", "./js/stats.js", "./js/research.js", "./js/public.js",
  "./icons/icon-192.png", "./icons/hospital-logo-96.png", "./icons/seb-logo-256.png", "./icons/hospital-logo-256.png", "./icons/icon-512.png", "./icons/badge-72.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => null)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// network-first สำหรับไฟล์ของแอป (ได้เวอร์ชันล่าสุดเสมอ), ไม่ cache การเรียก API
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.includes("/functions/v1/")) return;
  const sameOrigin = url.origin === self.location.origin;
  const cdn = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host);
  if (!sameOrigin && !cdn) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: sameOrigin && url.pathname.endsWith("/") }).then((r) => r || caches.match("./index.html"))),
  );
});

self.addEventListener("push", (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (_) { p = { title: "SEB", body: e.data ? e.data.text() : "" }; }
  const title = p.title || "Smart Emergency Box";
  const opts = {
    body: p.body || "",
    tag: p.tag || "seb",
    renotify: true,
    requireInteraction: !!p.urgent,
    icon: "./icons/icon-192.png",
    badge: "./icons/badge-72.png",
    vibrate: p.urgent ? [300, 120, 300, 120, 300] : [120],
    data: { url: p.url || "./" },
    timestamp: Date.now(),
  };
  e.waitUntil(
    self.registration.showNotification(title, opts).then(() =>
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => cs.forEach((c) => c.postMessage({ type: "push", payload: p }))),
    ),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if (c.url.startsWith(self.registration.scope)) { c.navigate(target).catch(() => null); return c.focus(); }
      }
      return self.clients.openWindow(target);
    }),
  );
});
