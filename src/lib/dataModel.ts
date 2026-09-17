import { DAYS, GASTO_CATEGORIAS, type AppData, type DayData, type DayName, type GastoCategoria, type MeseroCut, type MonthData, type WeekData } from "./types";

export const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const money = (n: number | null | undefined): string => {
  const v = Number(n) || 0;
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
};

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function sumFromText(text: string | number | null | undefined): number {
  if (!text && text !== 0) return 0;
  const parts = String(text)
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n));
  if (parts.length === 0) return 0;
  return round2(parts.reduce((a, b) => a + b, 0));
}

export function propinaLabel(m: MeseroCut): string {
  if (m.propinaTipo === "p3") return `Propina 3% · ${money(m.propina)}`;
  if (m.propinaTipo === "p2") return `Propina 2% · ${money(m.propina)}`;
  if (m.propinaTipo === "manual") return `Propina manual · ${money(m.propina)}`;
  if (m.propinaTipo === "none") return "Sin propina";
  // Cortes guardados antes de este cambio, sin propinaTipo.
  return m.aplicaPropina ? `Propina · ${money(m.propina)}` : "Sin propina";
}

export function emptyDay(): DayData {
  return { meseros: [], gastos: [], transferencias: [], ventaApps: 0 };
}

// --- Fechas reales por semana/día -------------------------------------
// Cada semana ancla su Lunes a una fecha real (editable). Por default, la
// semana 1 empieza en el lunes que cae en o antes del día 1 del mes, y las
// siguientes 3 semanas avanzan de 7 en 7 días — así cada semana es siempre
// un Lunes-a-Domingo real, aunque la primera se asome al mes anterior.

export function addDaysIso(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function mondayOnOrBefore(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const jsDay = date.getDay(); // 0=Domingo..6=Sábado
  const offset = (jsDay + 6) % 7; // días desde el Lunes anterior (0 si ya es Lunes)
  return addDaysIso(dateStr, -offset);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultWeekStartDate(monthKey: string, weekIndex: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  const week1Start = mondayOnOrBefore(firstOfMonth);
  return addDaysIso(week1Start, weekIndex * 7);
}

export function resolveWeekStartDate(monthKey: string, weekIndex: number, month: MonthData): string {
  const week1Start = month.week1StartDate || defaultWeekStartDate(monthKey, 0);
  return addDaysIso(week1Start, weekIndex * 7);
}

export function dateForDay(monthKey: string, weekIndex: number, month: MonthData, dayName: DayName): string {
  return addDaysIso(resolveWeekStartDate(monthKey, weekIndex, month), DAYS.indexOf(dayName));
}

// "7" — solo el número de día, para chips angostos.
export function formatDayNumber(dateStr: string): string {
  return String(new Date(`${dateStr}T00:00:00`).getDate());
}

// "7 sep" — para chips y tablas compactas.
export function formatShortDayDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(".", "");
}

// "Lunes 7 de septiembre de 2026" — para encabezados.
export function formatLongDayDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const label = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// "1 – 7 sep" — para mostrar junto a la pestaña de cada semana.
export function formatWeekRange(startDate: string): string {
  const end = addDaysIso(startDate, 6);
  const startD = new Date(`${startDate}T00:00:00`);
  const endD = new Date(`${end}T00:00:00`);
  const sameMonth = startD.getMonth() === endD.getMonth();
  const startLabel = startD.toLocaleDateString("es-MX", { day: "numeric", month: sameMonth ? undefined : "short" });
  const endLabel = endD.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return `${startLabel} – ${endLabel}`;
}

// week1Start: fecha real (Lunes) donde debe empezar la semana 1, cuando ya
// se conoce (ej. hoy, si apenas estás empezando a usar el mes; o la fecha
// real de una asignación de staff). Si no se da, usa el default por
// día-del-mes (menos confiable si empiezas a capturar a media semana/mes).
export function buildMonth(monthKey: string, week1Start?: string): MonthData {
  const [y, m] = monthKey.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const weeks: WeekData[] = Array.from({ length: 4 }, () => ({
    days: Object.fromEntries(DAYS.map((d) => [d, emptyDay()])) as Record<DayName, DayData>,
  }));
  return {
    label: label.charAt(0).toUpperCase() + label.slice(1),
    weeks,
    week1StartDate: week1Start || defaultWeekStartDate(monthKey, 0),
  };
}

export function defaultData(): AppData {
  return { meseros: [], proveedores: [], facturas: [], months: {} };
}

// Repara datos guardados antes de que existieran `proveedores`/`facturas`, y
// migra las facturas que en una versión anterior vivían dentro de cada día
// (day.facturas) hacia la lista plana de nivel superior. Nunca se pierden
// datos ya capturados. Devuelve `changed: true` solo si hubo algo que migrar
// o normalizar, para no reescribir el registro sin necesidad.
export function migrateAppData(raw: AppData): { data: AppData; changed: boolean } {
  let changed = false;
  const data: AppData = { ...raw };

  if (!data.proveedores) {
    data.proveedores = [];
    changed = true;
  }
  if (!data.facturas) {
    data.facturas = [];
    changed = true;
  }

  const proveedores = [...data.proveedores];
  const facturas = [...data.facturas];

  function proveedorIdFor(nombre: string): string {
    const existing = proveedores.find((p) => p.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
    if (existing) return existing.id;
    const entry = { id: uid(), nombre: nombre.trim() };
    proveedores.push(entry);
    return entry.id;
  }

  Object.entries(data.months).forEach(([monthKey, month]) => {
    // Migra la fecha ancla por semana (diseño anterior, de muy corta vida)
    // a la fecha ancla única por mes.
    if (!month.week1StartDate) {
      const weekWithLegacyDate = month.weeks
        .map((w, i) => ({ w: w as WeekData & { startDate?: string }, i }))
        .find(({ w }) => w.startDate);
      if (weekWithLegacyDate) {
        month.week1StartDate = addDaysIso(weekWithLegacyDate.w.startDate as string, -weekWithLegacyDate.i * 7);
        changed = true;
      }
    }
    month.weeks.forEach((week) => {
      const legacyStartDate = (week as WeekData & { startDate?: string }).startDate;
      if (legacyStartDate !== undefined) {
        delete (week as WeekData & { startDate?: string }).startDate;
        changed = true;
      }
    });

    month.weeks.forEach((week, weekIndex) => {
      DAYS.forEach((dayName) => {
        const day = week.days[dayName] as DayData & { facturas?: unknown[] };
        const legacy = day.facturas as
          | { id: string; proveedor: string; total: number; estado: "pendiente" | "ingresado" }[]
          | undefined;
        if (!legacy || legacy.length === 0) return;
        legacy.forEach((f) => {
          facturas.push({
            id: f.id,
            proveedorId: proveedorIdFor(f.proveedor),
            numero: "",
            total: f.total,
            fecha: approximateDateForLocation(monthKey, weekIndex, dayName),
            estado: f.estado,
            categoria: "operacion",
          });
        });
        delete day.facturas;
        changed = true;
      });
    });
  });

  data.proveedores = proveedores;
  data.facturas = facturas;
  return { data, changed };
}

// Solo para migrar facturas que antes vivían en un día del corte: aproxima
// una fecha real a partir de mes/semana/día usando la misma convención de
// locateDate (semana 1 = días 1-7, semana 2 = 8-14, ...).
function approximateDateForLocation(monthKey: string, weekIndex: number, dayName: DayName): string {
  const [y, m] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dayOfMonth = Math.min(weekIndex * 7 + 1 + DAYS.indexOf(dayName), daysInMonth);
  return `${y}-${String(m).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
}

export interface DateLocation {
  monthKey: string;
  weekIndex: number;
  dayName: DayName;
}

// Convención: semana 1 = días 1-7 del mes, semana 2 = 8-14, semana 3 = 15-21, semana 4 = 22-fin.
export function locateDate(dateStr: string): DateLocation {
  const date = new Date(`${dateStr}T00:00:00`);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const monthKey = `${y}-${String(m).padStart(2, "0")}`;
  const dayOfMonth = date.getDate();
  const weekIndex = Math.min(3, Math.floor((dayOfMonth - 1) / 7));
  // getDay(): 0 = Domingo ... 6 = Sábado. DAYS empieza en Lunes.
  const jsDay = date.getDay();
  const dayName = DAYS[(jsDay + 6) % 7];
  return { monthKey, weekIndex, dayName };
}

// El mes y el día de la semana de una fecha siempre son inequívocos, pero la
// semana ("Semana 1/2/3/4") es una pestaña manual del corte — no siempre
// coincide con el cálculo automático por fecha. Si la asignación ya trae su
// propia semana guardada (elegida por el dueño), se usa esa; si no (datos
// viejos), se usa el cálculo automático como respaldo.
export function resolveAssignmentLocation(dateStr: string, weekIndexOverride: number | null | undefined): DateLocation {
  const loc = locateDate(dateStr);
  if (weekIndexOverride !== null && weekIndexOverride !== undefined) {
    return { ...loc, weekIndex: weekIndexOverride };
  }
  return loc;
}

export function formatAssignedDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const label = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function computeWeekGastos(week: WeekData) {
  let totalMonto = 0, totalIngresado = 0, totalPendiente = 0, countIngresado = 0, countPendiente = 0;
  const perDay = DAYS.map((d) => {
    const items = week.days[d].gastos;
    const dayTotal = items.reduce((s, g) => s + g.total, 0);
    items.forEach((g) => {
      totalMonto += g.total;
      if (g.estado === "ingresado") { totalIngresado += g.total; countIngresado += 1; }
      else { totalPendiente += g.total; countPendiente += 1; }
    });
    return { day: d, items, dayTotal: round2(dayTotal) };
  });
  return {
    perDay,
    totalMonto: round2(totalMonto),
    totalIngresado: round2(totalIngresado),
    totalPendiente: round2(totalPendiente),
    countIngresado,
    countPendiente,
    countTotal: countIngresado + countPendiente,
  };
}

export function computeWeekSummary(week: WeekData) {
  let ventaMeseros = 0, ventaApps = 0, tarjetas = 0, propina = 0, gastos = 0, transferencias = 0, efectivoSum = 0;
  const perDay = DAYS.map((d) => {
    const day = week.days[d];
    const dVentaMeseros = day.meseros.reduce((s, m) => s + m.venta, 0);
    const dTarjetas = day.meseros.reduce((s, m) => s + m.tarjetas, 0);
    const dPropina = day.meseros.reduce((s, m) => s + m.propina, 0);
    const dApps = day.ventaApps || 0;
    const dGastos = day.gastos.reduce((s, g) => s + g.total, 0);
    const dTransfer = day.transferencias.reduce((s, t) => s + t.total, 0);
    // Efectivo del día: venta de meseros menos tarjetas, gastos y transferencias. No incluye propinas ni ventas de apps.
    const dEfectivo = round2(dVentaMeseros - dTarjetas - dGastos - dTransfer);

    ventaMeseros += dVentaMeseros; ventaApps += dApps; tarjetas += dTarjetas; propina += dPropina;
    gastos += dGastos; transferencias += dTransfer; efectivoSum += dEfectivo;

    return {
      day: d,
      ventaLocal: round2(dVentaMeseros),
      ventaApps: round2(dApps),
      ventaTotal: round2(dVentaMeseros + dApps),
      tarjetas: round2(dTarjetas),
      transferencias: round2(dTransfer),
      gastos: round2(dGastos),
      propina: round2(dPropina),
      efectivo: dEfectivo,
    };
  });
  return {
    perDay,
    ventaLocal: round2(ventaMeseros),
    ventaApps: round2(ventaApps),
    ventaTotal: round2(ventaMeseros + ventaApps),
    tarjetas: round2(tarjetas),
    transferencias: round2(transferencias),
    gastos: round2(gastos),
    propina: round2(propina),
    efectivoRecibido: round2(efectivoSum),
    efectivoReal: week.efectivoReal ?? null,
  };
}

// Reporte de resultados de la semana: solo lectura (salvo Nómina, que por
// ahora se captura a mano porque no existe todavía un generador de nómina).
// "Gastos operativos" junta los gastos en efectivo categorizados como
// Operación con los gastos operativos en transferencia de Proveedores —
// son el mismo concepto, solo con distinta forma de pago. Gastos fijos y
// las 3 comisiones de apps vienen tal cual de Proveedores. El resto de
// categorías en efectivo (cortesía, retiro, mantenimiento, comida
// empleado, envíos, cancelaciones, otro, o sin categoría) se desglosan
// cada una en su propia línea, para que la Utilidad reste todo lo
// gastado con total transparencia de en qué se fue cada peso.
export function computeDashboardReport(week: WeekData) {
  const { ventaTotal } = computeWeekSummary(week);

  let operacionEfectivo = 0;
  const otrosPorCategoria: Partial<Record<GastoCategoria | "sin_categoria", number>> = {};
  DAYS.forEach((d) => {
    week.days[d].gastos.forEach((g) => {
      if (g.categoria === "operacion") {
        operacionEfectivo += g.total;
      } else {
        const key = g.categoria || "sin_categoria";
        otrosPorCategoria[key] = round2((otrosPorCategoria[key] || 0) + g.total);
      }
    });
  });

  const credito = week.creditoProveedores;
  const gastosOperativos = round2(operacionEfectivo + (credito?.operativos || 0));
  const gastosFijos = round2(credito?.fijos || 0);
  const comisionDidi = round2(credito?.comisionDidi || 0);
  const comisionUber = round2(credito?.comisionUber || 0);
  const comisionRappi = round2(credito?.comisionRappi || 0);
  const nomina = round2(week.nominaManual || 0);

  const pct = (n: number) => (ventaTotal > 0 ? round2((n / ventaTotal) * 100) : 0);

  const otrosCategorias = [
    ...GASTO_CATEGORIAS.filter((c) => c.value !== "operacion").map((c) => ({
      key: c.value as string,
      label: c.value === "nomina" ? "Nómina (gastos en efectivo)" : c.label,
      total: otrosPorCategoria[c.value] || 0,
    })),
    { key: "sin_categoria", label: "Sin categoría", total: otrosPorCategoria.sin_categoria || 0 },
  ].map((c) => ({ ...c, pct: pct(c.total) }));

  const otrosTotal = round2(otrosCategorias.reduce((s, c) => s + c.total, 0));

  const totalGastos = round2(gastosOperativos + gastosFijos + comisionDidi + comisionUber + comisionRappi + otrosTotal + nomina);
  const utilidad = round2(ventaTotal - totalGastos);

  return {
    ventaTotal,
    gastosOperativos,
    gastosFijos,
    comisionDidi,
    comisionUber,
    comisionRappi,
    otrosCategorias,
    nomina,
    utilidad,
    pct: {
      ventaTotal: 100,
      gastosOperativos: pct(gastosOperativos),
      gastosFijos: pct(gastosFijos),
      comisionDidi: pct(comisionDidi),
      comisionUber: pct(comisionUber),
      comisionRappi: pct(comisionRappi),
      nomina: pct(nomina),
      utilidad: pct(utilidad),
    },
  };
}
