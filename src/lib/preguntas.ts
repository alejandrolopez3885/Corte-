import { DAYS, DAY_SHORT, GASTO_CATEGORIAS, NOMINA_DESCUENTO_TIPOS, NOMINA_EXTRA_TIPOS } from "./types";
import type { AppData, DayName, PermisoStaff, WeekData } from "./types";
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
  | "propinas-mesero"
  | "stat-promedio-dia"
  | "stat-dia-mas"
  | "stat-promedio-semana"
  | "stat-mejor-dia"
  // Personal (cada quien según sus secciones, ver preguntasEquipo.ts).
  | "corte-efectivo"
  | "corte-tarjetas"
  | "corte-gastos"
  | "corte-falta"
  | "corte-abre"
  | "mi-nomina"
  | "mi-nomina-pasada"
  | "mis-descuentos"
  | "mis-dias"
  | "horario-hoy"
  | "horario-manana"
  | "horario-descansa"
  | "horario-abre"
  | "conteo-falta"
  | "conteo-pedido"
  | "inventario-estado"
  | "inventario-pedido"
  | "receta"
  | "mi-ranking"
  | "ranking-semana";

export type GrupoPregunta =
  | "Ventas"
  | "Estadística"
  | "Dinero"
  | "Nómina"
  | "Propinas"
  | "Tu corte"
  | "Tu nómina"
  | "Horario"
  | "Conteo"
  | "Inventario"
  | "Recetario"
  | "Ranking";

// "dueno" = solo el dueño; las demás, quien tenga esa sección (el dueño
// también ve las del Recetario).
export type SeccionPregunta = "dueno" | "corte" | PermisoStaff | "ranking";

export const PREGUNTAS: { id: PreguntaId; texto: string; grupo: GrupoPregunta; seccion: SeccionPregunta }[] = [
  { id: "venta-hoy", texto: "Venta de hoy", grupo: "Ventas", seccion: "dueno" },
  { id: "venta-ayer", texto: "Venta de ayer", grupo: "Ventas", seccion: "dueno" },
  { id: "venta-semana", texto: "Venta de la semana", grupo: "Ventas", seccion: "dueno" },
  { id: "venta-semana-pasada", texto: "Semana pasada", grupo: "Ventas", seccion: "dueno" },
  { id: "venta-dia", texto: "¿Cuánto se vendió el…?", grupo: "Ventas", seccion: "dueno" },
  { id: "stat-promedio-dia", texto: "Venta promedio por día", grupo: "Estadística", seccion: "dueno" },
  { id: "stat-dia-mas", texto: "¿Qué día se vende más?", grupo: "Estadística", seccion: "dueno" },
  { id: "stat-promedio-semana", texto: "Venta promedio semanal", grupo: "Estadística", seccion: "dueno" },
  { id: "stat-mejor-dia", texto: "Mejor día de venta", grupo: "Estadística", seccion: "dueno" },
  { id: "efectivo-hoy", texto: "Efectivo a entregar hoy", grupo: "Dinero", seccion: "dueno" },
  { id: "gastos-semana", texto: "Gastos de la semana", grupo: "Dinero", seccion: "dueno" },
  { id: "utilidad-semana", texto: "Utilidad de la semana", grupo: "Dinero", seccion: "dueno" },
  { id: "nomina-actual", texto: "Nómina actual", grupo: "Nómina", seccion: "dueno" },
  { id: "nomina-semana-pasada", texto: "Nómina de la semana pasada", grupo: "Nómina", seccion: "dueno" },
  { id: "nomina-persona", texto: "¿Cuánto le toca a…?", grupo: "Nómina", seccion: "dueno" },
  { id: "nomina-pendientes", texto: "¿A quién falta pagar?", grupo: "Nómina", seccion: "dueno" },
  { id: "nomina-descuentos", texto: "Adelantos y descuentos", grupo: "Nómina", seccion: "dueno" },
  { id: "propinas-hoy", texto: "Propinas de hoy", grupo: "Propinas", seccion: "dueno" },
  { id: "propinas-semana", texto: "Propinas de la semana", grupo: "Propinas", seccion: "dueno" },
  { id: "propinas-semana-pasada", texto: "Propinas de la semana pasada", grupo: "Propinas", seccion: "dueno" },
  { id: "propinas-mesero", texto: "Propinas por mesero", grupo: "Propinas", seccion: "dueno" },
  { id: "receta", texto: "¿Cómo se prepara…?", grupo: "Recetario", seccion: "recetario" },
  { id: "corte-efectivo", texto: "Efectivo a entregar", grupo: "Tu corte", seccion: "corte" },
  { id: "corte-falta", texto: "¿Qué falta para guardar el corte?", grupo: "Tu corte", seccion: "corte" },
  { id: "corte-tarjetas", texto: "Tarjetas del día", grupo: "Tu corte", seccion: "corte" },
  { id: "corte-gastos", texto: "Gastos del día", grupo: "Tu corte", seccion: "corte" },
  { id: "corte-abre", texto: "¿Quién abre?", grupo: "Tu corte", seccion: "corte" },
  { id: "mi-nomina", texto: "¿Cuánto llevo esta semana?", grupo: "Tu nómina", seccion: "nomina" },
  { id: "mi-nomina-pasada", texto: "¿Ya me pagaron la semana pasada?", grupo: "Tu nómina", seccion: "nomina" },
  { id: "mis-descuentos", texto: "Mis adelantos y descuentos", grupo: "Tu nómina", seccion: "nomina" },
  { id: "mis-dias", texto: "¿Qué días trabajo esta semana?", grupo: "Tu nómina", seccion: "nomina" },
  { id: "horario-hoy", texto: "¿Quién trabaja hoy?", grupo: "Horario", seccion: "horarios" },
  { id: "horario-manana", texto: "¿Quién trabaja mañana?", grupo: "Horario", seccion: "horarios" },
  { id: "horario-descansa", texto: "¿Quién descansa hoy?", grupo: "Horario", seccion: "horarios" },
  { id: "horario-abre", texto: "¿Quién abre mañana?", grupo: "Horario", seccion: "horarios" },
  { id: "conteo-falta", texto: "¿Qué falta por contar hoy?", grupo: "Conteo", seccion: "conteo_diario" },
  { id: "conteo-pedido", texto: "¿Qué hay que pedir?", grupo: "Conteo", seccion: "conteo_diario" },
  { id: "inventario-estado", texto: "¿Ya se guardó el inventario?", grupo: "Inventario", seccion: "inventario" },
  { id: "inventario-pedido", texto: "Pedido del inventario", grupo: "Inventario", seccion: "inventario" },
  { id: "mi-ranking", texto: "¿En qué lugar voy?", grupo: "Ranking", seccion: "ranking" },
  { id: "ranking-semana", texto: "Ranking de meseros", grupo: "Ranking", seccion: "dueno" },
];

// Las que salen arriba mientras todavía no hay suficientes preguntas hechas.
export const PREGUNTAS_INICIALES: PreguntaId[] = ["venta-hoy", "nomina-actual", "venta-semana"];

// Las que responde responder(); el resto son del personal y del Recetario.
export type TemaDueno = "venta" | "efectivo" | "gastos" | "propinas" | "utilidad" | "nomina";
export type Tema = "venta" | "efectivo" | "gastos" | "propinas" | "utilidad" | "nomina" | "corte" | "miNomina" | "horario" | "conteo" | "inventario" | "receta" | "ranking";

export interface Consulta {
  tema: Tema;
  alcance: "dia" | "semana";
  fecha: string; // el día, o cualquier día de la semana
  // Solo de una persona: un empleado (nómina) o un mesero del catálogo
  // (propinas). "primera" = la primera de la lista (botón "¿Cuánto le
  // toca a…?").
  persona?: { id: string; nombre: string } | "primera";
  modo?: "pendientes" | "descuentos" | "porMesero";
  // Estadística de venta, propinas o gastos con todo lo capturado. En
  // "promedioDia" el día de la semana es el de "fecha".
  estadistica?: "promedioDia" | "porDiaSemana" | "promedioSemana" | "mejorDia";
  // Personal: qué de su sección ("efectivo", "falta", "descansa"…).
  sub?: string;
  // Una receta o un insumo del conteo.
  objeto?: { id: string; nombre: string };
}

export type DestinoPregunta = Destino | { tipo: "dashboard" } | { tipo: "propinas" } | { tipo: "seccion"; seccion: PermisoStaff | "ranking" } | { tipo: "ranking" };

export interface Respuesta {
  titulo: string;
  valor: string;
  lineas: string[];
  enlace?: { texto: string; destino: DestinoPregunta };
  // Renglones con monto a la derecha (desglose, lista de personas…).
  filas?: { etiqueta: string; valor: string; tag?: "pendiente" | "pagada" | "ingresado" }[];
  // Bloques de texto (receta): ingredientes, preparación…
  secciones?: { titulo: string; renglones: string[]; numerada?: boolean }[];
  // Recetas para elegir con un toque.
  recetas?: { id: string; nombre: string }[];
  // Lun–Dom de esa semana, para cambiar de día sin volver a preguntar.
  dias?: { fecha: string; etiqueta: string; futuro: boolean }[];
  // Barras horizontales (estadística); "destacada" = la más reciente.
  barras?: { etiqueta: string; valor: number; texto: string; destacada?: boolean }[];
  // Lun–Dom para cambiar el día de la semana de un promedio.
  diasSemana?: boolean;
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
    case "stat-promedio-dia":
      // Arranca con el mismo día de la semana que hoy.
      return { tema: "venta", alcance: "dia", fecha: hoy, estadistica: "promedioDia" };
    case "stat-dia-mas":
      return { tema: "venta", alcance: "dia", fecha: hoy, estadistica: "porDiaSemana" };
    case "stat-promedio-semana":
      return { tema: "venta", alcance: "semana", fecha: hoy, estadistica: "promedioSemana" };
    case "stat-mejor-dia":
      return { tema: "venta", alcance: "dia", fecha: hoy, estadistica: "mejorDia" };
    case "receta":
      return { tema: "receta", alcance: "dia", fecha: hoy };
    case "ranking-semana":
      return { tema: "ranking", alcance: "semana", fecha: hoy };
    default:
      // Las del personal las arma consultaEquipo (preguntasEquipo.ts).
      return { tema: "venta", alcance: "dia", fecha: hoy };
  }
}

// A qué botón cuenta una pregunta escrita o dictada (para "Las que más
// preguntas").
export function preguntaDeConsulta(c: Consulta, hoy: string): PreguntaId {
  const pasada = c.fecha < mondayOnOrBefore(hoy);
  if (c.estadistica === "promedioDia") return "stat-promedio-dia";
  if (c.estadistica === "porDiaSemana") return "stat-dia-mas";
  if (c.estadistica === "promedioSemana") return "stat-promedio-semana";
  if (c.estadistica === "mejorDia") return "stat-mejor-dia";
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
    case "receta":
      return "receta";
    case "corte":
      return c.sub === "tarjetas" ? "corte-tarjetas" : c.sub === "gastos" ? "corte-gastos" : c.sub === "falta" ? "corte-falta" : c.sub === "abre" ? "corte-abre" : "corte-efectivo";
    case "miNomina":
      return c.sub === "pasada" ? "mi-nomina-pasada" : c.sub === "descuentos" ? "mis-descuentos" : c.sub === "dias" ? "mis-dias" : "mi-nomina";
    case "horario":
      if (c.sub === "descansa") return "horario-descansa";
      if (c.sub === "abre") return "horario-abre";
      if (c.sub === "mio") return "mis-dias";
      return c.fecha > hoy ? "horario-manana" : "horario-hoy";
    case "conteo":
      return c.sub === "pedido" ? "conteo-pedido" : "conteo-falta";
    case "inventario":
      return c.sub === "pedido" ? "inventario-pedido" : "inventario-estado";
    case "ranking":
      return c.sub === "mio" ? "mi-ranking" : "ranking-semana";
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
  [/\bsabados?\b/, 5],
  [/\bdomingos?\b/, 6],
];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const pad = (n: number) => String(n).padStart(2, "0");

// Un nombre del personal o de un mesero dentro de la pregunta: el nombre
// completo o solo el primer nombre, como palabra suelta.
export function buscarPersona(t: string, lista: { id: string; nombre: string }[]): { id: string; nombre: string } | undefined {
  const conNombre = lista.filter((x) => normalizarNombre(x.nombre));
  // Los nombres solo traen letras y espacios ya normalizados.
  const palabra = (n: string) => /^[a-z ]+$/.test(n) && new RegExp(`\\b${n}\\b`).test(t);
  return (
    conNombre.find((x) => palabra(normalizarNombre(x.nombre))) ||
    conNombre.find((x) => palabra(normalizarNombre(x.nombre).split(" ")[0]))
  );
}

function entenderEstadistica(t: string): Consulta["estadistica"] | "promedio" | undefined {
  if (/que dia (se vende|vendemos|vendo|hay|se hace) mas|dia mas (fuerte|flojo)|dias? (mas|menos) (fuertes?|flojos?)|que dia (se vende|vendemos) menos/.test(t)) return "porDiaSemana";
  if (/mejor dia|record|cuando (se )?vend\w* mas|dia que mas (se )?vend/.test(t)) return "mejorDia";
  if (/promedio|normalmente|por lo general|en general|regularmente/.test(t)) return "promedio";
  return undefined;
}

export function entenderPregunta(texto: string, hoy: string, data?: AppData): Consulta | null {
  const t = normalizarNombre(texto).replace(/[¿?¡!.,]/g, " ");
  if (/ranking|quien va (primero|ganando)|primer lugar|en que lugar/.test(t)) {
    return { tema: "ranking", alcance: "semana", fecha: /semana (pasada|anterior)/.test(t) ? addDaysIso(hoy, -7) : hoy };
  }
  const estadistica = entenderEstadistica(t);
  // "¿Cuál fue el mejor día?" sin tema es de venta.
  const tema = TEMAS.find(([, re]) => re.test(t))?.[0] || (estadistica ? "venta" : undefined);
  if (!tema) return null;
  if (estadistica && (tema === "venta" || tema === "propinas" || tema === "gastos")) {
    const dia = DIAS_TEXTO.find(([re]) => re.test(t));
    const tipo = estadistica === "promedio" ? (dia ? "promedioDia" : /semana/.test(t) ? "promedioSemana" : "porDiaSemana") : estadistica;
    const fecha = dia ? addDaysIso(mondayOnOrBefore(hoy), dia[1]) : hoy;
    return { tema, alcance: tipo === "promedioSemana" ? "semana" : "dia", fecha, estadistica: tipo };
  }

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

export function fechaLarga(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const dia = d.toLocaleDateString("es-MX", { weekday: "long" });
  const mes = d.toLocaleDateString("es-MX", { month: "short" }).replace(".", "");
  return `${dia} ${d.getDate()} ${mes}`;
}

export const sinCentavos = (n: number) => (Number.isInteger(round2(n)) ? money(n).replace(/\.00$/, "") : money(n));
export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// Meseros que tienen cortes en la semana, para cambiar de mesero.
function meserosDeSemana(week: WeekData) {
  const vistos = new Map<string, { id: string; nombre: string }>();
  DAYS.forEach((d) => week.days[d].meseros.forEach((m) => vistos.has(m.meseroId) || vistos.set(m.meseroId, { id: m.meseroId, nombre: m.nombre })));
  return [...vistos.values()];
}

export function responder(data: AppData, c: Consulta, hoy: string): Respuesta {
  if (c.estadistica) return responderEstadistica(data, c, hoy);
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
    const titulos: Record<TemaDueno, string> = {
      venta: `Venta del ${fechaLarga(c.fecha)}`,
      efectivo: `Efectivo a entregar ${nombreDia}`,
      propinas: `Propinas ${nombreDia}`,
      gastos: `Gastos ${nombreDia}`,
      utilidad: "",
      nomina: "",
    };
    if (!ud) return sinDatos(titulos[c.tema as TemaDueno], "Ese día no está en ningún mes del corte.");
    const wk = data.months[ud.mk].weeks[ud.wi];
    const r = computeWeekSummary(wk).perDay.find((p) => p.day === ud.dia)!;
    const enlace = { texto: "Ver el corte de ese día", destino: { tipo: "dia" as const, fecha: c.fecha } };
    const vacio = ud.day.meseros.length === 0 && !ud.day.ventaApps && ud.day.gastos.length === 0;
    if (vacio) return { ...sinDatos(titulos[c.tema as TemaDueno], "Todavía no hay nada capturado ese día."), enlace };

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
      if (e.tieneApertura)
        lineas.push(
          `Apertura ${sinCentavos(e.aperturaEntregado)} (ya entregado${e.fondoEnApertura && e.dejadoAyer ? `, con ${sinCentavos(e.fondoQueda)} del fondo` : ""}) · Resto del día ${sinCentavos(e.resto)}`
        );
      if (e.dejadoAyer && !e.fondoEnApertura) lineas.push(`+ Fondo del día anterior ${sinCentavos(e.fondoQueda)}`);
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
  const titulosSemana: Record<TemaDueno, string> = {
    venta: `Venta de ${nombreSemana}`,
    efectivo: `Efectivo de ${nombreSemana}`,
    propinas: `Propinas de ${nombreSemana}`,
    gastos: `Gastos de ${nombreSemana}`,
    utilidad: `Utilidad de ${nombreSemana}${esEstaSemana ? ", hasta hoy" : ""}`,
    nomina: esEstaSemana ? "Nómina de esta semana, generada hasta hoy" : `Nómina de ${nombreSemana}`,
  };
  if (!u || !month || !week) return sinDatos(titulosSemana[c.tema as TemaDueno], "Esa semana no está en ningún mes del corte.");
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
    return { titulo: titulosSemana[c.tema as TemaDueno], valor: sinCentavos(valor), lineas, enlace: enlaceSemana, consulta: c };
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
  const personas = computeNominaSemana(semanaHorario, data.empleados, descuentos, week, lunes);
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

// --- Estadística --------------------------------------------------------
// Con todo lo capturado: solo cuentan los días con venta (los cerrados o
// vacíos no bajan el promedio) y nunca el día de hoy, que todavía no
// termina; por semana, solo las semanas ya cerradas.

interface DiaHistorial {
  fecha: string;
  dia: DayName;
  ventaTotal: number;
  ventaLocal: number;
  ventaApps: number;
  propina: number;
  gastos: number;
}

function historialDias(data: AppData, hoy: string): DiaHistorial[] {
  const porSemana = new Map<string, ReturnType<typeof computeWeekSummary>>();
  const res: DiaHistorial[] = [];
  ubicarFechas(data).forEach((u, fecha) => {
    if (fecha >= hoy) return;
    const clave = `${u.mk}/${u.wi}`;
    if (!porSemana.has(clave)) porSemana.set(clave, computeWeekSummary(data.months[u.mk].weeks[u.wi]));
    const r = porSemana.get(clave)!.perDay.find((p) => p.day === u.dia)!;
    if (r.ventaTotal <= 0) return;
    res.push({ fecha, dia: u.dia, ventaTotal: r.ventaTotal, ventaLocal: r.ventaLocal, ventaApps: r.ventaApps, propina: r.propina, gastos: r.gastos });
  });
  return res.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// Los promedios se redondean al peso.
const promedio = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
const fechaCorta = (f: string) => fechaLarga(f).split(" ").slice(1).join(" ");
const diferencia = (valor: number, base: number) => {
  if (!base) return "";
  const pct = Math.round(((valor - base) / base) * 100);
  return pct === 0 ? "igual al promedio" : `${Math.abs(pct)}% ${pct > 0 ? "arriba" : "abajo"} del promedio`;
};

function responderEstadistica(data: AppData, c: Consulta, hoy: string): Respuesta {
  const tema = c.tema === "propinas" || c.tema === "gastos" ? c.tema : "venta";
  const nombreTema = tema === "venta" ? "Venta" : tema === "propinas" ? "Propinas" : "Gastos";
  const valorDe = (d: DiaHistorial) => (tema === "venta" ? d.ventaTotal : tema === "propinas" ? d.propina : d.gastos);
  const dias = historialDias(data, hoy);
  const desde = dias.length ? ` (desde ${fechaCorta(dias[dias.length - 1].fecha)})` : "";
  const sinDatos = (titulo: string): Respuesta => ({ titulo, valor: "—", lineas: ["Todavía no hay días con venta capturada para sacar la estadística."], consulta: c });

  if (c.estadistica === "promedioDia") {
    const dia = DAYS[(new Date(`${c.fecha}T00:00:00`).getDay() + 6) % 7];
    const plurales: Record<DayName, string> = { Lunes: "lunes", Martes: "martes", Miércoles: "miércoles", Jueves: "jueves", Viernes: "viernes", Sábado: "sábados", Domingo: "domingos" };
    const titulo = `${nombreTema} promedio de los ${plurales[dia]}`;
    const lista = dias.filter((d) => d.dia === dia);
    if (lista.length === 0) return { ...sinDatos(titulo), lineas: [`Todavía no hay ${plurales[dia]} con venta capturada.`], diasSemana: true };
    const prom = promedio(lista.map(valorDe));
    const mejor = [...lista].sort((a, b) => valorDe(b) - valorDe(a))[0];
    const ultimo = lista[0];
    const ultimas = lista.slice(0, 8);
    const max = Math.max(...ultimas.map(valorDe), 1);
    return {
      titulo,
      valor: sinCentavos(prom),
      lineas: [
        `De ${plural(lista.length, plurales[dia].replace(/s$/, ""), plurales[dia])} con venta (desde ${fechaCorta(lista[lista.length - 1].fecha)}) · sin contar hoy`,
        `${lista.length > 4 ? `Últimos 4: ${sinCentavos(promedio(lista.slice(0, 4).map(valorDe)))} · ` : ""}Mejor: ${sinCentavos(valorDe(mejor))} (${fechaCorta(mejor.fecha)})`,
        ...(lista.length > 1 && prom ? [`El último (${fechaCorta(ultimo.fecha)}) fue ${diferencia(valorDe(ultimo), prom)}`] : []),
      ],
      barras: ultimas.map((d, i) => ({ etiqueta: fechaCorta(d.fecha), valor: valorDe(d) / max, texto: sinCentavos(valorDe(d)), destacada: i === 0 })),
      diasSemana: true,
      consulta: c,
    };
  }

  if (c.estadistica === "porDiaSemana") {
    const titulo = `${nombreTema} promedio por día de la semana`;
    const porDia = DAYS.map((d) => ({ d, xs: dias.filter((x) => x.dia === d).map(valorDe) }))
      .filter((x) => x.xs.length > 0)
      .map((x) => ({ d: x.d, prom: promedio(x.xs) }))
      .sort((a, b) => b.prom - a.prom);
    if (porDia.length === 0) return sinDatos(titulo);
    const [mas] = porDia;
    const menos = porDia[porDia.length - 1];
    const veces = menos.prom > 0 ? mas.prom / menos.prom : 0;
    const semanas = new Set(dias.map((d) => mondayOnOrBefore(d.fecha))).size;
    return {
      titulo,
      valor: mas.d,
      lineas: [
        `Promedio ${sinCentavos(mas.prom)}${porDia.length > 1 && veces >= 1.1 ? ` · ${veces >= 1.95 && veces < 2.05 ? "el doble que" : `${veces.toFixed(1)} veces`} el ${menos.d.toLowerCase()}` : ""}`,
        `De ${plural(semanas, "semana", "semanas")} con venta${desde}`,
      ],
      barras: porDia.map((x) => ({ etiqueta: x.d, valor: x.prom / (mas.prom || 1), texto: sinCentavos(x.prom) })),
      consulta: c,
    };
  }

  if (c.estadistica === "promedioSemana") {
    const titulo = `${nombreTema} promedio por semana`;
    const lunesHoy = mondayOnOrBefore(hoy);
    const porSemana = new Map<string, number>();
    dias.forEach((d) => {
      const l = mondayOnOrBefore(d.fecha);
      if (l < lunesHoy) porSemana.set(l, round2((porSemana.get(l) || 0) + valorDe(d)));
    });
    const semanas = [...porSemana.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    if (semanas.length === 0) return { ...sinDatos(titulo), lineas: ["Todavía no hay semanas cerradas con venta."] };
    const prom = promedio(semanas.map(([, v]) => v));
    const ultimas = semanas.slice(0, 8);
    const max = Math.max(...ultimas.map(([, v]) => v), 1);
    const [pasada] = semanas;
    const rango = (l: string) => {
      const dom = addDaysIso(l, 6);
      return l.slice(5, 7) === dom.slice(5, 7) ? `${Number(l.slice(8))}–${fechaCorta(dom)}` : `${fechaCorta(l)}–${Number(dom.slice(8))}`;
    };
    return {
      titulo,
      valor: sinCentavos(prom),
      lineas: [
        `De ${plural(semanas.length, "semana cerrada", "semanas cerradas")}${semanas.length > 4 ? ` · Últimas 4: ${sinCentavos(promedio(semanas.slice(0, 4).map(([, v]) => v)))}` : ""}`,
        ...(semanas.length > 1 && prom ? [`La más reciente (${rango(pasada[0])}): ${sinCentavos(pasada[1])} · ${diferencia(pasada[1], prom)}`] : []),
      ],
      barras: ultimas.map(([l, v], i) => ({ etiqueta: rango(l), valor: v / max, texto: sinCentavos(v), destacada: i === 0 })),
      consulta: c,
    };
  }

  // Mejor día.
  const titulo = `Mejor día de ${nombreTema.toLowerCase()}`;
  const top = [...dias].sort((a, b) => valorDe(b) - valorDe(a)).slice(0, 3);
  if (top.length === 0) return sinDatos(titulo);
  const [mejor, ...siguen] = top;
  const conDia = (f: string) => fechaLarga(f).replace(/^\w/, (x) => x.toUpperCase());
  return {
    titulo,
    valor: sinCentavos(valorDe(mejor)),
    lineas: [
      `${conDia(mejor.fecha)}${tema === "venta" ? ` · Local ${sinCentavos(mejor.ventaLocal)} · Apps ${sinCentavos(mejor.ventaApps)}` : ""}`,
      ...(siguen.length ? [siguen.map((d, i) => `${i + 2}º ${conDia(d.fecha)} ${sinCentavos(valorDe(d))}`).join(" · ")] : []),
      `De ${plural(dias.length, "día", "días")} con venta${desde}`,
    ],
    enlace: { texto: "Ver el corte de ese día", destino: { tipo: "dia", fecha: mejor.fecha } },
    consulta: c,
  };
}

// --- Autocompletado -----------------------------------------------------
// Mientras se escribe, se sugieren preguntas completas armadas con lo que sí
// hay capturado: los días recientes, los nombres del horario y de los
// meseros que tuvieron corte. Cada sugerencia ya trae su consulta, así que
// al tocarla responde directo, sin volver a interpretar el texto.

export interface Sugerencia {
  texto: string;
  consulta: Consulta;
  claves: string; // texto normalizado + sinónimos, para buscar
}

const SINONIMOS: Record<Tema, string> = {
  venta: "venta ventas vendi vendimos vendio vender cuanto",
  efectivo: "efectivo sobre entregar cash dinero",
  gastos: "gastos gasto gastamos gaste",
  propinas: "propinas propina",
  utilidad: "utilidad ganancia ganamos margen",
  nomina: "nomina sueldo raya pago pagar toca gana",
  corte: "corte",
  miNomina: "nomina sueldo pago pagaron llevo toca mi",
  horario: "horario quien trabaja descansa",
  conteo: "conteo contar",
  inventario: "inventario",
  receta: "receta prepara hace como",
  ranking: "ranking lugar puntos voy posicion",
};
const SINONIMOS_ESTADISTICA = "promedio normalmente estadistica general";

export function catalogoSugerencias(data: AppData, hoy: string): Sugerencia[] {
  const lista: Sugerencia[] = [];
  const agregar = (texto: string, consulta: Consulta, extra = "") =>
    lista.push({ texto, consulta, claves: normalizarNombre(`${texto} ${SINONIMOS[consulta.tema]} ${consulta.estadistica ? SINONIMOS_ESTADISTICA : ""} ${extra}`) });
  const ayer = addDaysIso(hoy, -1);
  const pasada = addDaysIso(hoy, -7);
  const lunesHoy = mondayOnOrBefore(hoy);
  const ubicaciones = ubicarFechas(data);
  // Días de esta semana y la pasada que ya pasaron (hoy incluido).
  const recientes: string[] = [];
  for (let f = hoy; f >= addDaysIso(lunesHoy, -7); f = addDaysIso(f, -1)) recientes.push(f);
  const nombreDia = (f: string) => (f === hoy ? "de hoy" : f === ayer ? `de ayer (${fechaLarga(f)})` : `del ${fechaLarga(f)}`);

  PREGUNTAS.forEach((p) => {
    if (p.seccion !== "dueno") return;
    // Estas ya salen con cada día o cada nombre.
    if (p.id === "venta-dia" || p.id === "nomina-persona" || p.id === "stat-promedio-dia") return;
    const texto = p.id === "venta-semana-pasada" ? "Venta de la semana pasada" : p.texto.replace("¿", "").replace("?", "");
    agregar(texto.replace(/^./, (x) => x.toUpperCase()), consultaDePregunta(p.id, hoy));
  });
  recientes.forEach((f) => {
    if (f === hoy || f === ayer) return;
    agregar(`Venta ${nombreDia(f)}`, { tema: "venta", alcance: "dia", fecha: f });
    agregar(`Propinas ${nombreDia(f)}`, { tema: "propinas", alcance: "dia", fecha: f });
    agregar(`Gastos ${nombreDia(f)}`, { tema: "gastos", alcance: "dia", fecha: f });
    agregar(`Efectivo a entregar ${nombreDia(f)}`, { tema: "efectivo", alcance: "dia", fecha: f });
  });
  agregar("Gastos de hoy", { tema: "gastos", alcance: "dia", fecha: hoy });
  agregar(`Gastos de ayer (${fechaLarga(ayer)})`, { tema: "gastos", alcance: "dia", fecha: ayer });
  agregar(`Propinas de ayer (${fechaLarga(ayer)})`, { tema: "propinas", alcance: "dia", fecha: ayer });
  agregar(`Efectivo a entregar ayer (${fechaLarga(ayer)})`, { tema: "efectivo", alcance: "dia", fecha: ayer });
  agregar("Gastos de la semana pasada", { tema: "gastos", alcance: "semana", fecha: pasada });
  agregar("Utilidad de la semana pasada", { tema: "utilidad", alcance: "semana", fecha: pasada });

  // Estadística por día de la semana.
  const plurales = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
  plurales.forEach((d, i) => {
    const fecha = addDaysIso(lunesHoy, i);
    agregar(`Venta promedio de los ${d}`, { tema: "venta", alcance: "dia", fecha, estadistica: "promedioDia" });
    agregar(`Propinas promedio de los ${d}`, { tema: "propinas", alcance: "dia", fecha, estadistica: "promedioDia" });
  });
  agregar("Propinas promedio por semana", { tema: "propinas", alcance: "semana", fecha: hoy, estadistica: "promedioSemana" });
  agregar("Gastos promedio por semana", { tema: "gastos", alcance: "semana", fecha: hoy, estadistica: "promedioSemana" });
  agregar("Mejor día de propinas", { tema: "propinas", alcance: "dia", fecha: hoy, estadistica: "mejorDia" }, "record");

  // Nómina de cada persona del horario de esta semana y la pasada.
  const enHorario = new Map<string, string>();
  [hoy, pasada].forEach((f) => {
    const u = ubicaciones.get(f);
    (u ? data.horarios[u.mk]?.weeks?.[u.wi]?.areas || [] : []).forEach((a) => a.filas.forEach((fila) => enHorario.set(fila.empleadoId, fila.nombre)));
  });
  enHorario.forEach((nombre, id) => {
    const persona = { id, nombre };
    agregar(`Cuánto le toca a ${nombre}`, { tema: "nomina", alcance: "semana", fecha: hoy, persona }, "nomina de");
    agregar(`Nómina de ${nombre} de la semana pasada`, { tema: "nomina", alcance: "semana", fecha: pasada, persona });
  });

  // Propinas de cada mesero con corte en las últimas dos semanas.
  const meseros = new Map<string, string>();
  recientes.forEach((f) => ubicaciones.get(f)?.day.meseros.forEach((m) => meseros.set(m.meseroId, m.nombre)));
  meseros.forEach((nombre, id) => {
    const persona = { id, nombre };
    agregar(`Propinas de ${nombre} esta semana`, { tema: "propinas", alcance: "semana", fecha: hoy, persona });
    agregar(`Propinas de ${nombre} de la semana pasada`, { tema: "propinas", alcance: "semana", fecha: pasada, persona });
    agregar(`Propinas de ${nombre} hoy`, { tema: "propinas", alcance: "dia", fecha: hoy, persona });
    agregar(`Propinas de ${nombre} ayer`, { tema: "propinas", alcance: "dia", fecha: ayer, persona });
  });
  return lista;
}

// Palabras que no ayudan a distinguir una pregunta de otra.
const RELLENO = new Set(["de", "del", "la", "el", "los", "las", "a", "al", "que", "se", "en", "y", "cual", "fue", "es", "cuanto", "cuanta", "me", "mi", "lo", "por", "le"]);

// Las sugerencias que contienen todas las palabras escritas (la última puede
// ir a medias), primero las que más se usan.
export function buscarSugerencias(catalogo: Sugerencia[], texto: string, uso: Partial<Record<PreguntaId, number>>, hoy: string, max = 5): Sugerencia[] {
  const palabras = normalizarNombre(texto).replace(/[¿?¡!.,()]/g, " ").split(" ").filter(Boolean);
  if (palabras.length === 0) return [];
  const ultima = palabras[palabras.length - 1];
  const completas = palabras.slice(0, -1).filter((p) => !RELLENO.has(p));
  const res = catalogo
    .map((s, orden) => {
      const tokens = s.claves.replace(/[()]/g, " ").split(" ");
      const ok =
        completas.every((p) => tokens.some((t) => t.startsWith(p))) && (RELLENO.has(ultima) || tokens.some((t) => t.startsWith(ultima)));
      if (!ok) return null;
      // Que coincida con el texto visible pesa más que con un sinónimo.
      const visible = normalizarNombre(s.texto);
      const enTexto = completas.filter((p) => visible.includes(p)).length;
      // La última palabra cuenta aunque sea de relleno ("al" → "Aldair").
      const ultimaEnTexto = visible.split(/[ ()]/).some((t) => t.startsWith(ultima)) ? 1 : 0;
      return { s, orden, puntos: (enTexto + ultimaEnTexto) * 100 + (uso[preguntaDeConsulta(s.consulta, hoy)] || 0) };
    })
    .filter((x): x is { s: Sugerencia; orden: number; puntos: number } => !!x)
    .sort((a, b) => b.puntos - a.puntos || a.orden - b.orden);
  // Sin repetir el mismo texto.
  const vistos = new Set<string>();
  return res
    .map((x) => x.s)
    .filter((s) => !vistos.has(s.texto) && !!vistos.add(s.texto))
    .slice(0, max);
}
