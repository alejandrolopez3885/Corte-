import { DAYS } from "./types";
import type { DayName, EmpleadoEntry, WeekData } from "./types";

// Comidas gratis por semana (Personal › ficha del empleado): de sus gastos
// "Comida empleado" de la semana, primero son gratis las de valor o menos
// (en orden de los días); si todavía le quedan comidas gratis, a las de más
// del valor se les quita ese valor y solo se rebaja lo demás. Lo gratis no
// se le descuenta en la nómina (sale "$0 · gratis") y en Cuadrar se junta
// en un solo gasto el domingo, como se sube a Johnster.

export interface ComidaRepartida {
  gastoId: string;
  dia: DayName;
  concepto: string;
  total: number;
  gratis: number;
  rebaja: number;
}

export function repartoComidas(week: WeekData | null | undefined, empleado: EmpleadoEntry | undefined): ComidaRepartida[] {
  if (!week || !empleado) return [];
  const comidas: ComidaRepartida[] = [];
  DAYS.forEach((dia) =>
    (week.days[dia]?.gastos || []).forEach((g) => {
      if (g.categoria === "comida_empleado" && g.empleadoId === empleado.id)
        comidas.push({ gastoId: g.id, dia, concepto: g.concepto, total: g.total, gratis: 0, rebaja: g.total });
    })
  );
  const cg = empleado.comidasGratis;
  let quedan = cg?.porSemana || 0;
  const valor = cg?.valor || 0;
  if (!quedan || !valor) return comidas;
  for (const c of comidas)
    if (quedan > 0 && c.total <= valor) {
      c.gratis = c.total;
      c.rebaja = 0;
      quedan--;
    }
  for (const c of comidas)
    if (quedan > 0 && c.total > valor && c.gratis === 0) {
      c.gratis = valor;
      c.rebaja = Math.round((c.total - valor) * 100) / 100;
      quedan--;
    }
  return comidas;
}
