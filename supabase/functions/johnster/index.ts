// Función "johnster" de Supabase (ver migration_021_johnster): trae de
// Johnster Bot los ingresos por día y los gastos en efectivo de la sucursal
// del dueño y los guarda en johnster_datos, para Corte › ⚖︎ Cuadrar.
// - pg_cron la llama cada mañana con el header x-cron.
// - La app del dueño la llama con su sesión (botón ↻).
// - "Conectar con Johnster" en la app: { accion: "conectar", usuario,
//   password } prueba que entren y las guarda en Vault (solo el dueño).
// - Guardar corte (dueño o personal): { accion: "semana", desde, hasta }
//   actualiza y devuelve solo esos días, para revisar el corte antes de
//   cerrarlo.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const BASE = "https://johnster-bot.onrender.com";
const DIAS = 120;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Ingreso = Record<string, unknown>;
const pesos = (c: unknown) => Math.round(Number(c || 0)) / 100;
const fechaDe = (v: unknown) => String(v || "").slice(0, 10);
const mismaSucursal = (mia: string, otra: unknown) => {
  const a = mia.toLowerCase().replace(/^johnster\s+/, "").trim();
  const b = String(otra || "").toLowerCase().replace(/^johnster\s+/, "").trim();
  return !!a && !!b && (a.includes(b) || b.includes(a));
};

async function traer(usuario: string, password: string) {
  // Render duerme el servidor: el primer intento puede tardar ~1 minuto.
  const login = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: usuario, password }),
  });
  if (!login.ok) throw new Error(login.status === 401 ? "Usuario o contraseña de Johnster incorrectos" : `Johnster no respondió (${login.status})`);
  const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const yo = (await login.json()) as { branchName?: string };
  const pedir = async (ruta: string) => {
    const r = await fetch(BASE + ruta, { headers: { cookie } });
    if (!r.ok) throw new Error(`Johnster ${ruta}: ${r.status}`);
    return (await r.json()) as Ingreso[];
  };
  const [incomes, expenses] = await Promise.all([pedir("/api/incomes"), pedir("/api/expenses")]);
  const sucursal = yo.branchName || "";
  const desde = new Date(Date.now() - DIAS * 864e5).toISOString().slice(0, 10);
  const ingresos = incomes
    .filter((i) => mismaSucursal(sucursal, i.branchName) && fechaDe(i.date) >= desde)
    .map((i) => ({
      fecha: fechaDe(i.date),
      venta: pesos(i.totalVenta),
      ventaSala: pesos(i.ventaJohnster),
      apps: pesos(i.totalApps),
      tarjetas: pesos(Number(i.tarjetaDebito || 0) + Number(i.tarjetaCredito || 0)),
      transferencias: pesos(i.transferencia),
      efectivo: pesos(i.efectivo),
    }));
  const gastos = expenses
    .filter((e) => mismaSucursal(sucursal, e.branchName) && e.paymentMethod === "Efectivo" && fechaDe(e.date || e.createdAt) >= desde)
    .map((e) => ({
      id: String(e.id),
      fecha: fechaDe(e.date || e.createdAt),
      monto: pesos(e.amount),
      concepto: String(e.concept || ""),
      destino: String(e.gastoDestino || e.category || ""),
    }));
  return { sucursal, ingresos, gastos };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const secreto = async (nombre: string) => (await db.rpc("secreto_johnster", { p_nombre: nombre })).data as string | null;
  const body = await req.json().catch(() => ({}));

  // pg_cron (todas las cuentas conectadas), el dueño con su sesión o, solo
  // para revisar días al guardar el corte, alguien de su equipo.
  let ownerId: string | null = null;
  let esDueno = false;
  if (req.headers.get("x-cron")) {
    if (req.headers.get("x-cron") !== (await secreto("johnster_cron"))) return json({ error: "No autorizado" }, 401);
  } else {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    const { data: perfil } = u?.user ? await db.from("profiles").select("id, role, owner_id").eq("id", u.user.id).maybeSingle() : { data: null };
    if (!perfil) return json({ error: "Solo el dueño" }, 403);
    esDueno = perfil.role === "owner";
    if (!esDueno && !(body?.accion === "semana" && perfil.role === "staff" && perfil.owner_id)) return json({ error: "Solo el dueño" }, 403);
    ownerId = esDueno ? perfil.id : perfil.owner_id;
  }

  // "Conectar con Johnster" (desde la app): guarda usuario y contraseña en
  // Vault; primero se prueba que entren.
  if (body?.accion === "conectar" && ownerId && esDueno) {
    const u = String(body.usuario || "").trim();
    const p = String(body.password || "");
    if (!u || !p) return json({ error: "Escribe usuario y contraseña" }, 400);
    try {
      const datos = await traer(u, p);
      await db.rpc("guardar_secreto_johnster", { p_nombre: "johnster_usuario", p_valor: u });
      await db.rpc("guardar_secreto_johnster", { p_nombre: "johnster_password", p_valor: p });
      await db.from("johnster_datos").upsert({ owner_id: ownerId, ...datos, actualizado_en: new Date().toISOString(), error: null }, { onConflict: "owner_id" });
      return json({ sucursal: datos.sucursal, ingresos: datos.ingresos.length, gastos: datos.gastos.length });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  const usuario = await secreto("johnster_usuario");
  const password = await secreto("johnster_password");
  if (!usuario || !password) return json({ error: "Faltan las credenciales de Johnster" }, 400);
  const { data: filas } = await db.from("johnster_datos").select("owner_id");
  try {
    const datos = await traer(usuario, password);
    const actualizado_en = new Date().toISOString();
    for (const f of (filas || []) as { owner_id: string }[])
      await db.from("johnster_datos").update({ ...datos, actualizado_en, error: null }).eq("owner_id", f.owner_id);
    if (body?.accion === "semana") {
      const desde = String(body.desde || ""), hasta = String(body.hasta || "");
      const enRango = (x: { fecha: string }) => x.fecha >= desde && x.fecha <= hasta;
      return json({ sucursal: datos.sucursal, actualizado_en, error: null, ingresos: datos.ingresos.filter(enRango), gastos: datos.gastos.filter(enRango) });
    }
    return json({ sucursal: datos.sucursal, ingresos: datos.ingresos.length, gastos: datos.gastos.length });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    for (const f of (filas || []) as { owner_id: string }[]) await db.from("johnster_datos").update({ error }).eq("owner_id", f.owner_id);
    return json({ error }, 502);
  }
});
