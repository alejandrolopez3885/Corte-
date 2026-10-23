// Función "notificaciones" de Supabase (ver migration_018_notificaciones).
// - pg_cron la llama cada 5 minutos con el header x-cron: revisa qué avisos
//   le tocan a cada dueño con iPhone activado y los manda (una sola vez cada uno).
// - La app del dueño la llama con su sesión y { prueba: true } para mandar
//   una notificación de prueba.
// La lógica de qué avisar vive en src/lib/notificacionesLogica.ts y se
// empaqueta como logica.js al publicar la función.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { avisosPendientes } from "./logica.js";
import { enviarPush, type Suscripcion } from "./webpush.ts";

const VAPID_PUBLICA = "BAjNJrgec7R51ZxI7cQvLRb6gJJAZvUwPNnoY3Xn5izvr708sBmG3plJ0ZttXF9us5zXCPbCbUqOig2RhYkx-2Q";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const secreto = async (nombre: string) => (await db.rpc("secreto_notificaciones", { p_nombre: nombre })).data as string | null;

  const privada = await secreto("notif_vapid_privada");
  if (!privada) return json({ error: "Falta la llave VAPID" }, 500);
  const privadaJwk = JSON.parse(privada) as JsonWebKey;

  async function mandar(ownerId: string, titulo: string, cuerpo: string, url: string, etiqueta: string) {
    const { data: subs } = await db.from("push_suscripciones").select("id, endpoint, p256dh, auth, origen").eq("owner_id", ownerId).eq("activa", true);
    let enviados = 0;
    for (const s of (subs || []) as (Suscripcion & { id: number; origen: string | null })[]) {
      try {
        const status = await enviarPush(s, { titulo, cuerpo, url, etiqueta }, { publica: VAPID_PUBLICA, privadaJwk, contacto: s.origen || "https://cortes.app" });
        if (status === 404 || status === 410) await db.from("push_suscripciones").update({ activa: false }).eq("id", s.id);
        else if (status < 300) enviados++;
        else console.error("Push rechazado", status, s.endpoint.slice(0, 40));
      } catch (e) {
        console.error("No se pudo mandar", e);
      }
    }
    return enviados;
  }

  const body = await req.json().catch(() => ({}));

  // Prueba desde la app: solo el dueño, a sus propios dispositivos.
  if (body?.prueba) {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    const { data: perfil } = u?.user ? await db.from("profiles").select("id, role").eq("id", u.user.id).maybeSingle() : { data: null };
    if (!perfil || perfil.role !== "owner") return json({ error: "Solo el dueño" }, 403);
    const enviados = await mandar(perfil.id, "🔔 Prueba de Cortes", "Así te llegarán los avisos de conteos y gastos.", "/", "prueba");
    return json({ enviados });
  }

  // Revisión programada (pg_cron).
  if (req.headers.get("x-cron") !== (await secreto("notif_cron"))) return json({ error: "No autorizado" }, 401);
  const { data: duenos } = await db.from("push_suscripciones").select("owner_id").eq("activa", true);
  const ids = [...new Set(((duenos || []) as { owner_id: string }[]).map((d) => d.owner_id))];
  const ahora = new Date();
  let total = 0;
  for (const ownerId of ids) {
    const { data: fila } = await db.from("app_data").select("data").eq("owner_id", ownerId).maybeSingle();
    if (!fila?.data) continue;
    const avisos = avisosPendientes(fila.data, ahora);
    if (!avisos.length) continue;
    const { data: ya } = await db.from("notif_enviadas").select("clave").eq("owner_id", ownerId).in("clave", avisos.map((a) => a.clave));
    const enviadas = new Set(((ya || []) as { clave: string }[]).map((x) => x.clave));
    for (const a of avisos.filter((x) => !enviadas.has(x.clave))) {
      // Se marca antes de mandar: si dos revisiones se cruzan, solo una lo manda.
      const { error } = await db.from("notif_enviadas").insert({ owner_id: ownerId, clave: a.clave, titulo: a.titulo });
      if (error) continue;
      total += await mandar(ownerId, a.titulo, a.cuerpo, a.url, a.clave.split(":").slice(0, 2).join(":"));
    }
  }
  return json({ duenos: ids.length, enviados: total });
});
