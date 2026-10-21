import { DAYS, DAY_SHORT, GASTO_CATEGORIAS } from "./types";
import type { AppData } from "./types";
import {
  addDaysIso,
  computeDashboardReport,
  computeNominaSemana,
  computeNominaTotalHastaHoy,
  computeWeekGastos,
  computeWeekSummary,
  efectivoDelDia,
  mondayOnOrBefore,
  money,
  normalizarNombre,
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
  | "nomina-semana-pasada";

export type GrupoPregunta = "Ventas" | "Dinero" | "Equipo";

export const PREGUNTAS: { id: PreguntaId; texto: string; grupo: GrupoPregunta }[] = [
  { id: "venta-hoy", texto: "Venta de hoy", grupo: "Ventas" },
  { id: "venta-ayer", texto: "Venta de ayer", grupo: "Ventas" },
  { id: "venta-semana", texto: "Venta de la semana", grupo: "Ventas" },
  { id: "venta-semana-pasada", texto: "Semana pasada", grupo: "Ventas" },
  { id: "venta-dia", texto: "¿Cuánto se vendió el…?", grupo: "Ventas" },
  { id: "efectivo-hoy", texto: "Efectivo a entregar hoy", grupo: "Dinero" },
  { id: "gastos-semana", texto: "Gastos de la semana", grupo: "Dinero" },
  { id: "propinas-hoy", texto: "Propinas de hoy", grupo: "Dinero" },
  { id: "utilidad-semana", texto: "Utilidad de la semana", grupo: "Dinero" },
  { id: "nomina-actual", texto: "Nómina actual", grupo: "Equipo" },
  { id: "nomina-semana-pasada", texto: "Nómina de la semana pasada", grupo: "Equipo" },
];

// Las que salen arriba mientras todavía no hay suficientes preguntas hechas.
export const PREGUNTAS_INICIALES: PreguntaId[] = ["venta-hoy", "nomina-actual", "venta-semana"];

export type Tema = "venta" | "efectivo" | "gastos" | "propinas" | "utilidad" | "nomina";

export interface Consulta {
  tema: Tema;
  alcance: "dia" | "semana";
  fecha: string; // el día, o cualquier día de la semana
}

export interface Respuesta {
  titulo: string;
  valor: string;
  lineas: string[];
  enlace?: { texto: string; destino: Destino | { tipo: "dashboard" } };
  // Lun–Dom de esa semana, para cambiar de día sin volver a preguntar.
  dias?: { fecha: string; etiqueta: string; futuro: boolean }[];
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
      return "propinas-hoy";
    case "utilidad":
      return "utilidad-semana";
    case "nomina":
      return pasada ? "nomina-semana-pasada" : "nomina-actual";
  }
}

// --- Entender lo que se escribe o dicta ---------------------------------

const TEMAS: [Tema, RegExp][] = [
  ["utilidad", /utilidad|ganancia|gane|ganamos|margen/],
  ["nomina", /nomina|sueldo|raya|pagar al personal|pago al personal/],
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

export function entenderPregunta(texto: string, hoy: string): Consulta | null {
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

  // Lo que no tiene sentido por día se responde por semana.
  if (tema === "nomina" || tema === "utilidad") alcance = "semana";
  if (!alcance) alcance = tema === "gastos" ? "semana" : "dia";
  return { tema, alcance, fecha };
}

// --- Respuestas ---------------------------------------------------------

function fechaLarga(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const dia = d.toLocaleDateString("es-MX", { weekday: "long" });
  const mes = d.toLocaleDateString("es-MX", { month: "short" }).replace(".", "");
  return `${dia} ${d.getDate()} ${mes}`;
}

const sinCentavos = (n: number) => (Number.isInteger(round2(n)) ? money(n).replace(/\.00$/, "") : money(n));

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

  if (c.tema === "venta" || c.tema === "efectivo" || c.tema === "propinas") {
    const conVenta = resumen.perDay.filter((p) => p.ventaTotal > 0);
    const mejor = [...conVenta].sort((a, b) => b.ventaTotal - a.ventaTotal)[0];
    const valor = c.tema === "venta" ? resumen.ventaTotal : c.tema === "efectivo" ? resumen.efectivoRecibido : resumen.propina;
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
