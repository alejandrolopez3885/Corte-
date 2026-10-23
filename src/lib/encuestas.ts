import qrcode from "qrcode-generator";
import type { EncuestasMesero } from "./ranking";
import { supabase } from "./supabaseClient";

// Encuestas con QR por mesero (ver supabase/migration_011_encuestas.sql).
// El mesero genera una con el total de la cuenta; el cliente la contesta
// en /?e=<código> sin iniciar sesión, confirmando ese total. Crear,
// contestar y sacar promedios va por funciones de la base que revisan
// todo; los comentarios solo los lee el dueño.

export const MINIMO_ENCUESTAS = 3;
export const MAXIMO_ENCUESTAS_DIA = 15;

// --- Este celular ---------------------------------------------------------
// Un id al azar por celular (para contar una encuesta por celular a la
// semana) y una marca si alguien del equipo inició sesión en él alguna vez.
const LLAVE_DISPOSITIVO = "cortes-dispositivo";
const LLAVE_PERSONAL = "cortes-dispositivo-personal";

function guardado(llave: string): string | null {
  try {
    return localStorage.getItem(llave);
  } catch {
    return null;
  }
}

export function idDispositivo(): string {
  let id = guardado(LLAVE_DISPOSITIVO);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      localStorage.setItem(LLAVE_DISPOSITIVO, id);
    } catch {
      // Sin almacenamiento (incógnito estricto): va sin id.
    }
  }
  return id;
}

export function marcarDispositivoPersonal() {
  try {
    localStorage.setItem(LLAVE_PERSONAL, "1");
  } catch {
    // nada
  }
}
export const esDispositivoPersonal = () => guardado(LLAVE_PERSONAL) === "1";

// --- QR -------------------------------------------------------------------
export const urlEncuesta = (token: string) => `${window.location.origin}/?e=${token}`;

export function svgQr(texto: string): string {
  const qr = qrcode(0, "M");
  qr.addData(texto);
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

// --- Mesero ---------------------------------------------------------------
export interface EncuestaCreada {
  id: string;
  token: string;
  vence_en: string;
}

export async function crearEncuesta(
  total: number,
  mesa: string,
  meseroId: string,
  meseroNombre: string,
  prueba = false
): Promise<{ encuesta?: EncuestaCreada; error?: string; motivo?: MotivoIntento }> {
  // La de prueba la genera el dueño: no cuenta en calificaciones ni ranking.
  const { data, error } = prueba
    ? await supabase.rpc("crear_encuesta_prueba", { p_total: total, p_mesa: mesa, p_nombre: meseroNombre })
    : await supabase.rpc("crear_encuesta", { p_total: total, p_mesa: mesa, p_mesero_id: meseroId, p_mesero_nombre: meseroNombre });
  if (error) {
    console.error("No se pudo crear la encuesta", error);
    const msg = error.message || "";
    if (msg.includes("30 encuestas de prueba")) return { error: "Ya generaste las 30 encuestas de prueba de hoy.", motivo: "limite" };
    if (msg.includes("15 encuestas")) return { error: `Ya generaste las ${MAXIMO_ENCUESTAS_DIA} encuestas de hoy.`, motivo: "limite" };
    if (msg.includes("total")) return { error: "Escribe el total de la cuenta.", motivo: "sin-total" };
    if (msg.includes("mesa")) return { error: "Escribe la mesa.", motivo: "sin-mesa" };
    if (error.code === "PGRST202" || error.code === "42883") return { error: "Las encuestas todavía no están activas.", motivo: "otro" };
    const sinRed = !error.code || msg.includes("Failed to fetch") || msg.includes("NetworkError");
    return { error: "No se pudo crear la encuesta. Revisa tu conexión e intenta de nuevo.", motivo: sinRed ? "conexion" : "otro" };
  }
  const fila = (Array.isArray(data) ? data[0] : data) as EncuestaCreada | undefined;
  return fila ? { encuesta: fila } : { error: "No se pudo crear la encuesta.", motivo: "otro" };
}

// Intento que no se generó (sin total, sin mesa, sin ligar, límite, sin conexión):
// queda en el seguimiento del dueño. Si no hay conexión se guarda en este
// celular y se manda en el siguiente intento.
export type MotivoIntento = "sin-total" | "sin-mesa" | "sin-ligar" | "limite" | "conexion" | "otro";
const LLAVE_INTENTOS = "cortes-intentos-encuesta";
interface IntentoPendiente {
  motivo: MotivoIntento;
  meseroId: string | null;
  meseroNombre: string;
  cuando: string;
}

function intentosPendientes(): IntentoPendiente[] {
  try {
    return JSON.parse(guardado(LLAVE_INTENTOS) || "[]") as IntentoPendiente[];
  } catch {
    return [];
  }
}
function guardarPendientes(lista: IntentoPendiente[]) {
  try {
    if (lista.length) localStorage.setItem(LLAVE_INTENTOS, JSON.stringify(lista.slice(-30)));
    else localStorage.removeItem(LLAVE_INTENTOS);
  } catch {
    // nada
  }
}

async function mandarIntento(i: IntentoPendiente): Promise<boolean> {
  const { error } = await supabase.rpc("registrar_intento_encuesta", {
    p_motivo: i.motivo,
    p_mesero_id: i.meseroId,
    p_mesero_nombre: i.meseroNombre,
    p_cuando: i.cuando,
  });
  if (error) console.error("No se pudo guardar el intento de encuesta", error);
  return !error;
}

export async function registrarIntento(motivo: MotivoIntento, meseroId: string | null, meseroNombre: string) {
  const intento = { motivo, meseroId, meseroNombre, cuando: new Date().toISOString() };
  if (!(await mandarIntento(intento))) guardarPendientes([...intentosPendientes(), intento]);
}

export async function enviarIntentosPendientes() {
  const lista = intentosPendientes();
  if (!lista.length) return;
  const quedan: IntentoPendiente[] = [];
  for (const i of lista) if (!(await mandarIntento(i))) quedan.push(i);
  guardarPendientes(quedan);
}

export async function cancelarEncuesta(id: string) {
  const { error } = await supabase.rpc("cancelar_encuesta", { p_id: id });
  if (error) console.error("No se pudo cancelar la encuesta", error);
}

export async function estadoEncuesta(id: string): Promise<"abierta" | "respondida" | "cancelada" | "vencida" | null> {
  const { data, error } = await supabase.from("encuestas").select("respondida_en, cancelada, vence_en").eq("id", id).maybeSingle();
  if (error || !data) return null;
  if (data.respondida_en) return "respondida";
  if (data.cancelada) return "cancelada";
  return new Date(data.vence_en).getTime() < Date.now() ? "vencida" : "abierta";
}

// Cuántas generó hoy esta cuenta.
export async function encuestasDeHoy(perfilId: string): Promise<number> {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("encuestas")
    .select("id", { count: "exact", head: true })
    .eq("creado_por", perfilId)
    .gte("creado_en", inicio.toISOString());
  return error ? 0 : count || 0;
}

// Promedio de atención y cuántas válidas por mesero (sin comentarios).
export async function calificaciones(desde: string, hasta: string): Promise<Map<string, { promedio: number; cantidad: number }>> {
  const { data, error } = await supabase.rpc("calificaciones", { p_desde: desde, p_hasta: hasta });
  const mapa = new Map<string, { promedio: number; cantidad: number }>();
  if (error) {
    console.error("No se pudieron leer las calificaciones", error);
    return mapa;
  }
  ((data as { mesero_id: string; promedio: number; cantidad: number }[]) || []).forEach((f) =>
    mapa.set(f.mesero_id, { promedio: Number(f.promedio), cantidad: Number(f.cantidad) })
  );
  return mapa;
}

// Encuesta contestada, como la llenó el cliente: la abre el dueño (desde
// sus respuestas) o el mesero (solo las suyas que cuentan, ver mis_encuestas).
export interface EncuestaContestada {
  encuesta_id: string;
  mesero_nombre: string;
  atencion: number;
  comida: number;
  rapidez: number;
  comentario: string | null;
  total_cliente: number;
  mesa: string | null;
  respondida_en: string;
}

// Las encuestas del mesero que cuentan para su calificación (sin prueba
// ni sospechosas), con su comentario, de la más nueva a la más vieja.
export async function misEncuestas(desde: string, hasta: string): Promise<EncuestaContestada[] | null> {
  const { data, error } = await supabase.rpc("mis_encuestas", { p_desde: desde, p_hasta: hasta });
  if (error) {
    console.error("No se pudieron leer tus encuestas", error);
    return null;
  }
  return ((data as EncuestaContestada[]) || []).map((r) => ({ ...r, total_cliente: Number(r.total_cliente) }));
}

// --- Cliente ----------------------------------------------------------------
export async function encuestaPublica(token: string): Promise<{ mesero_nombre: string; estado: string } | null | "error"> {
  const { data, error } = await supabase.rpc("encuesta_publica", { p_token: token });
  if (error) return "error";
  const fila = Array.isArray(data) ? data[0] : data;
  return (fila as { mesero_nombre: string; estado: string }) || null;
}

// El cliente empezó a contestar (primera estrella o el total).
export async function empezarEncuesta(token: string) {
  const { error } = await supabase.rpc("empezar_encuesta", { p_token: token });
  if (error) console.error("No se pudo marcar la encuesta como empezada", error);
}

export async function responderEncuesta(
  token: string,
  r: { total: number; atencion: number; comida: number; rapidez: number; comentario: string; segundos: number }
): Promise<string> {
  const { data, error } = await supabase.rpc("responder_encuesta", {
    p_token: token,
    p_total: r.total,
    p_atencion: r.atencion,
    p_comida: r.comida,
    p_rapidez: r.rapidez,
    p_comentario: r.comentario,
    p_dispositivo: idDispositivo(),
    p_dispositivo_personal: esDispositivoPersonal(),
    p_segundos: r.segundos,
  });
  if (error) {
    console.error("No se pudo enviar la encuesta", error);
    return "error";
  }
  return String(data);
}

// --- Dueño ------------------------------------------------------------------
export interface RespuestaEncuesta {
  encuesta_id: string;
  mesero_id: string;
  mesero_nombre: string;
  atencion: number;
  comida: number;
  rapidez: number;
  comentario: string | null;
  total_cliente: number;
  segundos: number | null;
  motivos: string[];
  revision: "aprobada" | "descartada" | null;
  respondida_en: string;
  encuestas: { total: number; mesa: string | null; prueba?: boolean } | null;
}

export const esPrueba = (r: Pick<RespuestaEncuesta, "encuestas">) => !!r.encuestas?.prueba;

export const esValida = (r: Pick<RespuestaEncuesta, "motivos" | "revision">) =>
  r.revision !== "descartada" && (r.motivos.length === 0 || r.revision === "aprobada");

export const MOTIVOS: Record<string, string> = {
  total: "el total no coincide",
  personal: "celular del personal",
  rapida: "contestada muy rápido",
  repetido: "el mismo celular ya contestó esta semana",
  horario: "fuera de horario",
  venta: "sus encuestas del día pasan su venta del corte",
};

export async function cargarRespuestas(desde: string, hasta: string): Promise<RespuestaEncuesta[] | null> {
  const fin = new Date(`${hasta}T00:00:00`);
  fin.setDate(fin.getDate() + 1);
  const { data, error } = await supabase
    .from("encuesta_respuestas")
    .select("*, encuestas(total, mesa, prueba)")
    .gte("respondida_en", new Date(`${desde}T00:00:00`).toISOString())
    .lt("respondida_en", fin.toISOString())
    .order("respondida_en", { ascending: false });
  if (error) {
    console.error("No se pudieron leer las encuestas", error);
    return null;
  }
  return (data as RespuestaEncuesta[]) || [];
}

export async function revisarRespuesta(encuestaId: string, revision: "aprobada" | "descartada" | null) {
  const { error } = await supabase.from("encuesta_respuestas").update({ revision }).eq("encuesta_id", encuestaId);
  if (error) console.error("No se pudo revisar la encuesta", error);
  return !error;
}

export async function agregarMotivo(encuestaId: string, motivos: string[]) {
  const { error } = await supabase.from("encuesta_respuestas").update({ motivos }).eq("encuesta_id", encuestaId);
  if (error) console.error("No se pudo marcar la encuesta", error);
}

// Encuestas de prueba del dueño: cuántas hay y borrarlas (una, o todas sin
// id). Se van con su respuesta y sus pasos del seguimiento; las de los
// meseros no se pueden borrar (lo revisa borrar_encuestas_prueba).
export async function contarPruebas(): Promise<number> {
  const { count, error } = await supabase.from("encuestas").select("id", { count: "exact", head: true }).eq("prueba", true);
  if (error) console.error("No se pudieron contar las pruebas", error);
  return count || 0;
}

export async function borrarPruebas(id?: string): Promise<boolean> {
  const { error } = await supabase.rpc("borrar_encuestas_prueba", { p_id: id ?? null });
  if (error) console.error("No se pudieron borrar las pruebas", error);
  return !error;
}

// Encuestas de cada mesero para el ranking (todos lo pueden leer: sin
// comentarios). Mapa mesero → generadas, contestadas y estrellas.
export async function encuestasParaRanking(desde: string, hasta: string): Promise<Map<string, EncuestasMesero>> {
  const mapa = new Map<string, EncuestasMesero>();
  const { data, error } = await supabase.rpc("ranking_encuestas", { p_desde: desde, p_hasta: hasta });
  if (error) {
    console.error("No se pudieron leer las encuestas del ranking", error);
    return mapa;
  }
  (
    (data as { mesero_id: string; generadas: number; contestadas: number; e1: number; e2: number; e3: number; e4: number; e5: number; promedio: number | null }[]) || []
  ).forEach((f) =>
    mapa.set(f.mesero_id, {
      generadas: Number(f.generadas),
      contestadas: Number(f.contestadas),
      estrellas: { 1: Number(f.e1), 2: Number(f.e2), 3: Number(f.e3), 4: Number(f.e4), 5: Number(f.e5) },
      promedio: f.promedio === null ? null : Number(f.promedio),
    })
  );
  return mapa;
}
