import { DAYS, DAY_SHORT, GASTO_CATEGORIAS, NOMINA_DESCUENTO_TIPOS, NOMINA_EXTRA_TIPOS } from "./types";
import type { AppData, WeekData } from "./types";
import {
  addDaysIso,
  computeDashboardReport,
  computeNominaHastaHoyPorEmpleado,
  computeNominaSemana,
  computeNominaTotalHastaHoy,
  computeWeekGastos,
  computeWeekSummary,
  efectivoDelDia,
  mondayOnOrBefore,
  money,
  normalizarNombre,
  repartoPropinas,
  resolveMontoFijo,
  resolveWeekStartDate,
  round2,
  turnosActivos,
} from "./dataModel";
import { ubicarFechas, type Destino } from "./inicio";

// Pregúntale a Cortes (solo dueño): preguntas sencillas sobre ventas, dinero
// y equipo, sin IA — se reconocen palabras clave (tema + cuándo) y cada
// número sale de los mismos cálculos que ya usan Corte, Dashboard y Nómina.

export type PreguntaId =
  | "venta-hoy"
  | "venta-ayer"
  | "venta-semana"
  | "venta-semana-pasada"
  | "venta-dia"
  | "efectivo-hoy"
  | "gastos-semana"
  | "propinas-hoy"
  | "utilidad-semana"
  | "nomina-actual"
  | "nomina-semana-pasada"
  | "nomina-persona"
  | "nomina-pendientes"
  | "nomina-descuentos"
  | "propinas-semana"
  | "propinas-semana-pasada"
  | "propinas-mesero";

export type GrupoPregunta = "Ventas" | "Dinero" | "Nómina" | "Propinas";

export const PREGUNTAS: { id: PreguntaId; texto: string; grupo: GrupoPregunta }[] = [
  { id: "venta-hoy", texto: "Venta de hoy", grupo: "Ventas" },
  { id: "venta-ayer", texto: "Venta de ayer", grupo: "Ventas" },
  { id: "venta-semana", texto: "Venta de la semana", grupo: "Ventas" },
  { id: "venta-semana-pasada", texto: "Semana pasada", grupo: "Ventas" },
  { id: "venta-dia", texto: "¿Cuánto se vendió el…?", grupo: "Ventas" },
  { id: "efectivo-hoy", texto: "Efectivo a entregar hoy", grupo: "Dinero" },
  { id: "gastos-semana", texto: "Gastos de la semana", grupo: "Dinero" },
  { id: "utilidad-semana", texto: "Utilidad de la semana", grupo: "Dinero" },
  { id: "nomina-actual", texto: "Nómina actual", grupo: "Nómina" },
  { id: "nomina-semana-pasada", texto: "Nómina de la semana pasada", grupo: "Nómina" },
  { id: "nomina-persona", texto: "¿Cuánto le toca a…?", grupo: "Nómina" },
  { id: "nomina-pendientes", texto: "¿A quién falta pagar?", grupo: "Nómina" },
  { id: "nomina-descuentos", texto: "Adelantos y descuentos", grupo: "Nómina" },
  { id: "propinas-hoy", texto: "Propinas de hoy", grupo: "Propinas" },
  { id: "propinas-semana", texto: "Propinas de la semana", grupo: "Propinas" },
  { id: "propinas-semana-pasada", texto: "Propinas de la semana pasada", grupo: "Propinas" },
  { id: "propinas-mesero", texto: "Propinas por mesero", grupo: "Propinas" },
];

// Las que salen arriba mientras todavía no hay suficientes preguntas hechas.
export const PREGUNTAS_INICIALES: PreguntaId[] = ["venta-hoy", "nomina-actual", "venta-semana"];

export type Tema = "venta" | "efectivo" | "gastos" | "propinas" | "utilidad" | "nomina";

export interface Consulta {
  tema: Tema;
  alcance: "dia" | "semana";
  fecha: string; // el día, o cualquier día de la semana
  // Solo de una persona: un empleado (nómina) o un mesero del catálogo
  // (propinas). "primera" = la primera de la lista (botón "¿Cuánto le
  // toca a…?").
  persona?: { id: string; nombre: string } | "primera";
  modo?: "pendientes" | "descuentos" | "porMesero";
}

export type DestinoPregunta = Destino | { tipo: "dashboard" } | { tipo: "propinas" };

export interface Respuesta {
  titulo: string;
  valor: string;
  lineas: string[];
  enlace?: { texto: string; destino: DestinoPregunta };
  // Renglones con monto a la derecha (desglose, lista de personas…).
  filas?: { etiqueta: string; valor: string; tag?: "pendiente" | "pagada" }[];
  // Lun–Dom de esa semana, para cambiar de día sin volver a preguntar.
  dias?: { fecha: string; etiqueta: string; futuro: boolean }[];
  // Nombres para cambiar de persona sin volver a preguntar.
  personas?: { id: string; nombre: string }[];
  consulta: Consulta;
}

export function consultaDePregunta(id: PreguntaId, hoy: string): Consulta {
  const semanaPasada = addDaysIso(hoy, -7);
  switch (id) {
    case "venta-hoy":
    case "venta-dia":
      return { tema: "venta", alcance: "dia", fecha: hoy };
    case "venta-ayer":
      return { tema: "venta", alcance: "dia", fecha: addDaysIso(hoy, -1) };
    case "venta-semana":
      return { tema: "venta", alcance: "semana", fecha: hoy };
    case "venta-semana-pasada":
      return { tema: "venta", alcance: "semana", fecha: semanaPasada };
    case "efectivo-hoy":
      return { tema: "efectivo", alcance: "dia", fecha: hoy };
    case "gastos-semana":
      return { tema: "gastos", alcance: "semana", fecha: hoy };
    case "propinas-hoy":
      return { tema: "propinas", alcance: "dia", fecha: hoy };
    case "utilidad-semana":
      return { tema: "utilidad", alcance: "semana", fecha: hoy };
    case "nomina-actual":
      return { tema: "nomina", alcance: "semana", fecha: hoy };
    case "nomina-semana-pasada":
      return { tema: "nomina", alcance: "semana", fecha: semanaPasada };
    case "nomina-persona":
      return { tema: "nomina", alcance: "semana", fecha: hoy, persona: "primera" };
    case "nomina-pendientes":
      return { tema: "nomina", alcance: "semana", fecha: semanaPasada, modo: "pendientes" };
    case "nomina-descuentos":
      return { tema: "nomina", alcance: "semana", fecha: hoy, modo: "descuentos" };
    case "propinas-semana":
      return { tema: "propinas", alcance: "semana", fecha: hoy };
    case "propinas-semana-pasada":
      return { tema: "propinas", alcance: "semana", fecha: semanaPasada };
    case "propinas-mesero":
      return { tema: "propinas", alcance: "semana", fecha: hoy, modo: "porMesero" };
  }
}

// A qué botón cuenta una pregunta escrita o dictada (para "Las que más
// preguntas").
export function preguntaDeConsulta(c: Consulta, hoy: string): PreguntaId {
  const pasada = c.fecha < mondayOnOrBefore(hoy);
  switch (c.tema) {
    case "venta":
      if (c.alcance === "semana") return pasada ? "venta-semana-pasada" : "venta-semana";
      return c.fecha === hoy ? "venta-hoy" : c.fecha === addDaysIso(hoy, -1) ? "venta-ayer" : "venta-dia";
    case "efectivo":
      return "efectivo-hoy";
    case "gastos":
      return "gastos-semana";
    case "propinas":
      if (c.persona || c.modo === "porMesero") return "propinas-mesero";
      if (c.alcance === "semana") return pasada ? "propinas-semana-pasada" : "propinas-semana";
      return "propinas-hoy";
    case "utilidad":
      return "utilidad-semana";
    case "nomina":
      if (c.persona) return "nomina-persona";
      if (c.modo === "pendientes") return "nomina-pendientes";
      if (c.modo === "descuentos") return "nomina-descuentos";
      return pasada ? "nomina-semana-pasada" : "nomina-actual";
  }
}

// --- Entender lo que se escribe o dicta ---------------------------------

const TEMAS: [Tema, RegExp][] = [
  ["utilidad", /utilidad|ganancia|gane|ganamos|margen/],
  ["nomina", /nomina|sueldo|raya|pagar al personal|pago al personal|le toca|cuanto gana|pagarle|falta(n)? (de )?pagar|sin pagar|adelanto|descuento|tardanza/],
  ["propinas", /propina/],
  ["gastos", /gast/],
  ["efectivo", /efectivo|entregar|sobre|cash/],
  ["venta", /vend|venta|facture|facturamos/],
];

const DIAS_TEXTO: [RegExp, number][] = [
  [/\blunes\b/, 0],
  [/\bmartes\b/, 1],
  [/\bmiercoles\b/, 2],
  [/\bjueves\b/, 3],
  [/\bviernes\b/, 4],
  [/\bsabado\b/, 5],
  [/\bdomingo\b/, 6],
];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const pad = (n: number) => String(n).padStart(2, "0");

// Un nombre del personal o de un mesero dentro de la pregunta: el nombre
// completo o solo el primer nombre, como palabra suelta.
function buscarPersona(t: string, lista: { id: string; nombre: string }[]): { id: string; nombre: string } | undefined {
  const conNombre = lista.filter((x) => normalizarNombre(x.nombre));
  // Los nombres solo traen letras y espacios ya normalizados.
  const palabra = (n: string) => /^[a-z ]+$/.test(n) && new RegExp(`\\b${n}\\b`).test(t);
  return (
    conNombre.find((x) => palabra(normalizarNombre(x.nombre))) ||
    conNombre.find((x) => palabra(normalizarNombre(x.nombre).split(" ")[0]))
  );
}

export function entenderPregunta(texto: string, hoy: string, data?: AppData): Consulta | null {
  const t = normalizarNombre(texto).replace(/[¿?¡!.,]/g, " ");
  const tema = TEMAS.find(([, re]) => re.test(t))?.[0];
  if (!tema) return null;

  let alcance: "dia" | "semana" | null = null;
  let fecha = hoy;
  const lunesHoy = mondayOnOrBefore(hoy);

  if (/semana (pasada|anterior)|otra semana|ultima semana/.test(t)) {
    alcance = "semana";
    fecha = addDaysIso(hoy, -7);
  } else if (/semana/.test(t)) {
    alcance = "semana";
  } else if (/antier|anteayer|antes de ayer/.test(t)) {
    alcance = "dia";
    fecha = addDaysIso(hoy, -2);
  } else if (/\bayer\b/.test(t)) {
    alcance = "dia";
    fecha = addDaysIso(hoy, -1);
  } else if (/\bhoy\b/.test(t)) {
    alcance = "dia";
  } else {
    const dia = DIAS_TEXTO.find(([re]) => re.test(t));
    const numero = t.match(/\b(\d{1,2})(?:\s+de\s+([a-z]+))?\b/);
    if (dia) {
      alcance = "dia";
      fecha = addDaysIso(lunesHoy, dia[1]);
      // El más reciente que ya pasó; "el martes pasado" es el de la semana anterior.
      if (fecha > hoy || /pasado/.test(t)) fecha = addDaysIso(fecha, -7);
    } else if (numero) {
      const d = Number(numero[1]);
      const [y, m] = hoy.split("-").map(Number);
      const mesTexto = numero[2] ? MESES.indexOf(numero[2]) : -1;
      if (d >= 1 && d <= 31) {
        let anio = y;
        let mes = mesTexto >= 0 ? mesTexto + 1 : m;
        let candidata = `${anio}-${pad(mes)}-${pad(d)}`;
        if (candidata > hoy) {
          if (mesTexto >= 0) anio -= 1;
          else if (--mes === 0) {
            mes = 12;
            anio -= 1;
          }
          candidata = `${anio}-${pad(mes)}-${pad(d)}`;
        }
        alcance = "dia";
        fecha = candidata;
      }
    }
  }

  let persona: Consulta["persona"];
  let modo: Consulta["modo"];
  if (tema === "nomina") {
    if (/falta(n)? (de )?pagar|sin pagar|pendiente|no (le )?(he|hemos) pagado/.test(t)) {
      modo = "pendientes";
      // Sin decir cuándo, lo que falta pagar es de la semana pasada.
      if (alcance !== "semana") fecha = addDaysIso(hoy, -7);
    } else if (/adelanto|descuento|tardanza/.test(t)) modo = "descuentos";
    persona = data ? buscarPersona(t, data.empleados) : undefined;
    // "¿cuánto le toca a Pedro?" con un nombre que no está: se avisa, no se
    // responde de otra persona.
    const pedido = t.match(/le toca a ([a-z]+)/)?.[1];
    if (!persona && pedido) persona = { id: "", nombre: pedido.charAt(0).toUpperCase() + pedido.slice(1) };
    else if (!persona && /le toca/.test(t)) persona = "primera";
  }
  if (tema === "propinas") {
    persona = data ? buscarPersona(t, data.meseros) : undefined;
    if (!persona && /mesero|quien (junto|saco|hizo|gano|tuvo) mas/.test(t)) modo = "porMesero";
    // Por persona o por mesero, sin decir cuándo, es de la semana.
    if ((persona || modo) && !alcance) alcance = "semana";
  }

  // Lo que no tiene sentido por día se responde por semana.
  if (tema === "nomina" || tema === "utilidad") alcance = "semana";
  if (!alcance) alcance = tema === "gastos" ? "semana" : "dia";
  return { tema, alcance, fecha, ...(persona ? { persona } : {}), ...(modo ? { modo } : {}) };
}

// --- Respuestas ---------------------------------------------------------

function fechaLarga(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const dia = d.toLocaleDateString("es-MX", { weekday: "long" });
  const mes = d.toLocaleDateString("es-MX", { month: "short" }).replace(".", "");
  return `${dia} ${d.getDate()} ${mes}`;
}

const sinCentavos = (n: number) => (Number.isInteger(round2(n)) ? money(n).replace(/\.00$/, "") : money(n));
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// Meseros que tienen cortes en la semana, para cambiar de mesero.
function meserosDeSemana(week: WeekData) {
  const vistos = new Map<string, { id: string; nombre: string }>();
  DAYS.forEach((d) => week.days[d].meseros.forEach((m) => vistos.has(m.meseroId) || vistos.set(m.meseroId, { id: m.meseroId, nombre: m.nombre })));
  return [...vistos.values()];
}

export function responder(data: AppData, c: Consulta, hoy: string): Respuesta {
  const ubicaciones = ubicarFechas(data);
  const lunes = mondayOnOrBefore(c.fecha);
  const domingo = addDaysIso(lunes, 6);
  const esEstaSemana = lunes === mondayOnOrBefore(hoy);
  const u = ubicaciones.get(c.fecha) || ubicaciones.get(lunes);
  const month = u ? data.months[u.mk] : null;
  const week = u && month ? month.weeks[u.wi] : null;
  const nombreSemana = esEstaSemana ? "esta semana" : lunes === mondayOnOrBefore(addDaysIso(hoy, -7)) ? "la semana pasada" : `la semana del ${fechaLarga(lunes)}`;
  const hastaHoy = esEstaSemana ? `Del lunes ${Number(lunes.slice(8))} al ${fechaLarga(hoy)}` : `Del ${fechaLarga(lunes)} al ${fechaLarga(domingo)}`;

  const dias =
    c.alcance === "dia"
      ? DAYS.map((d, i) => {
          const f = addDaysIso(lunes, i);
          return { fecha: f, etiqueta: DAY_SHORT[d], futuro: f > hoy };
        })
      : undefined;

  const sinDatos = (titulo: string, texto: string): Respuesta => ({ titulo, valor: "—", lineas: [texto], dias, consulta: c });

  if (c.alcance === "dia") {
    const ud = ubicaciones.get(c.fecha);
    const nombreDia = c.fecha === hoy ? "hoy" : c.fecha === addDaysIso(hoy, -1) ? `ayer (${fechaLarga(c.fecha)})` : `el ${fechaLarga(c.fecha)}`;
    const titulos: Record<Tema, string> = {
      venta: `Venta del ${fechaLarga(c.fecha)}`,
      efectivo: `Efectivo a entregar ${nombreDia}`,
      propinas: `Propinas ${nombreDia}`,
      gastos: `Gastos ${nombreDia}`,
      utilidad: "",
      nomina: "",
    };
    if (!ud) return sinDatos(titulos[c.tema], "Ese día no está en ningún mes del corte.");
    const wk = data.months[ud.mk].weeks[ud.wi];
    const r = computeWeekSummary(wk).perDay.find((p) => p.day === ud.dia)!;
    const enlace = { texto: "Ver el corte de ese día", destino: { tipo: "dia" as const, fecha: c.fecha } };
    const vacio = ud.day.meseros.length === 0 && !ud.day.ventaApps && ud.day.gastos.length === 0;
    if (vacio) return { ...sinDatos(titulos[c.tema], "Todavía no hay nada capturado ese día."), enlace };

    if (c.tema === "venta") {
      return {
        titulo: titulos.venta,
        valor: sinCentavos(r.ventaTotal),
        lineas: [`Local ${sinCentavos(r.ventaLocal)} · Apps ${sinCentavos(r.ventaApps)}`, `Tarjetas ${sinCentavos(r.tarjetas)} · Efectivo ${sinCentavos(r.efectivo)}`],
        enlace,
        dias,
        consulta: c,
      };
    }
    if (c.tema === "propinas" && c.persona && c.persona !== "primera") {
      const p = c.persona;
      const cortes = ud.day.meseros.filter((m) => m.meseroId === p.id);
      return {
        titulo: `Propinas de ${p.nombre} · ${nombreDia}`,
        valor: sinCentavos(round2(cortes.reduce((s, m) => s + m.propina, 0))),
        lineas: [cortes.length ? plural(cortes.length, "corte", "cortes") : "No tuvo corte ese día"],
        enlace,
        dias,
        personas: meserosDeSemana(wk),
        consulta: c,
      };
    }
    if (c.tema === "propinas") {
      const conPropina = ud.day.meseros.filter((m) => m.propina > 0);
      const mayor = [...conPropina].sort((a, b) => b.propina - a.propina)[0];
      return {
        titulo: titulos.propinas,
        valor: sinCentavos(r.propina),
        lineas: [
          `${conPropina.length} ${conPropina.length === 1 ? "mesero" : "meseros"} con propina`,
          ...(mayor ? [`La más alta: ${mayor.nombre} ${sinCentavos(mayor.propina)}`] : []),
        ],
        enlace,
        dias,
        consulta: c,
      };
    }
    if (c.tema === "gastos") {
      return {
        titulo: titulos.gastos,
        valor: sinCentavos(r.gastos),
        lineas: [`${ud.day.gastos.length} ${ud.day.gastos.length === 1 ? "gasto" : "gastos"}`],
        enlace,
        dias,
        consulta: c,
      };
    }
    // Efectivo: desde el 21/10/2026 con apertura y efectivo dejado.
    if (turnosActivos(c.fecha)) {
      const e = efectivoDelDia(data.months, c.fecha, ud.day, r.efectivo);
      const lineas: string[] = [];
      if (e.tieneApertura) lineas.push(`Apertura ${sinCentavos(e.aperturaEf)} (ya entregado) · Resto del día ${sinCentavos(e.resto)}`);
      if (e.dejadoAyer) lineas.push(`+ Se dejó el día anterior ${sinCentavos(e.dejadoAyer)}`);
      if (e.dejadoHoy) lineas.push(`− Se deja para el día siguiente ${sinCentavos(e.dejadoHoy)}`);
      lineas.push(`Efectivo total del día ${sinCentavos(e.totalDia)}`);
      return { titulo: titulos.efectivo, valor: sinCentavos(e.entregar), lineas, enlace, dias, consulta: c };
    }
    return {
      titulo: titulos.efectivo,
      valor: sinCentavos(r.efectivo),
      lineas: [`Venta local ${sinCentavos(r.ventaLocal)} − tarjetas, transferencias y gastos`],
      enlace,
      dias,
      consulta: c,
    };
  }

  // Por semana.
  const titulosSemana: Record<Tema, string> = {
    venta: `Venta de ${nombreSemana}`,
    efectivo: `Efectivo de ${nombreSemana}`,
    propinas: `Propinas de ${nombreSemana}`,
    gastos: `Gastos de ${nombreSemana}`,
    utilidad: `Utilidad de ${nombreSemana}${esEstaSemana ? ", hasta hoy" : ""}`,
    nomina: esEstaSemana ? "Nómina de esta semana, generada hasta hoy" : `Nómina de ${nombreSemana}`,
  };
  if (!u || !month || !week) return sinDatos(titulosSemana[c.tema], "Esa semana no está en ningún mes del corte.");
  const resumen = computeWeekSummary(week);
  const enlaceSemana = { texto: "Ver el resumen de la semana", destino: { tipo: "semana" as const, fecha: lunes } };

  if (c.tema === "propinas") {
    const meseros = meserosDeSemana(week);
    const enlacePropinas = { texto: "Ver propinas", destino: { tipo: "propinas" as const } };
    if (c.persona && c.persona !== "primera") {
      const p = c.persona;
      const filas = DAYS.map((d) => ({ d, cortes: week.days[d].meseros.filter((m) => m.meseroId === p.id) }))
        .filter((x) => x.cortes.length > 0)
        .map((x) => ({ etiqueta: `${x.d} · ${plural(x.cortes.length, "corte", "cortes")}`, valor: sinCentavos(round2(x.cortes.reduce((s, m) => s + m.propina, 0))) }));
      const total = round2(DAYS.reduce((s, d) => s + week.days[d].meseros.filter((m) => m.meseroId === p.id).reduce((a, m) => a + m.propina, 0), 0));
      return {
        titulo: `Propinas de ${p.nombre} · ${nombreSemana}`,
        valor: sinCentavos(total),
        lineas: [filas.length ? `${hastaHoy} · ${plural(filas.length, "día", "días")} con corte` : `${hastaHoy} · sin cortes`],
        filas,
        enlace: enlacePropinas,
        personas: meseros,
        consulta: c,
      };
    }
    if (c.modo === "porMesero") {
      const porMesero = meseros
        .map((m) => {
          const cortes = DAYS.flatMap((d) => week.days[d].meseros.filter((x) => x.meseroId === m.id));
          return { ...m, cortes: cortes.length, propina: round2(cortes.reduce((s, x) => s + x.propina, 0)) };
        })
        .sort((a, b) => b.propina - a.propina);
      return {
        titulo: `Propinas por mesero · ${nombreSemana}`,
        valor: sinCentavos(resumen.propina),
        lineas: porMesero.length ? [hastaHoy] : [`${hastaHoy} · sin cortes`],
        filas: porMesero.map((m, i) => ({ etiqueta: `${i + 1}. ${m.nombre} · ${plural(m.cortes, "corte", "cortes")}`, valor: sinCentavos(m.propina) })),
        enlace: enlacePropinas,
        personas: meseros,
        consulta: c,
      };
    }
    const mejor = [...resumen.perDay].filter((p) => p.propina > 0).sort((a, b) => b.propina - a.propina)[0];
    return {
      titulo: titulosSemana.propinas,
      valor: sinCentavos(resumen.propina),
      lineas: [`${hastaHoy}${mejor ? ` · Mejor día: ${mejor.day} ${sinCentavos(mejor.propina)}` : ""}`],
      filas: repartoPropinas(resumen.propina).map((a) => ({ etiqueta: `${a.nombre} (⅓)`, valor: sinCentavos(a.monto) })),
      enlace: enlacePropinas,
      consulta: c,
    };
  }

  if (c.tema === "venta" || c.tema === "efectivo") {
    const conVenta = resumen.perDay.filter((p) => p.ventaTotal > 0);
    const mejor = [...conVenta].sort((a, b) => b.ventaTotal - a.ventaTotal)[0];
    const valor = c.tema === "venta" ? resumen.ventaTotal : resumen.efectivoRecibido;
    const lineas =
      c.tema === "venta"
        ? [
            `${hastaHoy} · ${conVenta.length} ${conVenta.length === 1 ? "día" : "días"} con venta`,
            `Local ${sinCentavos(resumen.ventaLocal)} · Apps ${sinCentavos(resumen.ventaApps)}`,
            ...(mejor ? [`Mejor día: ${mejor.day} ${sinCentavos(mejor.ventaTotal)}`] : []),
          ]
        : [hastaHoy];
    return { titulo: titulosSemana[c.tema], valor: sinCentavos(valor), lineas, enlace: enlaceSemana, consulta: c };
  }

  if (c.tema === "gastos") {
    const g = computeWeekGastos(week);
    const porCategoria = new Map<string, number>();
    g.perDay.forEach((d) =>
      d.items.forEach((x) => {
        const nombre = GASTO_CATEGORIAS.find((k) => k.value === x.categoria)?.label || "Sin categoría";
        porCategoria.set(nombre, round2((porCategoria.get(nombre) || 0) + x.total));
      })
    );
    const top = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
      titulo: titulosSemana.gastos,
      valor: sinCentavos(g.totalMonto),
      lineas: [
        `${hastaHoy} · ${g.countTotal} ${g.countTotal === 1 ? "gasto" : "gastos"} en efectivo`,
        ...(top.length ? [top.map(([n, v]) => `${n} ${sinCentavos(v)}`).join(" · ")] : []),
        ...(g.countPendiente ? [`Pendientes de ingresar: ${g.countPendiente} (${sinCentavos(g.totalPendiente)})`] : []),
      ],
      enlace: enlaceSemana,
      consulta: c,
    };
  }

  const semanaHorario = data.horarios[u.mk]?.weeks?.[u.wi] ?? null;
  const nominaHastaHoy = computeNominaTotalHastaHoy(u.mk, u.wi, month, semanaHorario, data.empleados);

  if (c.tema === "utilidad") {
    const montoFijo = resolveMontoFijo(data.montosFijosSemanales, resolveWeekStartDate(u.mk, u.wi, month));
    const rep = computeDashboardReport(week, nominaHastaHoy, data.meseros, montoFijo);
    return {
      titulo: titulosSemana.utilidad,
      valor: sinCentavos(rep.utilidad),
      lineas: [
        `Venta ${sinCentavos(rep.ventaTotal)} − gastos ${sinCentavos(round2(rep.ventaTotal - rep.utilidad))}`,
        `Margen ${rep.pct.utilidad}% · Nómina ${sinCentavos(rep.nomina)} (${rep.pct.nomina}%)`,
      ],
      enlace: { texto: "Ver Dashboard", destino: { tipo: "dashboard" } },
      consulta: c,
    };
  }

  // Nómina.
  const descuentos = data.nominaDescuentos[u.mk]?.weeks?.[u.wi] ?? null;
  const personas = computeNominaSemana(semanaHorario, data.empleados, descuentos, week);
  const enlaceNomina = { texto: "Ver nómina", destino: { tipo: "nomina" as const, fecha: lunes } };
  if (personas.length === 0) return { ...sinDatos(titulosSemana.nomina, "Esa semana no tiene horario capturado."), enlace: enlaceNomina };
  // A recibir hasta hoy: lo generado hasta hoy más extras menos descuentos,
  // igual que en la pantalla de Nómina (en semanas cerradas es el neto).
  const hastaHoyPorEmpleado = computeNominaHastaHoyPorEmpleado(u.mk, u.wi, month, semanaHorario, data.empleados);
  const aRecibir = (p: (typeof personas)[number]) => round2((hastaHoyPorEmpleado[p.empleadoId] || 0) + p.totalExtras - p.totalDescuentos);
  const diaHoy = DAY_SHORT[DAYS[(new Date(`${hoy}T00:00:00`).getDay() + 6) % 7]].toLowerCase();
  const rango = `lun ${Number(lunes.slice(8))} – ${diaHoy} ${Number(hoy.slice(8))}`;

  if (c.persona) {
    const elegida = c.persona === "primera" ? personas[0] : personas.find((p) => p.empleadoId === (c.persona as { id: string }).id);
    const lista = personas.map((p) => ({ id: p.empleadoId, nombre: p.nombre }));
    if (!elegida) {
      const nombre = (c.persona as { nombre: string }).nombre;
      return { ...sinDatos(`Nómina de ${nombre} · ${nombreSemana}`, `${nombre} no está en el horario de esa semana.`), enlace: enlaceNomina, personas: lista };
    }
    const consulta = { ...c, persona: { id: elegida.empleadoId, nombre: elegida.nombre } };
    const generado = hastaHoyPorEmpleado[elegida.empleadoId] || 0;
    const diasHastaHoy = elegida.dias.filter((d) => d.multiplicador > 0 && addDaysIso(lunes, DAYS.indexOf(d.day)) <= hoy && d.valor !== "OFF").length;
    const etiquetaTipo = (lista: { value: string; label: string }[], v: string) => lista.find((x) => x.value === v)?.label || v;
    return {
      titulo: `Nómina de ${elegida.nombre} · ${nombreSemana}`,
      valor: sinCentavos(aRecibir(elegida)),
      lineas: [
        esEstaSemana ? `Generado hasta hoy (${rango}) · ${plural(diasHastaHoy, "día", "días")}` : `${plural(elegida.diasTrabajados, "día trabajado", "días trabajados")}`,
        `Semana completa: ${sinCentavos(elegida.bruto)} · ${sinCentavos(elegida.sueldoDiario)} por día`,
        ...(elegida.confirmado ? ["Ya está pagada"] : []),
      ],
      filas: [
        { etiqueta: esEstaSemana ? "Bruto hasta hoy" : "Bruto", valor: sinCentavos(generado) },
        ...elegida.extras.map((x) => ({ etiqueta: `+ ${x.concepto || etiquetaTipo(NOMINA_EXTRA_TIPOS, x.tipo)}`, valor: sinCentavos(x.monto) })),
        ...elegida.descuentos.map((d) => ({ etiqueta: `− ${d.concepto || etiquetaTipo(NOMINA_DESCUENTO_TIPOS, d.tipo)}`, valor: sinCentavos(d.monto) })),
        { etiqueta: "A recibir", valor: sinCentavos(aRecibir(elegida)), tag: elegida.confirmado ? ("pagada" as const) : undefined },
      ],
      enlace: enlaceNomina,
      personas: lista,
      consulta,
    };
  }

  if (c.modo === "pendientes") {
    const pendientes = personas.filter((p) => !p.confirmado).sort((a, b) => aRecibir(b) - aRecibir(a));
    const pagadas = personas.filter((p) => p.confirmado);
    const totalPagado = round2(pagadas.reduce((s, p) => s + (p.montoPagado ?? aRecibir(p)), 0));
    return {
      titulo: `Falta pagar · ${nombreSemana} (${Number(lunes.slice(8))}–${Number(domingo.slice(8))} ${fechaLarga(domingo).split(" ")[2]})`,
      valor: sinCentavos(round2(pendientes.reduce((s, p) => s + aRecibir(p), 0))),
      lineas: [pendientes.length ? `${pendientes.length} de ${personas.length} personas pendientes` : "Todas están pagadas"],
      filas: [
        ...pendientes.map((p) => ({ etiqueta: p.nombre, valor: sinCentavos(aRecibir(p)), tag: "pendiente" as const })),
        ...(pagadas.length ? [{ etiqueta: plural(pagadas.length, "ya pagada", "ya pagadas"), valor: sinCentavos(totalPagado), tag: "pagada" as const }] : []),
      ],
      enlace: enlaceNomina,
      consulta: c,
    };
  }

  if (c.modo === "descuentos") {
    const etiqueta = (v: string) => (NOMINA_DESCUENTO_TIPOS.find((x) => x.value === v)?.label || v).toLowerCase();
    const filas = personas.flatMap((p) => p.descuentos.map((d) => ({ etiqueta: `${p.nombre} · ${d.concepto ? d.concepto.split(" · ")[0] : etiqueta(d.tipo)}`, valor: sinCentavos(d.monto) })));
    const total = round2(personas.reduce((s, p) => s + p.totalDescuentos, 0));
    return {
      titulo: `Adelantos y descuentos · ${nombreSemana}`,
      valor: sinCentavos(total),
      lineas: [filas.length ? plural(filas.length, "descuento", "descuentos") : "Sin adelantos ni descuentos"],
      filas,
      enlace: enlaceNomina,
      consulta: c,
    };
  }

  const completa = round2(personas.reduce((s, p) => s + p.bruto, 0));
  const neto = round2(personas.reduce((s, p) => s + p.neto, 0));
  const pagadas = personas.filter((p) => p.confirmado).length;
  return {
    titulo: titulosSemana.nomina,
    valor: sinCentavos(esEstaSemana ? nominaHastaHoy : completa),
    lineas: esEstaSemana
      ? [`${hastaHoy} · ${personas.length} personas`, `Semana completa (proyectada): ${sinCentavos(completa)}`]
      : [`${personas.length} personas · Neto a pagar ${sinCentavos(neto)}`, `Pagadas: ${pagadas} de ${personas.length}`],
    enlace: enlaceNomina,
    consulta: c,
  };
}
