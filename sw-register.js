// Service worker registration. Kept in its own file so index.html carries no
// inline script at all.
// The native iOS build loads these files from inside the app bundle over
// the bundled estatefile:// scheme, where a service worker is not needed
// because every app file is already local. Registering only on http/https keeps
// the native build's console clean.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => console.error("SW registration failed", err));
  });
}
