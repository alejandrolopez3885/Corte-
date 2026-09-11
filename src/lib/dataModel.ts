import { DAYS, type AppData, type DayData, type DayName, type MeseroCut, type MonthData, type WeekData } from "./types";

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

export function buildMonth(monthKey: string): MonthData {
  const [y, m] = monthKey.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const weeks: WeekData[] = Array.from({ length: 4 }, () => ({
    days: Object.fromEntries(DAYS.map((d) => [d, emptyDay()])) as Record<DayName, DayData>,
  }));
  return { label: label.charAt(0).toUpperCase() + label.slice(1), weeks };
}

export function defaultData(): AppData {
  return { meseros: [], months: {} };
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
      venta: round2(dVentaMeseros + dApps),
      tarjetas: round2(dTarjetas),
      transferencias: round2(dTransfer),
      gastos: round2(dGastos),
      propina: round2(dPropina),
      efectivo: dEfectivo,
    };
  });
  return {
    perDay,
    ventaTotal: round2(ventaMeseros + ventaApps),
    tarjetas: round2(tarjetas),
    transferencias: round2(transferencias),
    gastos: round2(gastos),
    propina: round2(propina),
    efectivoRecibido: round2(efectivoSum),
    efectivoReal: week.efectivoReal ?? null,
  };
}
