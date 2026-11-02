import { useState } from "react";
import { Coins } from "lucide-react";
import { Empty } from "../ui";
import { SelectorSemana } from "../SelectorSemana";
import { dateForDay, formatShortDayDate, money, repartoPropinas, round2 } from "../../lib/dataModel";
import { DAYS } from "../../lib/types";
import type { MonthData } from "../../lib/types";
import { TituloPagina } from "../BarraTitulo";

// Consulta de propinas: total por día (sumando los cortes de todos los
// meseros) y total de la semana, más el reparto por área. Solo lectura —
// la misma pantalla la ve el dueño desde Equipo y una cuenta de equipo con
// el permiso "Propinas".
export function PropinasPanel({
  onBack,
  backLabel = "Equipo",
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
}: {
  onBack?: () => void;
  backLabel?: string;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const month = months[monthKey];

  if (!month) {
    return (
      <div className="page-section">
        <TituloPagina titulo="Propinas" onBack={onBack} backLabel={backLabel} />
        <Empty icon={<Coins size={26} strokeWidth={1.3} />} text="Todavía no hay ningún mes creado en Corte." />
      </div>
    );
  }

  const week = month.weeks[weekIndex];
  const porDia = DAYS.map((day) => ({
    day,
    fecha: dateForDay(monthKey, weekIndex, month, day),
    propina: round2((week?.days[day]?.meseros || []).reduce((s, m) => s + (m.propina || 0), 0)),
  }));
  const totalSemana = round2(porDia.reduce((s, d) => s + d.propina, 0));
  const reparto = repartoPropinas(totalSemana);

  return (
    <div className="page-section">
      <TituloPagina titulo="Propinas" onBack={onBack} backLabel={backLabel} />
      <p className="hint">Total de propinas de cada día, tomado de los cortes de los meseros. Solo consulta.</p>

      <SelectorSemana
        months={months}
        monthKeys={monthKeys}
        monthKey={monthKey}
        weekIndex={weekIndex}
        onCambiar={(mk, wi) => {
          setMonthKey(mk);
          setWeekIndex(wi);
        }}
      />

      <div className="propinas-dias">
        {porDia.map((d) => (
          <div key={d.day} className={`propinas-dia ${d.propina === 0 ? "cero" : ""}`}>
            <span>
              {d.day}
              <em>{formatShortDayDate(d.fecha)}</em>
            </span>
            <strong>{money(d.propina)}</strong>
          </div>
        ))}
        <div className="propinas-dia total">
          <span>Total semana</span>
          <strong>{money(totalSemana)}</strong>
        </div>
      </div>

      <div className="propinas-reparto">
        <span className="propinas-reparto-title">Cómo se reparte (solo informativo)</span>
        {reparto.map((a) => (
          <div key={a.id} className={`propinas-reparto-area ${a.id}`}>
            <span>
              {a.nombre}
              <em>1%</em>
            </span>
            <strong>{money(a.monto)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
