import { useState } from "react";
import { ArrowLeft, Coins } from "lucide-react";
import { Empty, Field } from "../ui";
import { dateForDay, formatShortDayDate, formatWeekRange, isoWeekNumber, money, resolveWeekStartDate, round2 } from "../../lib/dataModel";
import { DAYS } from "../../lib/types";
import type { MonthData } from "../../lib/types";

// Cómo se reparte la propina entre las áreas — cada una se lleva una
// tercera parte (el 1% de la propina de 3%). Solo informativo: no afecta
// el corte ni la nómina.
const REPARTO_AREAS = [
  { id: "cocina", nombre: "Cocina" },
  { id: "barra", nombre: "Barra" },
  { id: "gerencia", nombre: "Gerencia" },
] as const;

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
        {onBack && (
          <button className="link-btn back-link" onClick={onBack}>
            <ArrowLeft size={15} /> {backLabel}
          </button>
        )}
        <h2 className="page-title">Propinas</h2>
        <Empty icon={<Coins size={26} strokeWidth={1.3} />} text="Todavía no hay ningún mes creado en Corte." />
      </div>
    );
  }

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const week = month.weeks[weekIndex];
  const porDia = DAYS.map((day) => ({
    day,
    fecha: dateForDay(monthKey, weekIndex, month, day),
    propina: round2((week?.days[day]?.meseros || []).reduce((s, m) => s + (m.propina || 0), 0)),
  }));
  const totalSemana = round2(porDia.reduce((s, d) => s + d.propina, 0));
  // Un tercio para cada área; el centavo que sobre al redondear se lo lleva
  // la última, para que las tres sumen exactamente el total.
  const tercio = Math.floor((totalSemana / 3) * 100) / 100;
  const reparto = REPARTO_AREAS.map((a, i) => ({
    ...a,
    monto: i < REPARTO_AREAS.length - 1 ? tercio : round2(totalSemana - tercio * (REPARTO_AREAS.length - 1)),
  }));

  return (
    <div className="page-section">
      {onBack && (
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
      )}
      <h2 className="page-title">Propinas</h2>
      <p className="hint">Total de propinas de cada día, tomado de los cortes de los meseros. Solo consulta.</p>

      <div className="field-row">
        <Field label="Mes">
          <select
            className="text-input"
            value={monthKey}
            onChange={(e) => {
              setMonthKey(e.target.value);
              setWeekIndex(0);
            }}
          >
            {monthKeys.map((mk) => (
              <option key={mk} value={mk}>
                {months[mk].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Semana">
          <select className="text-input" value={weekIndex} onChange={(e) => setWeekIndex(Number(e.target.value))}>
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                Semana {isoWeekNumber(resolveWeekStartDate(monthKey, i, month))}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="hint">{formatWeekRange(weekStartDate)}</p>

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
