import { Field } from "./ui";
import { formatWeekRange, resolveWeekStartDate } from "../lib/dataModel";
import type { MonthData } from "../lib/types";

// Mes y semana con sus fechas ("Nov 2026", "Sem 1 · 2–8 nov"), para
// que no se corten en el celular y se sepa qué semana es sin buscarla.
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesCorto = (mk: string) => `${MESES[Number(mk.slice(5, 7)) - 1]} ${mk.slice(0, 4)}`;

export function SelectorSemana({
  months,
  monthKeys,
  monthKey,
  weekIndex,
  onCambiar,
}: {
  months: Record<string, MonthData>;
  monthKeys: string[];
  monthKey: string;
  weekIndex: number;
  onCambiar: (monthKey: string, weekIndex: number) => void;
}) {
  const month = months[monthKey];
  return (
    <div className="field-row selector-semana">
      <Field label="Mes">
        <select className="text-input" value={monthKey} onChange={(e) => onCambiar(e.target.value, 0)}>
          {monthKeys.map((mk) => (
            <option key={mk} value={mk}>
              {mesCorto(mk)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Semana">
        <select className="text-input" value={weekIndex} onChange={(e) => onCambiar(monthKey, Number(e.target.value))}>
          {[0, 1, 2, 3].map((i) => (
            <option key={i} value={i}>
              Sem {i + 1}
              {month ? ` · ${formatWeekRange(resolveWeekStartDate(monthKey, i, month)).replace(" – ", "–")}` : ""}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
