// Service worker de Cortes: solo recibe las notificaciones del dueño (Web
// Push) y abre la app al tocarlas. No guarda nada en caché, para que cada
// versión nueva de la app se vea en cuanto se publica.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let m = {};
  try {
    m = e.data ? e.data.json() : {};
  } catch {
    m = { cuerpo: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(m.titulo || "Cortes", {
      body: m.cuerpo || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: m.etiqueta || undefined,
      renotify: !!m.etiqueta,
      requireInteraction: true,
      data: { url: m.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => "focus" in v);
      if (abierta) return abierta.focus();
      return self.clients.openWindow(url);
    })
  );
});
