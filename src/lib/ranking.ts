import { addDaysIso, mondayOnOrBefore, normalizarNombre, round2, todayIso } from "./dataModel";
import { ubicarFechas } from "./inicio";
import type { AppData, EmpleadoEntry, Profile } from "./types";

// Ranking de meseros: un puntaje por periodo con la venta, las
// cancelaciones y las encuestas de cada mesero del corte (solo personas de
// Personal; sin el usuario de para llevar, las apps, "Domicilio" ni "Otro").
//   Venta: la venta promedio por turno da hasta 100 puntos (100 = quien más
//     vende por turno en ese periodo). Un día con corte es 1 turno; si en el
//     Horario dice Z (dobla) y su puesto es de mesero, son 2.
//   Cancelaciones: cada 1% de su venta resta 10.
//   Encuestas (contestadas y válidas): +3 cada una, sin importar la
//     calificación, y según su atención 5⭐ +2 · 4⭐ +1 · 3⭐ 0 · 2⭐ −2 · 1⭐ −4.
// Aparecen desde su primer turno; para ganar la semana (y sus monedas)
// hacen falta 2. El ranking de encuestas usa solo los puntos de encuestas.

export const MINIMO_TURNOS_GANAR = 2;
const PUNTOS_POR_PCT_CANCELACION = 10;
export const PUNTOS_POR_ENCUESTA = 3;
export const PUNTOS_POR_ESTRELLA: Record<1 | 2 | 3 | 4 | 5, number> = { 5: 2, 4: 1, 3: 0, 2: -2, 1: -4 };

// Encuestas de un mesero en el periodo (de la función ranking_encuestas).
export interface EncuestasMesero {
  generadas: number;
  contestadas: number;
  estrellas: Record<1 | 2 | 3 | 4 | 5, number>;
  promedio: number | null;
}

export const puntosDeEncuestas = (e: EncuestasMesero | undefined) =>
  e ? e.contestadas * PUNTOS_POR_ENCUESTA + ([1, 2, 3, 4, 5] as const).reduce((s, n) => s + e.estrellas[n] * PUNTOS_POR_ESTRELLA[n], 0) : 0;

export interface FilaRanking {
  meseroId: string;
  nombre: string;
  empleado?: EmpleadoEntry; // para la foto
  dias: number;
  turnos: number;
  dobles: number;
  venta: number; // total del periodo
  ventaPorTurno: number;
  cancelaciones: number; // total en dinero
  pctCancelacion: number; // 0–100, un decimal
  puntosVenta: number;
  puntosCancelacion: number; // lo que resta (positivo)
  encuestas?: EncuestasMesero;
  puntosEncuestas: number; // puede ser negativo
  puntosCalificacion: number; // la parte por estrellas
  puntos: number;
  lugar: number;
}

export interface Ranking {
  desde: string;
  hasta: string;
  filas: FilaRanking[]; // ya ordenadas
}

// Su persona en Personal: la que tiene ese usuario del sistema o se llama
// igual (o el usuario del sistema es su primer nombre).
export function empleadoDeMesero(data: AppData, meseroId: string, nombre: string): EmpleadoEntry | undefined {
  const n = normalizarNombre(nombre);
  return (
    data.empleados.find((e) => e.usuarioSistemaId === meseroId) ||
    data.empleados.find((e) => normalizarNombre(e.nombre) === n) ||
    data.empleados.find((e) => normalizarNombre(e.nombre).split(" ")[0] === n)
  );
}

// El mesero que es esta cuenta de equipo (para marcar "Tú").
export function meseroDeEmpleado(data: AppData, empleado: EmpleadoEntry | undefined): string | undefined {
  if (!empleado) return undefined;
  if (empleado.usuarioSistemaId && data.meseros.some((m) => m.id === empleado.usuarioSistemaId)) return empleado.usuarioSistemaId;
  const n = normalizarNombre(empleado.nombre);
  const opciones = data.meseros.filter((m) => !m.acumulado);
  return (
    opciones.find((m) => normalizarNombre(m.nombre) === n)?.id ||
    opciones.find((m) => normalizarNombre(m.nombre) === n.split(" ")[0])?.id
  );
}

// Personas del corte: meseros ligados a alguien de Personal (o el dueño).
function esPersona(data: AppData, meseroId: string, nombre: string): boolean {
  if (empleadoDeMesero(data, meseroId, nombre)) return true;
  const n = normalizarNombre(data.perfilDueno?.nombre || "");
  return !!n && (normalizarNombre(nombre) === n || normalizarNombre(nombre) === n.split(" ")[0]);
}

export function calcularRanking(data: AppData, desde: string, hasta: string, encuestas?: Map<string, EncuestasMesero>): Ranking {
  const acumulados = new Set(data.meseros.filter((m) => m.acumulado).map((m) => m.id));
  const ubicaciones = ubicarFechas(data);
  const porMesero = new Map<string, { nombre: string; venta: number; dias: Set<string>; dobles: number; cancelaciones: number }>();
  const de = (id: string, nombre: string) => {
    if (!porMesero.has(id)) porMesero.set(id, { nombre, venta: 0, dias: new Set(), dobles: 0, cancelaciones: 0 });
    return porMesero.get(id)!;
  };
  for (let f = desde; f <= hasta; f = addDaysIso(f, 1)) {
    const u = ubicaciones.get(f);
    const day = u?.day;
    if (!u || !day) continue;
    day.meseros.forEach((m) => {
      if (acumulados.has(m.meseroId)) return;
      const x = de(m.meseroId, data.meseros.find((c) => c.id === m.meseroId)?.nombre || m.nombre);
      x.venta += m.venta;
      if (m.venta > 0) x.dias.add(f);
    });
    day.gastos.forEach((g) => {
      if (g.categoria !== "cancelaciones" || !g.meseroId || acumulados.has(g.meseroId)) return;
      de(g.meseroId, data.meseros.find((c) => c.id === g.meseroId)?.nombre || "Mesero").cancelaciones += g.total;
    });
    // Dobles del horario (Z) de quien es mesero y vendió ese día.
    const semana = data.horarios[u.mk]?.weeks?.[u.wi];
    porMesero.forEach((x, meseroId) => {
      if (!x.dias.has(f) || !semana) return;
      const emp = empleadoDeMesero(data, meseroId, x.nombre);
      const puesto = emp?.puestoId ? data.puestos.find((p) => p.id === emp.puestoId) : undefined;
      if (!emp || !puesto || !normalizarNombre(puesto.nombre).includes("mesero")) return;
      const fila = semana.areas.flatMap((a) => a.filas).find((r) => r.empleadoId === emp.id);
      if ((fila?.valores[u.dia] || "").trim().toUpperCase() === "Z") x.dobles += 1;
    });
  }
  const entran = [...porMesero.entries()].filter(([id, x]) => x.dias.size > 0 && x.venta > 0 && esPersona(data, id, x.nombre));
  const turnosDe = (x: { dias: Set<string>; dobles: number }) => x.dias.size + x.dobles;
  const mejor = Math.max(0, ...entran.map(([, x]) => x.venta / turnosDe(x)));
  const filas = entran
    .map(([meseroId, x]) => {
      const turnos = turnosDe(x);
      const ventaPorTurno = round2(x.venta / turnos);
      const pctCancelacion = Math.round((x.cancelaciones / x.venta) * 1000) / 10;
      const puntosVenta = mejor > 0 ? Math.round((100 * ventaPorTurno) / mejor) : 0;
      const puntosCancelacion = Math.round(pctCancelacion * PUNTOS_POR_PCT_CANCELACION);
      const enc = encuestas?.get(meseroId);
      const puntosEncuestas = puntosDeEncuestas(enc);
      return {
        meseroId,
        nombre: x.nombre,
        empleado: empleadoDeMesero(data, meseroId, x.nombre),
        dias: x.dias.size,
        turnos,
        dobles: x.dobles,
        venta: round2(x.venta),
        ventaPorTurno,
        cancelaciones: round2(x.cancelaciones),
        pctCancelacion,
        puntosVenta,
        puntosCancelacion,
        encuestas: enc,
        puntosEncuestas,
        puntosCalificacion: enc ? puntosEncuestas - enc.contestadas * PUNTOS_POR_ENCUESTA : 0,
        puntos: Math.max(0, puntosVenta - puntosCancelacion + puntosEncuestas),
        lugar: 0,
      };
    })
    .sort((a, b) => b.puntos - a.puntos || b.puntosVenta - a.puntosVenta || a.nombre.localeCompare(b.nombre));
  // Empates: mismo lugar.
  filas.forEach((f, i) => (f.lugar = i > 0 && filas[i - 1].puntos === f.puntos ? filas[i - 1].lugar : i + 1));
  return { desde, hasta, filas };
}

// Ranking de encuestas: por sus puntos de encuestas; al final quien no tiene
// contestadas (primero quien sí generó, luego quien no ha generado).
export function rankingEncuestas(filas: FilaRanking[]): (FilaRanking & { lugarEncuestas: number | null })[] {
  const con = filas.filter((f) => (f.encuestas?.contestadas || 0) > 0).sort(
    (a, b) => b.puntosEncuestas - a.puntosEncuestas || (b.encuestas?.contestadas || 0) - (a.encuestas?.contestadas || 0) || a.nombre.localeCompare(b.nombre)
  );
  const lugares = con.map((f) => ({ ...f, lugarEncuestas: 0 }));
  lugares.forEach((f, i) => (f.lugarEncuestas = i > 0 && lugares[i - 1].puntosEncuestas === f.puntosEncuestas ? lugares[i - 1].lugarEncuestas : i + 1));
  const generaron = filas.filter((f) => !(f.encuestas?.contestadas) && (f.encuestas?.generadas || 0) > 0).map((f) => ({ ...f, lugarEncuestas: null }));
  const nada = filas.filter((f) => !(f.encuestas?.contestadas) && !(f.encuestas?.generadas)).map((f) => ({ ...f, lugarEncuestas: null }));
  return [...lugares, ...generaron, ...nada];
}

export type PeriodoRanking = "semana" | "semanaPasada" | "mes";

export function rangoRanking(periodo: PeriodoRanking, hoy = todayIso()): { desde: string; hasta: string } {
  const lunes = mondayOnOrBefore(hoy);
  if (periodo === "semanaPasada") return { desde: addDaysIso(lunes, -7), hasta: addDaysIso(lunes, -1) };
  if (periodo === "mes") return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  return { desde: lunes, hasta: hoy };
}

// Las cuentas de equipo del área Piso ven el ranking (sin montos), y
// también quien tiene cortes como mesero aunque sea de otra área (ej. de
// barra): ellos juegan en el ranking, las encuestas y los puntos.
export function esDePiso(data: AppData, profile: Profile): boolean {
  const empleado = data.empleados.find((e) => e.id === profile.empleado_id);
  const puesto = empleado?.puestoId ? data.puestos.find((p) => p.id === empleado.puestoId) : undefined;
  const area = puesto ? data.areas.find((a) => a.id === puesto.areaId) : undefined;
  if (area && normalizarNombre(area.nombre) === "piso") return true;
  const meseroId = meseroDeEmpleado(data, empleado);
  return !!meseroId && tieneCortesRecientes(data, meseroId);
}

// Si ese mesero tiene venta en algún corte de los últimos 3 meses del corte.
function tieneCortesRecientes(data: AppData, meseroId: string): boolean {
  return Object.keys(data.months)
    .sort()
    .slice(-3)
    .some((mk) => data.months[mk].weeks.some((w) => Object.values(w?.days || {}).some((d) => d.meseros.some((m) => m.meseroId === meseroId && m.venta > 0))));
}
