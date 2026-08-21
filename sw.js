/* Estate File v1A - service worker.

   Two rules pull in opposite directions here and both matter.

   Offline is a hard requirement. Nothing in this app needs the network and it
   has to open in a waiting room with no bars, so the cache must always be
   able to answer on its own.

   But a cache-first worker that never revalidates will serve a stale app
   forever. That is not hypothetical: v5f shipped a header change with the
   cache name left untouched, the worker kept answering from its old copy,
   and re-uploading the correct files to the host changed nothing on the
   phone. A user would have had no way to know, and no way to fix it.

   So: stale-while-revalidate for the app's own files. The cache answers
   immediately, which keeps the app instant and keeps it working with no
   signal; a fetch goes out in the background and refreshes the cache, so the
   next launch has the new version. One extra launch is the cost, and that is
   the normal bargain for an offline-first app.

   APP_VERSION in app.js and CACHE_NAME here must always match. A test
   asserts it, because remembering to bump it by hand is exactly what failed. */
const CACHE_NAME = "estate-file-v1A";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/strings.js",
  "/vendor/react.js",
  "/sw-register.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Only this app's own origin is ever cached. There are no third-party
  // requests in this app at all, so anything else is left alone.
  let sameOrigin = false;
  try { sameOrigin = new URL(req.url).origin === self.location.origin; } catch { sameOrigin = false; }
  if (!sameOrigin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        // Background refresh. Its failure is expected and silent: offline is
        // the normal case here, not an error.
        const network = fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === "basic") cache.put(req, res.clone());
          return res;
        }).catch(() => null);

        // Cached copy wins on speed; if there is none, wait for the network;
        // if that fails too, fall back to the shell so a deep link still opens.
        if (cached) { event.waitUntil(network); return cached; }
        return network.then((res) => res || cache.match("/index.html"));
      })
    )
  );
});
