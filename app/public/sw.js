// Self-unregistering service worker
// This replaces any stale service worker cached by a previous app on this origin
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => {
  self.registration.unregister();
  self.clients.matchAll({ type: "window" }).then((clients) => {
    clients.forEach((client) => client.navigate(client.url));
  });
});
