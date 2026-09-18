import { useState } from "react";
import { ArrowLeft, Wallet } from "lucide-react";
import { Empty, Field } from "../ui";
import { computeNominaSemana, formatWeekRange, money, resolveWeekStartDate } from "../../lib/dataModel";
import { DAY_SHORT } from "../../lib/types";
import type { EmpleadoEntry, HorarioMonthData, MonthData } from "../../lib/types";

export function NominaPanel({
  onBack,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  empleados,
  horarios,
  onGoToHorarios,
}: {
  onBack: () => void;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  empleados: EmpleadoEntry[];
  horarios: Record<string, HorarioMonthData>;
  onGoToHorarios: () => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);

  const month = months[monthKey];

  if (!month) {
    return (
      <div className="page-section">
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> Equipo
        </button>
        <h2 className="page-title">Nómina</h2>
        <Empty icon={<Wallet size={26} strokeWidth={1.3} />} text="Primero crea un mes en Corte para poder calcular la nómina." />
      </div>
    );
  }

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const semana = horarios[monthKey]?.weeks?.[weekIndex] ?? null;
  const reporte = computeNominaSemana(semana, empleados);
  const totalSemana = reporte.reduce((s, e) => s + e.total, 0);

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Equipo
      </button>
      <h2 className="page-title">Nómina</h2>
      <p className="hint">
        Calculada sola a partir de Horarios y el sueldo diario de cada quien en Personal: Z paga doble, O/X pagan normal, y el
        descanso (OFF) solo se paga si se trabajaron los otros 6 días.
      </p>

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
                Semana {i + 1}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="hint">{formatWeekRange(weekStartDate)}</p>

      {!semana ? (
        <>
          <Empty
            icon={<Wallet size={26} strokeWidth={1.3} />}
            text="Aún no has capturado el horario de esta semana — la nómina se calcula de ahí."
          />
          <button className="link-btn" onClick={onGoToHorarios}>
            Ir a Horarios
          </button>
        </>
      ) : reporte.length === 0 ? (
        <Empty icon={<Wallet size={26} strokeWidth={1.3} />} text="El horario de esta semana no tiene personal capturado todavía." />
      ) : (
        <>
          {reporte.map((e) => (
            <div className="nomina-emp" key={e.empleadoId}>
              <div className="nomina-emp-head">
                <strong>{e.nombre}</strong>
                <strong className="nomina-emp-total">{money(e.total)}</strong>
              </div>
              {e.sueldoDiario === 0 ? (
                <p className="nomina-emp-sub">Sin sueldo diario capturado en Personal.</p>
              ) : (
                <p className="nomina-emp-sub">
                  {e.areaNombre} · {money(e.sueldoDiario)}/día · {e.diasTrabajados} días trabajados
                  {e.offPagado ? " · descanso pagado" : ""}
                </p>
              )}
              <div className="nomina-dias">
                {e.dias.map((d) => (
                  <div className={`nomina-dia ${d.monto === 0 ? "cero" : ""}`} key={d.day}>
                    <div className="nomina-dia-label">{DAY_SHORT[d.day]}</div>
                    <div className="nomina-dia-valor">{d.valor || "–"}</div>
                    <div className="nomina-dia-monto">{money(d.monto)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="report-list">
            <div className="report-row total">
              <span className="report-row-label">Total de la semana</span>
              <strong className="report-row-amount">{money(totalSemana)}</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
