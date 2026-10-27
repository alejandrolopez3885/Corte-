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
// - Además de los gastos en efectivo trae los de transferencia, por tipo,
//   para Negocio › Control de gastos en transferencia (y la nómina en
//   transferencia, que sale de Equipo › Nómina).
// - "Ver comprobante" (dueño o personal): { accion: "comprobante", id } (un
//   gasto) o { accion: "comprobante", fecha } (el bancario de ese día)
//   devuelve la foto tal como la muestra el bot.
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

async function entrar(usuario: string, password: string) {
  // Render duerme el servidor: el primer intento puede tardar ~1 minuto.
  const login = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: usuario, password }),
  });
  if (!login.ok) throw new Error(login.status === 401 ? "Usuario o contraseña de Johnster incorrectos" : `Johnster no respondió (${login.status})`);
  const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const yo = (await login.json()) as { branchName?: string };
  return { cookie, yo };
}

async function traer(usuario: string, password: string) {
  const { cookie, yo } = await entrar(usuario, password);
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
      // Débito + crédito: los dos juntos son el total del banco.
      tarjetas: pesos(Number(i.tarjetaDebito || 0) + Number(i.tarjetaCredito || 0)),
      tarjetaDebito: pesos(i.tarjetaDebito),
      tarjetaCredito: pesos(i.tarjetaCredito),
      comprobanteBancario: !!i.comprobante,
      // El bancario vive en Google Drive: la app solo abre el link.
      comprobanteUrl: typeof i.comprobante === "string" && /^https:\/\/drive\.google\.com\//.test(i.comprobante) ? i.comprobante : null,
      transferencias: pesos(i.transferencia),
      efectivo: pesos(i.efectivo),
    }));
  const esNomina = (e: Ingreso) => /n[oó]mina/i.test(String(e.gastoDestino || ""));
  const gastos = expenses
    .filter((e) => mismaSucursal(sucursal, e.branchName) && e.paymentMethod === "Efectivo" && fechaDe(e.date || e.createdAt) >= desde)
    .map((e) => ({
      id: String(e.id),
      fecha: fechaDe(e.date || e.createdAt),
      monto: pesos(e.amount),
      concepto: String(e.concept || ""),
      destino: String(e.gastoDestino || e.category || ""),
      // Operación (proveedores), Nómina (adelantos, comidas, pago con efectivo) u otro.
      tipo: e.expenseType === "Operación" ? "operacion" : esNomina(e) ? "nomina" : "otro",
      comprobante: !!e.receiptUrl,
      comprobanteUrl: e.receiptUrl ? String(e.receiptUrl) : null,
    }));
  // Transferencias: operación (proveedores) y los gastos de la semana que
  // se confirman (gastos fijos, comisión bancaria y comisiones de apps).
  const tipoDe = (e: Ingreso) => {
    if (e.expenseType === "Operación") return "operacion";
    if (esNomina(e)) return "nomina";
    const destino = String(e.gastoDestino || "").toLowerCase();
    const concepto = String(e.concept || "").toLowerCase();
    if (destino.includes("gastos fijos") || destino.includes("gasto fijo")) return "fijos";
    if (destino.includes("bancaria")) return "bancaria";
    if (destino.includes("aplicaciones")) return concepto.includes("didi") ? "didi" : concepto.includes("uber") ? "uber" : concepto.includes("rappi") ? "rappi" : "otro";
    return "otro";
  };
  const transferencias = expenses
    .filter((e) => mismaSucursal(sucursal, e.branchName) && e.paymentMethod === "Transferencia" && fechaDe(e.date || e.createdAt) >= desde)
    .map((e) => ({
      id: String(e.id),
      fecha: fechaDe(e.date || e.createdAt),
      monto: pesos(e.amount),
      concepto: String(e.concept || ""),
      tipo: tipoDe(e),
    }));
  return { sucursal, ingresos, gastos, transferencias };
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
    if (!esDueno && !((body?.accion === "semana" || body?.accion === "comprobante") && perfil.role === "staff" && perfil.owner_id)) return json({ error: "Solo el dueño" }, 403);
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

  // Foto de un comprobante: solo de los gastos e ingresos de la sucursal ya
  // guardados en johnster_datos (si falta el link, se actualizan antes).
  if (body?.accion === "comprobante" && ownerId) {
    type Fila = { gastos: { id: string; comprobanteUrl?: string | null }[]; ingresos: { fecha: string; comprobanteUrl?: string | null }[] };
    const buscar = (f: Fila | null) =>
      body.fecha ? f?.ingresos?.find((x) => x.fecha === String(body.fecha))?.comprobanteUrl : f?.gastos?.find((x) => x.id === String(body.id || ""))?.comprobanteUrl;
    try {
      const { data: fila } = await db.from("johnster_datos").select("gastos, ingresos").eq("owner_id", ownerId).maybeSingle();
      let url = buscar(fila as Fila | null);
      if (url === undefined) {
        const datos = await traer(usuario, password);
        await db.from("johnster_datos").update({ ...datos, actualizado_en: new Date().toISOString(), error: null }).eq("owner_id", ownerId);
        url = buscar(datos as Fila);
      }
      if (!url) return json({ error: "No tiene comprobante en el bot" }, 404);
      // Igual que el bot: los suyos tal cual; los de Drive por su image-proxy.
      const ruta = url.startsWith("/api/expenses/") || url.startsWith("/uploads/") ? url : /^https:\/\//.test(url) ? `/api/expenses/image-proxy?url=${encodeURIComponent(url)}` : null;
      if (!ruta) return json({ error: "No se puede abrir ese comprobante" }, 404);
      const { cookie } = await entrar(usuario, password);
      const r = await fetch(BASE + ruta, { headers: { cookie } });
      if (!r.ok || !(r.headers.get("content-type") || "").startsWith("image/"))
        return json({ error: "El bot ya no tiene la foto de este comprobante. Vuelve a subirla en el bot." }, 404);
      return new Response(await r.arrayBuffer(), { headers: { ...cors, "Content-Type": "application/octet-stream" } });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 502);
    }
  }

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
