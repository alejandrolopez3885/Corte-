import { DAYS, DAY_SHORT, HORARIO_AREAS_FIJAS } from "./types";
import type { AppData, ConteoTextoArea, DayName, HorarioSemana, PermisoStaff, Profile, Receta, StaffAssignment } from "./types";
import {
  addDaysIso,
  money,
  computeNominaHastaHoyPorEmpleado,
  computeNominaSemana,
  computeWeekSummary,
  efectivoDelDia,
  esCantidadValida,
  insumoAreaForPuesto,
  leerConteoTexto,
  mondayOnOrBefore,
  normalizarNombre,
  pluralizarUnidad,
  quienesAbren,
  repartoPropinas,
  round2,
  turnosActivos,
} from "./dataModel";
import { ubicarFechas } from "./inicio";
import { calcularRanking, esDePiso, meseroDeEmpleado, rangoRanking } from "./ranking";
import { faltantesDelCorte } from "../components/modals/GuardarCorteModal";
import {
  PREGUNTAS,
  buscarPersona,
  fechaLarga,
  plural,
  sinCentavos,
  type Consulta,
  type PreguntaId,
  type Respuesta,
  type SeccionPregunta,
  type Sugerencia,
} from "./preguntas";

// Pregúntale a Cortes para el personal: cada quien pregunta solo de las
// secciones a las que ya tiene acceso (sus permisos y sus días de corte),
// con respuestas armadas con su propia información — su nómina, su corte,
// el horario de su área, las recetas de su área. Las propinas solo las ven
// Bar y Cocina (el total y lo que le toca a su área, nunca por persona).

export interface ContextoEquipo {
  empleadoId: string;
  nombre: string;
  permisos: PermisoStaff[];
  corteFechas: string[];
  horarioAreaId?: string; // "piso" | "cocina"
  areaInsumo: ConteoTextoArea | null; // por su puesto: Bar o Cocina
  verPropinas: boolean;
  // Área Piso: ve el ranking de meseros (sin montos). Su usuario del corte.
  esPiso?: boolean;
  miMeseroId?: string;
}

// Siempre regresa un contexto: una cuenta sin persona en Personal (p. ej.
// un mesero con días asignados) solo pregunta de su corte.
export function contextoEquipo(profile: Profile, data: AppData, assignments: StaffAssignment[]): ContextoEquipo {
  const corteFechas = assignments.map((a) => a.assigned_date).sort();
  const empleado = profile.empleado_id ? data.empleados.find((e) => e.id === profile.empleado_id) : undefined;
  if (!empleado) return { empleadoId: "", nombre: profile.display_name || "", permisos: [], corteFechas, areaInsumo: null, verPropinas: false };
  const esPiso = esDePiso(data, profile);
  const puesto = empleado.puestoId ? data.puestos.find((p) => p.id === empleado.puestoId) : undefined;
  const area = puesto ? data.areas.find((a) => a.id === puesto.areaId) : undefined;
  const permisos = profile.permisos || [];
  const areaInsumo = insumoAreaForPuesto(puesto?.nombre || "") ?? insumoAreaForPuesto(area?.nombre || "");
  return {
    empleadoId: empleado.id,
    nombre: empleado.nombre,
    permisos,
    corteFechas,
    horarioAreaId: area ? HORARIO_AREAS_FIJAS.find((a) => a.nombre.toLowerCase() === area.nombre.toLowerCase())?.id : undefined,
    areaInsumo,
    verPropinas: permisos.includes("propinas") && !!areaInsumo,
    esPiso,
    miMeseroId: esPiso ? meseroDeEmpleado(data, empleado) : undefined,
  };
}

export function seccionesEquipo(ctx: ContextoEquipo): SeccionPregunta[] {
  return [
    ...(ctx.corteFechas.length ? (["corte"] as const) : []),
    ...ctx.permisos.filter((p) => p !== "propinas" || ctx.verPropinas),
    ...(ctx.esPiso ? (["ranking"] as const) : []),
  ];
}

// Preguntas que le tocan: las de sus secciones. Propinas: las de siempre
// (hoy, la semana, la semana pasada), pero respondidas solo con su área.
const PROPINAS_EQUIPO: PreguntaId[] = ["propinas-hoy", "propinas-semana", "propinas-semana-pasada"];
export function preguntasDeEquipo(ctx: ContextoEquipo) {
  const secciones = seccionesEquipo(ctx);
  return PREGUNTAS.filter((p) => {
    if (PROPINAS_EQUIPO.includes(p.id)) return ctx.verPropinas;
    if (p.seccion === "dueno") return false;
    if (p.id === "conteo-pedido" && ctx.areaInsumo === "bar") return false; // Bar no hace pedido diario
    if ((p.id === "conteo-falta" || p.id === "conteo-pedido") && !ctx.areaInsumo) return false;
    if (p.grupo === "Horario" && !ctx.horarioAreaId) return false;
    return secciones.includes(p.seccion);
  }).map((p) => (PROPINAS_EQUIPO.includes(p.id) ? { ...p, grupo: "Propinas" as const } : p));
}

// Orden de las secciones mientras no haya uso registrado.
const PRIORIDAD: SeccionPregunta[] = ["corte", "nomina", "recetario", "propinas", "horarios", "conteo_diario", "inventario"];

// Arriba: una pregunta de cada sección, empezando por la que más abre esta
// persona (se cuenta en su cuenta cada vez que entra a una sección).
export function inicialesEquipo(ctx: ContextoEquipo, seccionesUso: Partial<Record<string, number>>): PreguntaId[] {
  const lista = preguntasDeEquipo(ctx);
  const seccionDe = (id: PreguntaId) => (PROPINAS_EQUIPO.includes(id) ? "propinas" : lista.find((p) => p.id === id)?.seccion || "dueno");
  const secciones = [...new Set(lista.map((p) => seccionDe(p.id)))].sort(
    (a, b) => (seccionesUso[b] || 0) - (seccionesUso[a] || 0) || PRIORIDAD.indexOf(a) - PRIORIDAD.indexOf(b)
  );
  const res: PreguntaId[] = [];
  secciones.forEach((s) => {
    const p = lista.find((x) => seccionDe(x.id) === s && !res.includes(x.id));
    if (p) res.push(p.id);
  });
  lista.forEach((p) => res.includes(p.id) || res.push(p.id));
  return res;
}

// Su día de corte: hoy si se lo asignaron, si no el último que ya pasó, si
// no el siguiente.
function fechaCorte(ctx: ContextoEquipo, hoy: string): string {
  const f = ctx.corteFechas;
  if (f.includes(hoy)) return hoy;
  const pasados = f.filter((x) => x < hoy);
  return pasados.length ? pasados[pasados.length - 1] : f[0] || hoy;
}

export function consultaEquipo(id: PreguntaId, hoy: string, ctx: ContextoEquipo): Consulta {
  const pasada = addDaysIso(hoy, -7);
  const manana = addDaysIso(hoy, 1);
  const corte = (sub: string): Consulta => ({ tema: "corte", alcance: "dia", fecha: fechaCorte(ctx, hoy), sub });
  switch (id) {
    case "corte-efectivo":
      return corte("efectivo");
    case "corte-tarjetas":
      return corte("tarjetas");
    case "corte-gastos":
      return corte("gastos");
    case "corte-falta":
      return corte("falta");
    case "corte-abre":
      return corte("abre");
    case "mi-nomina":
      return { tema: "miNomina", alcance: "semana", fecha: hoy, sub: "llevo" };
    case "mi-nomina-pasada":
      return { tema: "miNomina", alcance: "semana", fecha: pasada, sub: "pasada" };
    case "mis-descuentos":
      return { tema: "miNomina", alcance: "semana", fecha: hoy, sub: "descuentos" };
    case "mis-dias":
      return { tema: "miNomina", alcance: "semana", fecha: hoy, sub: "dias" };
    case "horario-hoy":
      return { tema: "horario", alcance: "dia", fecha: hoy, sub: "trabaja" };
    case "horario-manana":
      return { tema: "horario", alcance: "dia", fecha: manana, sub: "trabaja" };
    case "horario-descansa":
      return { tema: "horario", alcance: "dia", fecha: hoy, sub: "descansa" };
    case "horario-abre":
      return { tema: "horario", alcance: "dia", fecha: manana, sub: "abre" };
    case "conteo-falta":
      return { tema: "conteo", alcance: "dia", fecha: hoy, sub: "falta" };
    case "conteo-pedido":
      return { tema: "conteo", alcance: "dia", fecha: hoy, sub: "pedido" };
    case "inventario-estado":
      return { tema: "inventario", alcance: "semana", fecha: hoy, sub: "estado" };
    case "inventario-pedido":
      return { tema: "inventario", alcance: "semana", fecha: hoy, sub: "pedido" };
    case "receta":
      return { tema: "receta", alcance: "dia", fecha: hoy };
    case "mi-ranking":
      return { tema: "ranking", alcance: "semana", fecha: hoy, sub: "mio" };
    case "propinas-semana":
      return { tema: "propinas", alcance: "semana", fecha: hoy };
    case "propinas-semana-pasada":
      return { tema: "propinas", alcance: "semana", fecha: pasada };
    default:
      return { tema: "propinas", alcance: "dia", fecha: hoy };
  }
}

// --- Entender lo que escribe ------------------------------------------

// Hoy, ayer, mañana o un día de la semana (el de esta semana).
function fechaDeTexto(t: string, hoy: string): string | null {
  if (/pasado manana/.test(t)) return addDaysIso(hoy, 2);
  if (/\bmanana\b/.test(t)) return addDaysIso(hoy, 1);
  if (/antier|anteayer/.test(t)) return addDaysIso(hoy, -2);
  if (/\bayer\b/.test(t)) return addDaysIso(hoy, -1);
  if (/\bhoy\b/.test(t)) return hoy;
  const dias = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabados?", "domingos?"];
  const i = dias.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
  return i >= 0 ? addDaysIso(mondayOnOrBefore(hoy), i) : null;
}

export function recetasDe(data: AppData, area: ConteoTextoArea | null): Receta[] {
  return (data.recetas || []).filter((r) => !area || r.area === area);
}

// Una receta mencionada por nombre (completo, o todas sus palabras largas).
export function buscarReceta(t: string, recetas: Receta[]): Receta | undefined {
  const exacta = recetas.find((r) => t.includes(normalizarNombre(r.nombre)));
  if (exacta) return exacta;
  return recetas.find((r) => {
    const palabras = normalizarNombre(r.nombre)
      .split(" ")
      .filter((p) => p.length >= 4);
    return palabras.length > 0 && palabras.every((p) => t.includes(p));
  });
}

// null = no se entendió; "fuera" = pregunta de algo que no está en sus
// secciones (venta, utilidad, la nómina de otros…).
export function entenderPreguntaEquipo(texto: string, hoy: string, data: AppData, ctx: ContextoEquipo): Consulta | "fuera" | null {
  const t = normalizarNombre(texto).replace(/[¿?¡!.,]/g, " ");
  const secciones = seccionesEquipo(ctx);
  const fecha = fechaDeTexto(t, hoy);

  if (secciones.includes("recetario")) {
    const receta = buscarReceta(t, recetasDe(data, ctx.areaInsumo));
    if (receta) return { tema: "receta", alcance: "dia", fecha: hoy, objeto: { id: receta.id, nombre: receta.nombre } };
    if (/receta|como se (prepara|hace|sirve)|preparacion|ingredientes/.test(t)) return { tema: "receta", alcance: "dia", fecha: hoy };
  }
  if (secciones.includes("ranking") && /ranking|lugar|posicion|puntos|quien va (primero|ganando)/.test(t)) {
    return { tema: "ranking", alcance: "semana", fecha: /semana (pasada|anterior)/.test(t) ? addDaysIso(hoy, -7) : hoy, sub: "mio" };
  }
  // La nómina de otra persona nunca se responde.
  if (/nomina|sueldo|toca|gana|pagaron|pagar/.test(t) && buscarOtraPersona(t, data, ctx)) return "fuera";
  if (secciones.includes("nomina")) {
    if (/me pagaron|ya me pago|me (van a )?pagar|semana pasada.*(toco|pago)|(toco|pago).*semana pasada/.test(t))
      return { tema: "miNomina", alcance: "semana", fecha: addDaysIso(hoy, -7), sub: "pasada" };
    if (/adelanto|descuento|tardanza|me descontaron/.test(t)) return { tema: "miNomina", alcance: "semana", fecha: hoy, sub: "descuentos" };
    if (/que dias (trabajo|me toca)|mis dias|cuando descanso|mi descanso|mi horario/.test(t))
      return { tema: "miNomina", alcance: "semana", fecha: hoy, sub: "dias" };
    if (/cuanto llevo|mi nomina|mi sueldo|cuanto me toca|cuanto gano|cuanto voy|nomina/.test(t))
      return { tema: "miNomina", alcance: "semana", fecha: hoy, sub: "llevo" };
  }
  if (secciones.includes("horarios") && ctx.horarioAreaId) {
    if (/mi horario|cuando descanso|que dias trabajo/.test(t)) return { tema: "horario", alcance: "semana", fecha: hoy, sub: "mio" };
    if (/descansa|no viene|libre|off/.test(t)) return { tema: "horario", alcance: "dia", fecha: fecha || hoy, sub: "descansa" };
    if (/quien (abre|dobla)/.test(t) && (fecha !== null || !secciones.includes("corte")))
      return { tema: "horario", alcance: "dia", fecha: fecha || addDaysIso(hoy, 1), sub: "abre" };
    if (/quien (trabaja|viene|entra|esta)|horario/.test(t)) return { tema: "horario", alcance: "dia", fecha: fecha || hoy, sub: "trabaja" };
  }
  if (secciones.includes("corte")) {
    const dia = fecha && ctx.corteFechas.includes(fecha) ? fecha : fechaCorte(ctx, hoy);
    if (/falta|guardar|terminar|cerrar el corte/.test(t) && !/contar/.test(t)) return { tema: "corte", alcance: "dia", fecha: dia, sub: "falta" };
    if (/efectivo|entregar|entrego|sobre/.test(t)) return { tema: "corte", alcance: "dia", fecha: dia, sub: "efectivo" };
    if (/tarjeta|terminal|voucher/.test(t)) return { tema: "corte", alcance: "dia", fecha: dia, sub: "tarjetas" };
    if (/gasto/.test(t)) return { tema: "corte", alcance: "dia", fecha: dia, sub: "gastos" };
    if (/quien (abre|abrio|dobla)/.test(t)) return { tema: "corte", alcance: "dia", fecha: dia, sub: "abre" };
  }
  if (secciones.includes("propinas") && /propina/.test(t)) {
    if (/semana (pasada|anterior)/.test(t)) return { tema: "propinas", alcance: "semana", fecha: addDaysIso(hoy, -7) };
    if (/semana/.test(t)) return { tema: "propinas", alcance: "semana", fecha: hoy };
    return { tema: "propinas", alcance: "dia", fecha: fecha && fecha <= hoy ? fecha : hoy };
  }
  if (secciones.includes("conteo_diario") && ctx.areaInsumo) {
    const insumo = buscarInsumoConteo(t, data, ctx.areaInsumo, hoy);
    if (insumo) return { tema: "conteo", alcance: "dia", fecha: hoy, sub: "insumo", objeto: { id: insumo, nombre: insumo } };
    if (/pedir|pedido/.test(t) && !/inventario/.test(t) && ctx.areaInsumo !== "bar") return { tema: "conteo", alcance: "dia", fecha: hoy, sub: "pedido" };
    if (/conteo|contar/.test(t)) return { tema: "conteo", alcance: "dia", fecha: hoy, sub: "falta" };
  }
  if (secciones.includes("inventario") && /inventario/.test(t)) {
    return { tema: "inventario", alcance: "semana", fecha: hoy, sub: /pedi/.test(t) ? "pedido" : "estado" };
  }
  if (/vend|venta|utilidad|ganancia|nomina|sueldo|le toca|propina|gasto|efectivo|horario|receta|inventario|conteo|descansa|trabaja/.test(t)) return "fuera";
  return null;
}

// "¿cuánto le toca a Pedro?" — la nómina de otra persona no se responde.
function buscarOtraPersona(t: string, data: AppData, ctx: ContextoEquipo): boolean {
  const otra = buscarPersona(t, data.empleados);
  return !!otra && otra.id !== ctx.empleadoId;
}

// Insumos del último conteo de su área, por nombre.
function ultimoConteo(data: AppData, area: ConteoTextoArea, hoy: string): { fecha: string; texto: string } | null {
  const textos = data.conteosDiariosTexto?.[area] || {};
  const fecha = Object.keys(textos)
    .filter((f) => f <= hoy && textos[f]?.trim())
    .sort()
    .pop();
  return fecha ? { fecha, texto: textos[fecha] } : null;
}

function buscarInsumoConteo(t: string, data: AppData, area: ConteoTextoArea, hoy: string): string | undefined {
  const ultimo = ultimoConteo(data, area, hoy);
  if (!ultimo || !/cuanto|habia|hay|queda|conteo/.test(t)) return undefined;
  return leerConteoTexto(ultimo.texto).find((l) => {
    const n = normalizarNombre(l.nombre);
    return n.length >= 3 && new RegExp(`\\b${n.replace(/[^a-z0-9 ]/g, "")}`).test(t);
  })?.nombre;
}

// --- Respuestas ---------------------------------------------------------

const MARCA: Record<string, string> = { X: "X · abre", Z: "Z · dobla", OFF: "Descansa" };
const marca = (v: string) => MARCA[v.toUpperCase()] || v;

function semanaHorario(data: AppData, fecha: string): HorarioSemana | null {
  const u = ubicarFechas(data).get(fecha) || ubicarFechas(data).get(mondayOnOrBefore(fecha));
  return u ? data.horarios[u.mk]?.weeks?.[u.wi] ?? null : null;
}

const diaDe = (fecha: string): DayName => DAYS[(new Date(`${fecha}T00:00:00`).getDay() + 6) % 7];

function nombreDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return "hoy";
  if (fecha === addDaysIso(hoy, 1)) return `mañana (${fechaLarga(fecha)})`;
  if (fecha === addDaysIso(hoy, -1)) return `ayer (${fechaLarga(fecha)})`;
  return `el ${fechaLarga(fecha)}`;
}

// Días de la semana para cambiar la respuesta (los de su corte, o Lun–Dom).
function diasSemana(fecha: string, hoy: string, soloHastaHoy: boolean) {
  const lunes = mondayOnOrBefore(fecha);
  return DAYS.map((d, i) => {
    const f = addDaysIso(lunes, i);
    return { fecha: f, etiqueta: DAY_SHORT[d], futuro: soloHastaHoy && f > hoy };
  });
}

export function responderReceta(data: AppData, c: Consulta, area: ConteoTextoArea | null): Respuesta {
  const recetas = recetasDe(data, area);
  const receta = c.objeto ? recetas.find((r) => r.id === c.objeto!.id) : undefined;
  if (!receta) {
    return {
      titulo: area === "bar" ? "Recetario de Bar" : area === "cocina" ? "Recetario de Cocina" : "Recetario",
      valor: plural(recetas.length, "receta", "recetas"),
      lineas: [recetas.length ? "Toca una o escribe su nombre." : "Todavía no hay recetas."],
      recetas: recetas.map((r) => ({ id: r.id, nombre: r.nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      enlace: { texto: "Ver el recetario", destino: { tipo: "seccion", seccion: "recetario" } },
      consulta: c,
    };
  }
  const renglones = (txt: string) =>
    txt
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  return {
    titulo: `Receta · ${receta.area === "bar" ? "Bar" : "Cocina"}`,
    valor: receta.nombre,
    lineas: receta.vaso ? [`${receta.area === "bar" ? "Vaso" : "Presentación"}: ${receta.vaso}`] : [],
    secciones: [
      { titulo: "Ingredientes", renglones: renglones(receta.ingredientes) },
      { titulo: "Utensilios", renglones: receta.utensilios ? [receta.utensilios] : [] },
      { titulo: "Preparación", renglones: renglones(receta.preparacion), numerada: true },
      { titulo: "Notas", renglones: renglones(receta.notas || "") },
    ].filter((s) => s.renglones.length > 0),
    consulta: c,
  };
}

export function responderEquipo(data: AppData, c: Consulta, hoy: string, ctx: ContextoEquipo): Respuesta {
  const ubicaciones = ubicarFechas(data);
  // Candado: cada tema solo se responde si es de una de sus secciones,
  // venga de donde venga la consulta.
  const secciones = seccionesEquipo(ctx);
  const permitido =
    (c.tema === "receta" && secciones.includes("recetario")) ||
    (c.tema === "corte" && secciones.includes("corte")) ||
    (c.tema === "miNomina" && secciones.includes("nomina") && !!ctx.empleadoId) ||
    (c.tema === "propinas" && ctx.verPropinas && !c.persona && !c.modo && !c.estadistica) ||
    (c.tema === "horario" && secciones.includes("horarios") && !!ctx.horarioAreaId) ||
    (c.tema === "conteo" && secciones.includes("conteo_diario") && !!ctx.areaInsumo) ||
    (c.tema === "inventario" && secciones.includes("inventario")) ||
    (c.tema === "ranking" && secciones.includes("ranking"));
  if (!permitido) return { titulo: "Pregúntale a Cortes", valor: "—", lineas: ["Esa información no está en tus secciones."], consulta: c };

  if (c.tema === "receta") return responderReceta(data, c, ctx.areaInsumo);
  if (c.tema === "ranking") return responderRanking(data, c, hoy, ctx);

  if (c.tema === "corte") {
    const dias = ctx.corteFechas.map((f) => ({ fecha: f, etiqueta: `${DAY_SHORT[diaDe(f)]} ${Number(f.slice(8))}`, futuro: false }));
    const base = { dias: dias.length > 1 ? dias : undefined, consulta: c, enlace: { texto: "Ir a mi corte", destino: { tipo: "dia" as const, fecha: c.fecha } } };
    const titulos: Record<string, string> = {
      efectivo: `Efectivo a entregar ${nombreDia(c.fecha, hoy)}`,
      tarjetas: `Tarjetas ${nombreDia(c.fecha, hoy)}`,
      gastos: `Gastos ${nombreDia(c.fecha, hoy)}`,
      falta: `Para guardar el corte ${nombreDia(c.fecha, hoy)}`,
      abre: `Quién abre ${nombreDia(c.fecha, hoy)}`,
    };
    const titulo = titulos[c.sub || "efectivo"];
    if (!ctx.corteFechas.includes(c.fecha)) return { ...base, titulo, valor: "—", lineas: ["Ese día no lo tienes asignado."], enlace: undefined };
    if (c.sub === "abre") {
      const abren = quienesAbren(semanaHorario(data, c.fecha), diaDe(c.fecha));
      return {
        ...base,
        titulo,
        valor: abren.length ? abren.map((a) => a.nombre.split(" ")[0]).join(", ") : "—",
        lineas: [abren.length ? "Según el horario (X abre, Z dobla)." : "Nadie tiene X ni Z ese día en el horario."],
        filas: abren.map((a) => ({ etiqueta: a.nombre, valor: marca(a.marca) })),
      };
    }
    const u = ubicaciones.get(c.fecha);
    if (!u) return { ...base, titulo, valor: "—", lineas: ["Ese día todavía no está en el corte."] };
    const day = u.day;
    const r = computeWeekSummary(data.months[u.mk].weeks[u.wi]).perDay.find((p) => p.day === u.dia)!;
    if (c.sub === "tarjetas") {
      return {
        ...base,
        titulo,
        valor: sinCentavos(r.tarjetas),
        lineas: [day.meseros.length ? plural(day.meseros.length, "corte de mesero", "cortes de mesero") : "Todavía no hay cortes de mesero."],
        filas: day.meseros.filter((m) => m.tarjetas > 0).map((m) => ({ etiqueta: m.nombre, valor: sinCentavos(m.tarjetas) })),
      };
    }
    if (c.sub === "gastos") {
      return {
        ...base,
        titulo,
        valor: sinCentavos(r.gastos),
        lineas: [day.gastos.length ? plural(day.gastos.length, "gasto", "gastos") : "Todavía no hay gastos."],
        filas: day.gastos.map((g) => ({
          etiqueta: g.concepto || "Sin concepto",
          valor: sinCentavos(g.total),
          tag: g.estado === "ingresado" ? ("ingresado" as const) : ("pendiente" as const),
        })),
      };
    }
    if (c.sub === "falta") {
      if (day.corteGuardado) return { ...base, titulo, valor: "Ya está guardado", lineas: [`Lo guardó ${day.corteGuardado.nombre}.`] };
      const faltan = faltantesDelCorte(day);
      return {
        ...base,
        titulo,
        valor: faltan.length ? plural(faltan.length, "pendiente", "pendientes") : "Nada",
        lineas: [faltan.length ? "Esto no deja guardar el corte:" : "Ya puedes tocar Guardar corte."],
        filas: faltan.map((f) => ({ etiqueta: `${f.titulo} — ${f.detalle}`, valor: "" })),
      };
    }
    // Efectivo.
    if (turnosActivos(c.fecha)) {
      const e = efectivoDelDia(data.months, c.fecha, day, r.efectivo);
      const lineas: string[] = [];
      if (e.tieneApertura) lineas.push(`Sin lo de la apertura (${sinCentavos(e.aperturaEntregado)}, ya entregado)`);
      if (e.dejadoAyer && !e.fondoEnApertura) lineas.push(`+ Lo que queda del fondo del día anterior ${sinCentavos(e.fondoQueda)}`);
      if (e.dejadoHoy) lineas.push(`− Lo que se deja para mañana ${sinCentavos(e.dejadoHoy)}`);
      return { ...base, titulo, valor: sinCentavos(e.entregar), lineas: lineas.length ? lineas : ["Venta − tarjetas, transferencias y gastos."] };
    }
    return { ...base, titulo, valor: sinCentavos(r.efectivo), lineas: ["Venta − tarjetas, transferencias y gastos."] };
  }

  if (c.tema === "miNomina") {
    const enlace = { texto: "Ver mi nómina", destino: { tipo: "seccion" as const, seccion: "nomina" as const } };
    const u = ubicaciones.get(c.fecha) || ubicaciones.get(mondayOnOrBefore(c.fecha));
    const esEsta = mondayOnOrBefore(c.fecha) === mondayOnOrBefore(hoy);
    const titulos: Record<string, string> = {
      llevo: "Tu nómina · esta semana",
      pasada: "Tu nómina · semana pasada",
      descuentos: "Tus adelantos y descuentos · esta semana",
      dias: "Tus días · esta semana",
    };
    const titulo = titulos[c.sub || "llevo"];
    const semana = u ? data.horarios[u.mk]?.weeks?.[u.wi] ?? null : null;
    const fila = semana?.areas.flatMap((a) => a.filas).find((f) => f.empleadoId === ctx.empleadoId);
    if (!u || !fila) return { titulo, valor: "—", lineas: ["No estás en el horario de esa semana."], enlace, consulta: c };
    if (c.sub === "dias") {
      const lunes = mondayOnOrBefore(c.fecha);
      const trabaja = DAYS.filter((d) => fila.valores[d] && fila.valores[d] !== "OFF").length;
      return {
        titulo,
        valor: plural(trabaja, "día", "días"),
        lineas: [`Del lunes ${Number(lunes.slice(8))} al ${fechaLarga(addDaysIso(lunes, 6))}`],
        filas: DAYS.map((d, i) => ({ etiqueta: `${d} ${Number(addDaysIso(lunes, i).slice(8))}`, valor: fila.valores[d] ? marca(fila.valores[d]!) : "—" })),
        enlace,
        consulta: c,
      };
    }
    const month = data.months[u.mk];
    const yo = computeNominaSemana(semana, data.empleados, data.nominaDescuentos[u.mk]?.weeks?.[u.wi] ?? null, month.weeks[u.wi]).find(
      (p) => p.empleadoId === ctx.empleadoId
    );
    if (!yo) return { titulo, valor: "—", lineas: ["No estás en el horario de esa semana."], enlace, consulta: c };
    const generado = computeNominaHastaHoyPorEmpleado(u.mk, u.wi, month, semana, data.empleados)[ctx.empleadoId] || 0;
    const aRecibir = round2(generado + yo.totalExtras - yo.totalDescuentos);
    const extras = yo.extras.map((x) => ({ etiqueta: `+ ${x.concepto || "Extra"}`, valor: sinCentavos(x.monto) }));
    const descuentos = yo.descuentos.map((d) => ({ etiqueta: `− ${d.concepto || "Descuento"}`, valor: sinCentavos(d.monto) }));
    if (c.sub === "descuentos") {
      return {
        titulo,
        valor: sinCentavos(yo.totalDescuentos),
        lineas: [descuentos.length ? plural(descuentos.length, "descuento", "descuentos") : "No tienes adelantos ni descuentos esta semana."],
        filas: [...descuentos, ...extras],
        enlace,
        consulta: c,
      };
    }
    return {
      titulo,
      valor: sinCentavos(aRecibir),
      lineas: [
        esEsta ? `Generado hasta hoy · semana completa ${sinCentavos(yo.bruto)}` : plural(yo.diasTrabajados, "día trabajado", "días trabajados"),
        ...(c.sub === "pasada" ? [yo.confirmado ? "Ya está pagada." : "Todavía no está marcada como pagada."] : []),
      ],
      filas: [
        { etiqueta: esEsta ? "Bruto hasta hoy" : "Bruto", valor: sinCentavos(generado) },
        ...extras,
        ...descuentos,
        { etiqueta: "A recibir", valor: sinCentavos(aRecibir), tag: c.sub === "pasada" ? (yo.confirmado ? ("pagada" as const) : ("pendiente" as const)) : undefined },
      ],
      enlace,
      consulta: c,
    };
  }

  if (c.tema === "propinas") {
    const areaId = ctx.areaInsumo === "bar" ? "barra" : "cocina";
    const areaNombre = ctx.areaInsumo === "bar" ? "Barra" : "Cocina";
    const enlace = { texto: "Ver propinas", destino: { tipo: "seccion" as const, seccion: "propinas" as const } };
    let total = 0;
    let rango: string;
    if (c.alcance === "dia") {
      const u = ubicaciones.get(c.fecha);
      total = u ? round2(u.day.meseros.reduce((s, m) => s + m.propina, 0)) : 0;
      rango = nombreDia(c.fecha, hoy);
    } else {
      const lunes = mondayOnOrBefore(c.fecha);
      const u = ubicaciones.get(lunes) || ubicaciones.get(c.fecha);
      total = u ? computeWeekSummary(data.months[u.mk].weeks[u.wi]).propina : 0;
      rango = lunes === mondayOnOrBefore(hoy) ? "esta semana" : "la semana pasada";
    }
    const parte = repartoPropinas(total).find((a) => a.id === areaId)?.monto || 0;
    return {
      titulo: `Propinas ${rango} · le toca a ${areaNombre}`,
      valor: sinCentavos(parte),
      lineas: [`Total de propinas ${sinCentavos(total)} · se reparte en tercios (Cocina, Barra y Gerencia)`],
      dias: c.alcance === "dia" ? diasSemana(c.fecha, hoy, true) : undefined,
      enlace,
      consulta: c,
    };
  }

  if (c.tema === "horario") {
    const enlace = { texto: "Ver el horario", destino: { tipo: "seccion" as const, seccion: "horarios" as const } };
    const semana = semanaHorario(data, c.fecha);
    const area = semana?.areas.find((a) => a.id === ctx.horarioAreaId);
    const titulos: Record<string, string> = {
      trabaja: `Quién trabaja ${nombreDia(c.fecha, hoy)}`,
      descansa: `Quién descansa ${nombreDia(c.fecha, hoy)}`,
      abre: `Quién abre ${nombreDia(c.fecha, hoy)}`,
      mio: "Tu horario · esta semana",
    };
    const titulo = titulos[c.sub || "trabaja"];
    if (!area || area.filas.length === 0) return { titulo, valor: "—", lineas: ["Esa semana no tiene horario capturado."], enlace, consulta: c };
    if (c.sub === "mio") {
      const fila = area.filas.find((f) => f.empleadoId === ctx.empleadoId);
      const lunes = mondayOnOrBefore(c.fecha);
      if (!fila) return { titulo, valor: "—", lineas: ["No estás en el horario de esta semana."], enlace, consulta: c };
      return {
        titulo,
        valor: plural(DAYS.filter((d) => fila.valores[d] && fila.valores[d] !== "OFF").length, "día", "días"),
        lineas: [`Del lunes ${Number(lunes.slice(8))} al ${fechaLarga(addDaysIso(lunes, 6))}`],
        filas: DAYS.map((d, i) => ({ etiqueta: `${d} ${Number(addDaysIso(lunes, i).slice(8))}`, valor: fila.valores[d] ? marca(fila.valores[d]!) : "—" })),
        enlace,
        consulta: c,
      };
    }
    const dia = diaDe(c.fecha);
    const valor = (f: (typeof area.filas)[number]) => (f.valores[dia] || "").trim();
    const elegidas = area.filas.filter((f) => {
      const v = valor(f).toUpperCase();
      if (c.sub === "descansa") return v === "OFF";
      if (c.sub === "abre") return v === "X" || v === "Z";
      return !!v && v !== "OFF";
    });
    return {
      titulo,
      valor: plural(elegidas.length, "persona", "personas"),
      lineas: [`${area.nombre === "PISO" ? "Piso" : "Cocina"} · ${fechaLarga(c.fecha)}`],
      filas: elegidas.map((f) => ({ etiqueta: f.nombre, valor: marca(valor(f)) })),
      dias: diasSemana(c.fecha, hoy, false),
      enlace,
      consulta: c,
    };
  }

  if (c.tema === "conteo" && ctx.areaInsumo) {
    const area = ctx.areaInsumo;
    const enlace = { texto: "Ir al conteo", destino: { tipo: "seccion" as const, seccion: "conteo_diario" as const } };
    if (c.sub === "pedido") {
      const pedidos = data.pedidosDiarios?.[area] || {};
      const fecha = Object.keys(pedidos)
        .filter((f) => f <= hoy && Object.keys(pedidos[f] || {}).length)
        .sort()
        .pop();
      if (!fecha) return { titulo: "Qué hay que pedir", valor: "—", lineas: ["Todavía no hay pedido guardado."], enlace, consulta: c };
      const filas = Object.entries(pedidos[fecha])
        .filter(([, n]) => n > 0)
        .map(([id, n]) => {
          const insumo = data.insumos.find((i) => i.id === id);
          const unidad = insumo ? insumo.unidadPedido || insumo.unidad : "";
          return { etiqueta: insumo?.nombre || "Insumo eliminado", valor: `${n} ${pluralizarUnidad(unidad, n)}`.trim() };
        });
      return { titulo: `Qué hay que pedir · ${nombreDia(fecha, hoy)}`, valor: plural(filas.length, "producto", "productos"), lineas: [], filas, enlace, consulta: c };
    }
    const ultimo = ultimoConteo(data, area, hoy);
    if (c.sub === "insumo" && c.objeto) {
      const linea = ultimo ? leerConteoTexto(ultimo.texto).find((l) => l.nombre === c.objeto!.nombre) : undefined;
      return {
        titulo: `${c.objeto.nombre} · último conteo`,
        valor: linea && linea.valor ? `${linea.valor} ${linea.presentacion || ""}`.trim() : "Sin contar",
        lineas: ultimo ? [`Conteo ${nombreDia(ultimo.fecha, hoy)}`] : [],
        enlace,
        consulta: c,
      };
    }
    const textoHoy = data.conteosDiariosTexto?.[area]?.[hoy];
    if (!textoHoy) {
      return {
        titulo: "Conteo de hoy",
        valor: "Sin guardar",
        lineas: [ultimo ? `El último se guardó ${nombreDia(ultimo.fecha, hoy)}.` : "Todavía no hay conteos guardados."],
        enlace,
        consulta: c,
      };
    }
    const faltan = leerConteoTexto(textoHoy).filter((l) => !esCantidadValida(l.valor));
    return {
      titulo: "Qué falta por contar hoy",
      valor: faltan.length ? plural(faltan.length, "producto", "productos") : "Nada",
      lineas: [faltan.length ? "Sin cantidad en el conteo de hoy:" : "El conteo de hoy está completo."],
      filas: faltan.map((l) => ({ etiqueta: l.etiqueta, valor: "" })),
      enlace,
      consulta: c,
    };
  }

  if (c.tema === "inventario") {
    const enlace = { texto: "Ir al inventario", destino: { tipo: "seccion" as const, seccion: "inventario" as const } };
    const lunes = mondayOnOrBefore(hoy);
    const jueves = addDaysIso(lunes, 3);
    const domingo = addDaysIso(lunes, 6);
    const notas = data.inventariosNotas || {};
    if (c.sub === "pedido") {
      const pedidos = data.pedidosInventario || {};
      const fecha = Object.keys(pedidos)
        .filter((f) => f <= hoy && Object.keys(pedidos[f] || {}).length)
        .sort()
        .pop();
      if (!fecha) return { titulo: "Pedido del inventario", valor: "—", lineas: ["Todavía no hay pedido guardado."], enlace, consulta: c };
      const filas = Object.entries(pedidos[fecha])
        .filter(([, n]) => n > 0)
        .map(([id, n]) => {
          const insumo = data.insumos.find((i) => i.id === id);
          const unidad = insumo ? insumo.unidadPedido || insumo.unidad : "";
          return { etiqueta: insumo?.nombre || "Insumo eliminado", valor: `${n} ${pluralizarUnidad(unidad, n)}`.trim() };
        });
      return { titulo: `Pedido del inventario · ${fechaLarga(fecha)}`, valor: plural(filas.length, "producto", "productos"), lineas: [], filas, enlace, consulta: c };
    }
    const estado = (f: string, saltado: boolean) => (notas[f] !== undefined ? "Guardado" : saltado ? "No se hizo" : hoy < f ? "Todavía no toca" : "Sin guardar");
    const ej = estado(jueves, !!data.inventarioJuevesSaltado?.[jueves]);
    const ed = estado(domingo, false);
    return {
      titulo: "Inventario de esta semana",
      valor:
        ed === "Guardado"
          ? "Completo"
          : hoy >= domingo
            ? "Falta el domingo"
            : hoy >= jueves
              ? ej === "Sin guardar"
                ? "Falta el jueves"
                : "Jueves listo"
              : "Todavía no toca",
      lineas: [],
      filas: [
        { etiqueta: `Jueves ${Number(jueves.slice(8))}`, valor: ej },
        { etiqueta: `Domingo ${Number(domingo.slice(8))}`, valor: ed },
      ],
      enlace,
      consulta: c,
    };
  }

  return { titulo: "Pregúntale a Cortes", valor: "—", lineas: ["Esa información no está en tus secciones."], consulta: c };
}

// --- Autocompletado del personal ----------------------------------------

export function catalogoEquipo(data: AppData, hoy: string, ctx: ContextoEquipo): Sugerencia[] {
  const lista: Sugerencia[] = [];
  const agregar = (texto: string, consulta: Consulta, claves = "") => lista.push({ texto, consulta, claves: normalizarNombre(`${texto} ${claves}`) });
  const secciones = seccionesEquipo(ctx);

  preguntasDeEquipo(ctx).forEach((p) => {
    if (p.id === "receta") return;
    agregar(p.texto.replace("¿", "").replace("?", ""), consultaEquipo(p.id, hoy, ctx), SINONIMOS_EQUIPO[p.grupo] || "");
  });
  if (secciones.includes("corte")) {
    ctx.corteFechas.forEach((f) => {
      if (f === fechaCorte(ctx, hoy)) return;
      const n = nombreDia(f, hoy);
      agregar(`Efectivo a entregar ${n}`, { tema: "corte", alcance: "dia", fecha: f, sub: "efectivo" }, "sobre corte");
      agregar(`Qué falta para guardar el corte ${n}`, { tema: "corte", alcance: "dia", fecha: f, sub: "falta" }, "corte");
    });
  }
  if (ctx.verPropinas) {
    agregar("Propinas de ayer", { tema: "propinas", alcance: "dia", fecha: addDaysIso(hoy, -1) }, "propina");
  }
  if (secciones.includes("horarios") && ctx.horarioAreaId) {
    agregar("Quién descansa mañana", { tema: "horario", alcance: "dia", fecha: addDaysIso(hoy, 1), sub: "descansa" }, "horario off libre");
    agregar("Quién abre hoy", { tema: "horario", alcance: "dia", fecha: hoy, sub: "abre" }, "horario");
    agregar("Mi horario de la semana", { tema: "horario", alcance: "semana", fecha: hoy, sub: "mio" }, "dias descanso");
    const plurales = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
    plurales.forEach((d, i) => {
      const f = addDaysIso(mondayOnOrBefore(hoy), i);
      agregar(`Quién trabaja el ${d}`, { tema: "horario", alcance: "dia", fecha: f, sub: "trabaja" }, "horario");
      agregar(`Quién descansa el ${d}`, { tema: "horario", alcance: "dia", fecha: f, sub: "descansa" }, "horario off libre");
    });
  }
  if (secciones.includes("ranking")) {
    agregar("En qué lugar voy en el ranking de la semana pasada", { tema: "ranking", alcance: "semana", fecha: addDaysIso(hoy, -7), sub: "mio" }, "ranking puntos posicion");
  }
  if (secciones.includes("recetario")) {
    recetasDe(data, ctx.areaInsumo).forEach((r) =>
      agregar(`Cómo se prepara ${r.nombre}`, { tema: "receta", alcance: "dia", fecha: hoy, objeto: { id: r.id, nombre: r.nombre } }, "receta hace ingredientes")
    );
  }
  if (secciones.includes("conteo_diario") && ctx.areaInsumo) {
    const ultimo = ultimoConteo(data, ctx.areaInsumo, hoy);
    (ultimo ? leerConteoTexto(ultimo.texto) : []).forEach((l) =>
      agregar(`Cuánto había de ${l.nombre}`, { tema: "conteo", alcance: "dia", fecha: hoy, sub: "insumo", objeto: { id: l.nombre, nombre: l.nombre } }, "conteo hay queda")
    );
  }
  return lista;
}

const SINONIMOS_EQUIPO: Partial<Record<string, string>> = {
  "Tu corte": "corte sobre entregar",
  "Tu nómina": "nomina sueldo pago llevo",
  Horario: "horario",
  Conteo: "conteo contar",
  Inventario: "inventario",
  Propinas: "propina",
  Ranking: "ranking lugar puntos posicion",
};

// Para el dueño también: "Cómo se prepara …" de todas las recetas.
export function sugerenciasRecetas(data: AppData, hoy: string): Sugerencia[] {
  return recetasDe(data, null).map((r) => ({
    texto: `Cómo se prepara ${r.nombre}`,
    consulta: { tema: "receta", alcance: "dia", fecha: hoy, objeto: { id: r.id, nombre: r.nombre } },
    claves: normalizarNombre(`Cómo se prepara ${r.nombre} receta hace ingredientes`),
  }));
}

// Ranking de meseros. Personal de Piso (ctx): su lugar y puntos, y los
// lugares de los demás sin montos. Dueño (ctx null): con montos.
export function responderRanking(data: AppData, c: Consulta, hoy: string, ctx: ContextoEquipo | null): Respuesta {
  const pasada = mondayOnOrBefore(c.fecha) < mondayOnOrBefore(hoy);
  const { desde, hasta } = rangoRanking(pasada ? "semanaPasada" : "semana", hoy);
  const ranking = calcularRanking(data, desde, hasta);
  const periodo = pasada ? "la semana pasada" : "esta semana";
  const enlace = { texto: "Ver ranking", destino: ctx ? { tipo: "seccion" as const, seccion: "ranking" as const } : { tipo: "ranking" as const } };
  const titulo = `Ranking de ${periodo}`;
  if (ranking.filas.length === 0) return { titulo, valor: "—", lineas: ["Todavía nadie lleva 2 días con venta."], enlace, consulta: c };
  const filas = ranking.filas.map((f) => ({
    etiqueta: `${f.lugar}. ${f.nombre}${ctx ? "" : ` · ${money(f.ventaPorTurno)}/turno · cancel. ${f.pctCancelacion.toLocaleString("es-MX")}%`}`,
    valor: `${f.puntos} pts`,
  }));
  if (!ctx) {
    const primeros = ranking.filas.filter((f) => f.lugar === 1);
    const nombres = primeros.map((f) => f.nombre);
    return {
      titulo,
      valor: nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0],
      lineas: [`${primeros.length > 1 ? "Empatados en" : "Va en"} primer lugar con ${primeros[0].puntos} puntos · ${plural(ranking.filas.length, "mesero", "meseros")}`],
      filas,
      enlace,
      consulta: c,
    };
  }
  const yo = ranking.filas.find((f) => f.meseroId === ctx.miMeseroId);
  const arriba = yo ? ranking.filas.filter((f) => f.puntos > yo.puntos).pop() : undefined;
  return {
    titulo: `Tu lugar · ${periodo}`,
    valor: yo ? `${yo.lugar}º de ${ranking.filas.length}` : "Sin lugar",
    lineas: yo
      ? [`${yo.puntos} puntos · venta +${yo.puntosVenta} · cancelaciones −${yo.puntosCancelacion}`, arriba ? `Te faltan ${arriba.puntos - yo.puntos} puntos para el ${arriba.lugar}º lugar.` : "¡Vas en primer lugar!"]
      : ["Para aparecer necesitas 2 días con venta en la semana."],
    filas,
    enlace,
    consulta: c,
  };
}
