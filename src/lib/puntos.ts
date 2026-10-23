import { supabase } from "./supabaseClient";
import { addDaysIso } from "./dataModel";
import { calcularRanking, meseroDeEmpleado } from "./ranking";
import { MINIMO_ENCUESTAS, cargarRespuestas, esPrueba, esValida, type RespuestaEncuesta } from "./encuestas";
import type { AppData } from "./types";

// Puntos y logros semanales (ver supabase/migration_014_puntos.sql). Al
// guardar el corte del domingo, la app del dueño cierra la semana con el
// ranking de esa semana: el ganador, los puntos de cada quien y los logros
// nuevos. Los puntos se acumulan (para canjearlos más adelante) y solo los
// ve cada persona y el dueño; el ganador y los logros los ve todo el equipo.

// --- Reglas -----------------------------------------------------------------
export const PUNTOS_LUGAR: Record<number, number> = { 1: 100, 2: 70, 3: 50 };
export const PUNTOS_PARTICIPAR = 20;
export const PUNTOS_SIN_CANCELACIONES = 30;
export const PUNTOS_POR_ENCUESTA = 5;
export const PUNTOS_BUEN_PROMEDIO = 30;
export const BUEN_PROMEDIO = 4.5;
// Mala encuesta: atención de 1 o 2 estrellas.
export const MALA_ATENCION = 2;

export type LogroId = "primer-lugar" | "racha-campeon" | "manos-limpias" | "clientes-felices" | "podio";

export interface DefLogro {
  id: LogroId;
  emoji: string;
  nombre: string;
  niveles: { n: number; puntos: number }[];
  descripcion: (n: number) => string;
}

export const LOGROS: DefLogro[] = [
  { id: "primer-lugar", emoji: "🏆", nombre: "Primer lugar", niveles: [{ n: 1, puntos: 50 }], descripcion: () => "Ganó una semana" },
  {
    id: "racha-campeon",
    emoji: "🔥",
    nombre: "Racha de campeón",
    niveles: [
      { n: 2, puntos: 100 },
      { n: 4, puntos: 200 },
      { n: 8, puntos: 400 },
    ],
    descripcion: (n) => `${n} semanas seguidas en 1er lugar`,
  },
  {
    id: "manos-limpias",
    emoji: "🧼",
    nombre: "Manos limpias",
    niveles: [
      { n: 2, puntos: 50 },
      { n: 4, puntos: 100 },
      { n: 8, puntos: 200 },
    ],
    descripcion: (n) => `${n} semanas seguidas sin cancelaciones`,
  },
  {
    id: "clientes-felices",
    emoji: "😊",
    nombre: "Clientes felices",
    niveles: [
      { n: 2, puntos: 50 },
      { n: 4, puntos: 100 },
      { n: 8, puntos: 200 },
    ],
    descripcion: (n) => `${n} semanas seguidas sin malas encuestas (con ${MINIMO_ENCUESTAS} o más)`,
  },
  {
    id: "podio",
    emoji: "🥉",
    nombre: "Siempre en el podio",
    niveles: [
      { n: 3, puntos: 75 },
      { n: 6, puntos: 150 },
      { n: 12, puntos: 300 },
    ],
    descripcion: (n) => `${n} semanas seguidas en el top 3`,
  },
];
export const TOTAL_LOGROS = LOGROS.reduce((s, l) => s + l.niveles.length, 0);

export const nombreLogro = (l: DefLogro, nivel: number) => (l.niveles.length > 1 && nivel !== l.niveles[0].n ? `${l.nombre} x${nivel}` : l.nombre);
export const emojiLogro = (l: DefLogro, nivel: number) => l.emoji.repeat(Math.max(1, l.niveles.findIndex((x) => x.n === nivel) + 1));

// --- Resultado de una semana ------------------------------------------------
export interface ResultadoSemana {
  meseroId: string;
  nombre: string;
  lugar: number;
  dias: number;
  sinCancelaciones: boolean;
  encuestas: number; // válidas, sin las de prueba
  promedio: number; // atención
  malas: number;
}

export interface SemanaCerrada {
  lunes: string;
  cerrada_en: string;
  ganador_mesero_id: string | null;
  ganador_nombre: string | null;
  resultados: ResultadoSemana[];
}

export interface LogroGanado {
  mesero_id: string;
  nombre: string;
  logro: LogroId;
  nivel: number;
  lunes: string;
}

export interface Movimiento {
  id?: number;
  mesero_id: string;
  nombre: string;
  puntos: number;
  motivo: string;
  tipo: "semana" | "logro" | "ajuste" | "canje";
  lunes: string | null;
  creado_en?: string;
}

const diaMes = (f: string) => String(Number(f.slice(8)));
export const nombreSemana = (lunes: string) => `${diaMes(lunes)}–${diaMes(addDaysIso(lunes, 6))}`;

export function resultadosDeSemana(data: AppData, lunes: string, respuestas: RespuestaEncuesta[]): ResultadoSemana[] {
  const ranking = calcularRanking(data, lunes, addDaysIso(lunes, 6));
  return ranking.filas.map((f) => {
    const suyas = respuestas.filter((r) => r.mesero_id === f.meseroId && !esPrueba(r) && esValida(r));
    return {
      meseroId: f.meseroId,
      nombre: f.nombre,
      lugar: f.lugar,
      dias: f.dias,
      sinCancelaciones: f.cancelaciones === 0,
      encuestas: suyas.length,
      promedio: suyas.length ? Math.round((suyas.reduce((s, r) => s + r.atencion, 0) / suyas.length) * 10) / 10 : 0,
      malas: suyas.filter((r) => r.atencion <= MALA_ATENCION).length,
    };
  });
}

const cumple: Record<Exclude<LogroId, "primer-lugar">, (r: ResultadoSemana) => boolean> = {
  "racha-campeon": (r) => r.lugar === 1,
  "manos-limpias": (r) => r.sinCancelaciones,
  "clientes-felices": (r) => r.encuestas >= MINIMO_ENCUESTAS && r.malas === 0,
  podio: (r) => r.lugar <= 3,
};

// Cuántas semanas seguidas (terminando en esta) cumple, con las semanas ya
// cerradas antes. Una semana sin cerrar o en la que no aparece corta la racha.
export function racha(meseroId: string, lunes: string, actual: ResultadoSemana[], previas: SemanaCerrada[], prueba: (r: ResultadoSemana) => boolean): number {
  const porLunes = new Map(previas.map((s) => [s.lunes, s.resultados]));
  porLunes.set(lunes, actual);
  let n = 0;
  for (let l = lunes; ; l = addDaysIso(l, -7)) {
    const r = porLunes.get(l)?.find((x) => x.meseroId === meseroId);
    if (!r || !prueba(r)) return n;
    n++;
  }
}

export function calcularCierre(lunes: string, resultados: ResultadoSemana[], previas: SemanaCerrada[], yaGanados: LogroGanado[]) {
  const movimientos: Omit<Movimiento, "lunes">[] = [];
  const logros: { meseroId: string; nombre: string; logro: LogroId; nivel: number }[] = [];
  const semana = nombreSemana(lunes);
  const mov = (r: ResultadoSemana, puntos: number, motivo: string, tipo: "semana" | "logro") =>
    movimientos.push({ mesero_id: r.meseroId, nombre: r.nombre, puntos, motivo, tipo });
  for (const r of resultados) {
    const lugar = PUNTOS_LUGAR[r.lugar];
    mov(r, lugar ?? PUNTOS_PARTICIPAR, `Sem. ${semana} · ${lugar ? `${r.lugar === 1 ? "🏆 " : ""}${r.lugar}º lugar` : `${r.lugar}º lugar`}`, "semana");
    if (r.sinCancelaciones) mov(r, PUNTOS_SIN_CANCELACIONES, `Sem. ${semana} · sin cancelaciones`, "semana");
    if (r.encuestas > 0)
      mov(r, r.encuestas * PUNTOS_POR_ENCUESTA, `Sem. ${semana} · ${r.encuestas} ${r.encuestas === 1 ? "encuesta válida" : "encuestas válidas"}`, "semana");
    if (r.encuestas >= MINIMO_ENCUESTAS && r.promedio >= BUEN_PROMEDIO) mov(r, PUNTOS_BUEN_PROMEDIO, `Sem. ${semana} · promedio ⭐ ${r.promedio}`, "semana");

    const tiene = (logro: LogroId, nivel: number) => yaGanados.some((g) => g.mesero_id === r.meseroId && g.logro === logro && g.nivel === nivel);
    for (const def of LOGROS) {
      const llevo = def.id === "primer-lugar" ? (r.lugar === 1 ? 1 : 0) : racha(r.meseroId, lunes, resultados, previas, cumple[def.id]);
      for (const nivel of def.niveles) {
        if (llevo >= nivel.n && !tiene(def.id, nivel.n)) {
          logros.push({ meseroId: r.meseroId, nombre: r.nombre, logro: def.id, nivel: nivel.n });
          mov(r, nivel.puntos, `Logro: ${def.emoji} ${nombreLogro(def, nivel.n)}`, "logro");
        }
      }
    }
  }
  const ganadores = resultados.filter((r) => r.lugar === 1);
  return {
    semana: {
      ganadorMeseroId: ganadores[0]?.meseroId ?? null,
      ganadorNombre: ganadores.map((g) => g.nombre).join(" y ") || null,
      resultados,
    },
    movimientos: movimientos.map((m) => ({ meseroId: m.mesero_id, nombre: m.nombre, puntos: m.puntos, motivo: m.motivo, tipo: m.tipo })),
    logros,
  };
}

// --- Base de datos ----------------------------------------------------------
export async function cargarSemanas(limite = 16): Promise<SemanaCerrada[] | null> {
  const { data, error } = await supabase.from("puntos_semanas").select("*").order("lunes", { ascending: false }).limit(limite);
  if (error) {
    console.error("No se pudieron leer las semanas cerradas", error);
    return null;
  }
  return (data as SemanaCerrada[]) || [];
}

export async function cargarLogros(): Promise<LogroGanado[]> {
  const { data, error } = await supabase.from("puntos_logros").select("mesero_id, nombre, logro, nivel, lunes").eq("anulado", false);
  if (error) {
    console.error("No se pudieron leer los logros", error);
    return [];
  }
  return (data as LogroGanado[]) || [];
}

// Los movimientos que la base deja ver: al dueño, todos; a cada persona,
// solo los suyos.
export async function cargarMovimientos(meseroId?: string): Promise<Movimiento[] | null> {
  const filas: Movimiento[] = [];
  for (let pagina = 0; ; pagina++) {
    let q = supabase.from("puntos_movimientos").select("id, mesero_id, nombre, puntos, motivo, tipo, lunes, creado_en").eq("anulado", false);
    if (meseroId) q = q.eq("mesero_id", meseroId);
    const { data, error } = await q.order("creado_en", { ascending: false }).order("id", { ascending: false }).range(pagina * 1000, pagina * 1000 + 999);
    if (error) {
      console.error("No se pudieron leer los puntos", error);
      return null;
    }
    filas.push(...((data as Movimiento[]) || []));
    if (!data || data.length < 1000) return filas;
  }
}

// Cierra (o recalcula) la semana que empieza en `lunes`.
export async function cerrarSemana(data: AppData, lunes: string): Promise<{ ok: true; ganador: string | null } | { ok: false; error: string }> {
  const respuestas = (await cargarRespuestas(lunes, addDaysIso(lunes, 6))) || [];
  const resultados = resultadosDeSemana(data, lunes, respuestas);
  if (resultados.length === 0) return { ok: false, error: "Nadie entró al ranking esa semana (hacen falta 2 días con venta)." };
  const [semanas, logros] = await Promise.all([cargarSemanas(20), cargarLogros()]);
  if (!semanas) return { ok: false, error: "No se pudieron leer las semanas anteriores. Revisa tu conexión." };
  const previas = semanas.filter((s) => s.lunes < lunes);
  const cierre = calcularCierre(
    lunes,
    resultados,
    previas,
    logros.filter((l) => l.lunes !== lunes)
  );
  const { error } = await supabase.rpc("cerrar_semana_puntos", {
    p_lunes: lunes,
    p_semana: cierre.semana,
    p_movimientos: cierre.movimientos,
    p_logros: cierre.logros,
  });
  if (error) {
    console.error("No se pudo cerrar la semana", error);
    return { ok: false, error: "No se pudo cerrar la semana. Revisa tu conexión e intenta de nuevo." };
  }
  return { ok: true, ganador: cierre.semana.ganadorNombre };
}

export async function ajustarPuntos(ownerId: string, meseroId: string, nombre: string, puntos: number, motivo: string): Promise<boolean> {
  const { error } = await supabase
    .from("puntos_movimientos")
    .insert({ owner_id: ownerId, mesero_id: meseroId, nombre, puntos, motivo: motivo.slice(0, 200), tipo: "ajuste", creado_por: ownerId });
  if (error) console.error("No se pudo guardar el ajuste", error);
  return !error;
}

// Qué cuenta de equipo es qué mesero (para que cada quien vea sus puntos).
// La llena la app del dueño con lo que hay en Personal.
export async function sincronizarCuentasMeseros(data: AppData, ownerId: string) {
  const { data: perfiles, error } = await supabase.from("profiles").select("id, empleado_id").eq("owner_id", ownerId).eq("role", "staff");
  if (error || !perfiles) return;
  const { data: actuales } = await supabase.from("meseros_cuentas").select("mesero_id, profile_id");
  const ya = new Map(((actuales as { mesero_id: string; profile_id: string }[]) || []).map((c) => [c.mesero_id, c.profile_id]));
  const filas = (perfiles as { id: string; empleado_id: string | null }[])
    .map((p) => ({ p, meseroId: meseroDeEmpleado(data, data.empleados.find((e) => e.id === p.empleado_id)) }))
    .filter((x): x is { p: { id: string; empleado_id: string | null }; meseroId: string } => !!x.meseroId && ya.get(x.meseroId) !== x.p.id)
    .map((x) => ({ owner_id: ownerId, mesero_id: x.meseroId, profile_id: x.p.id }));
  if (filas.length === 0) return;
  const { error: e2 } = await supabase.from("meseros_cuentas").upsert(filas, { onConflict: "owner_id,mesero_id" });
  if (e2) console.error("No se pudieron ligar las cuentas a los meseros", e2);
}

// Cuántas semanas seguidas lleva para un logro, hasta la última semana
// cerrada (para "llevas 2 de 4").
export function progresoLogro(def: DefLogro, meseroId: string, semanas: SemanaCerrada[]): number {
  const ultima = [...semanas].sort((a, b) => b.lunes.localeCompare(a.lunes))[0];
  if (!ultima) return 0;
  if (def.id === "primer-lugar") return semanas.some((s) => s.resultados.some((r) => r.meseroId === meseroId && r.lugar === 1)) ? 1 : 0;
  return racha(meseroId, ultima.lunes, ultima.resultados, semanas, cumple[def.id]);
}

// Para el ranking: los logros más altos de cada quien (un emoji por logro).
export function insigniasPorMesero(logros: LogroGanado[]): Map<string, string> {
  const mapa = new Map<string, string>();
  const porMesero = new Map<string, LogroGanado[]>();
  logros.forEach((l) => porMesero.set(l.mesero_id, [...(porMesero.get(l.mesero_id) || []), l]));
  porMesero.forEach((ls, meseroId) => {
    const texto = LOGROS.map((def) => {
      const niveles = ls.filter((l) => l.logro === def.id).map((l) => l.nivel);
      return niveles.length ? emojiLogro(def, Math.max(...niveles)) : "";
    }).join("");
    if (texto) mapa.set(meseroId, texto);
  });
  return mapa;
}
