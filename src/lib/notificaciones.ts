import { supabase } from "./supabaseClient";

// Notificaciones del dueño en su iPhone (Web Push). La app guarda aquí el
// dispositivo; la función de Supabase "notificaciones" decide qué mandar
// (ver notificacionesLogica.ts y migration_018_notificaciones.sql).

// Llave pública VAPID (la privada vive en Supabase Vault).
export const VAPID_PUBLICA = "BAjNJrgec7R51ZxI7cQvLRb6gJJAZvUwPNnoY3Xn5izvr708sBmG3plJ0ZttXF9us5zXCPbCbUqOig2RhYkx-2Q";

export type EstadoNotif = "sin-soporte" | "instalar" | "bloqueadas" | "apagadas" | "activas";

const esIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const instalada = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export async function estadoNotificaciones(): Promise<EstadoNotif> {
  // En iPhone solo hay notificaciones con la app instalada en la pantalla de inicio.
  if (esIOS() && !instalada()) return "instalar";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "sin-soporte";
  if (Notification.permission === "denied") return "bloqueadas";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub && Notification.permission === "granted" ? "activas" : "apagadas";
}

const llave = (b64: string) => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function guardarSuscripcion(ownerId: string, sub: PushSubscription) {
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from("push_suscripciones").upsert(
    {
      owner_id: ownerId,
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      origen: window.location.origin,
      agente: navigator.userAgent.slice(0, 200),
      activa: true,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

// Pide permiso (tiene que ser al tocar un botón) y guarda este dispositivo.
export async function activarNotificaciones(ownerId: string): Promise<EstadoNotif> {
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return permiso === "denied" ? "bloqueadas" : "apagadas";
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llave(VAPID_PUBLICA) }));
  await guardarSuscripcion(ownerId, sub);
  return "activas";
}

// Al abrir la app ya activada: vuelve a guardar el dispositivo por si el
// iPhone renovó la suscripción.
export async function refrescarSuscripcion(ownerId: string) {
  try {
    if ((await estadoNotificaciones()) !== "activas") return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) await guardarSuscripcion(ownerId, sub);
  } catch (e) {
    console.error("No se pudo refrescar la suscripción", e);
  }
}

export async function apagarNotificaciones() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  await supabase.from("push_suscripciones").update({ activa: false }).eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function mandarPrueba(): Promise<number | null> {
  const { data, error } = await supabase.functions.invoke("notificaciones", { body: { prueba: true } });
  if (error) {
    console.error("No se pudo mandar la prueba", error);
    return null;
  }
  return (data as { enviados?: number })?.enviados ?? 0;
}
