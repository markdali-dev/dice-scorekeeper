// Service worker: stores the app's files on the phone so it works offline.
//
// Strategy ("stale-while-revalidate"): always answer from the stored copy
// straight away (fast, works with no signal), and when there is a connection
// quietly fetch the latest version in the background for next time.
// So after an update is pushed to GitHub, the phone picks it up on the
// second launch with a connection, no version bump needed.

const CACHE = "dice-scorekeeper";

const FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/hex-grid.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const fresh = fetch(event.request)
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(fresh);   // keep the background refresh alive
        return cached;
      }
      return fresh;
    })
  );
});
