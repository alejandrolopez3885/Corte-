import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Circle, CircleDot, TriangleAlert } from "lucide-react";
import { Empty, Field, NumInput, Sheet } from "../ui";
import {
  dateForDay,
  formatDayNumber,
  formatLongDayDate,
  formatWeekRange,
  mostRecentDayInWeek,
  resolveWeekStartDate,
  sumFromText,
} from "../../lib/dataModel";
import { DAYS, DAY_SHORT } from "../../lib/types";
import type { DayName, InsumoEntry, MonthData } from "../../lib/types";

export function ConteoDiarioPanel({
  onBack,
  backLabel,
  emptyIcon,
  emptyText,
  insumos,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  conteosDiarios,
  onGuardar,
}: {
  onBack: () => void;
  backLabel: string;
  emptyIcon: ReactNode;
  emptyText: string;
  insumos: InsumoEntry[];
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  conteosDiarios: Record<string, Record<string, number>>;
  onGuardar: (fecha: string, valores: Record<string, number>) => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [dayName, setDayName] = useState<DayName>(() =>
    months[initialMonthKey] ? mostRecentDayInWeek(initialMonthKey, initialWeekIndex, months[initialMonthKey]) : "Lunes"
  );
  const [valores, setValores] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState(false);
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false);

  const month = months[monthKey] || null;
  const weekStartDate = month ? resolveWeekStartDate(monthKey, weekIndex, month) : null;
  const fecha = month ? dateForDay(monthKey, weekIndex, month, dayName) : null;

  // Cada vez que se cambia de día se recarga lo ya guardado para esa
  // fecha (si lo hay) y se bloquean los campos, para que reabrir un
  // conteo pasado nunca lo deje editable "por accidente".
  useEffect(() => {
    if (!fecha) return;
    const guardadoDelDia = conteosDiarios[fecha] || {};
    const init: Record<string, string> = {};
    insumos.forEach((i) => {
      init[i.id] = guardadoDelDia[i.id] !== undefined ? String(guardadoDelDia[i.id]) : "";
    });
    setValores(init);
    setLocked(Object.keys(guardadoDelDia).length > 0);
    setPidiendoConfirmacion(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  if (monthKeys.length === 0 || !month || !fecha || !weekStartDate) {
    return (
      <div className="page-section">
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
        <h2 className="page-title">Conteo diario</h2>
        <Empty icon={emptyIcon} text="Primero crea un mes en Corte para poder llevar el conteo diario." />
      </div>
    );
  }

  function irASemana(mk: string, wi: number) {
    setMonthKey(mk);
    setWeekIndex(wi);
    setDayName(mostRecentDayInWeek(mk, wi, months[mk]));
  }

  function guardar() {
    if (!fecha) return;
    const out: Record<string, number> = {};
    insumos.forEach((i) => {
      if (valores[i.id]?.trim()) out[i.id] = sumFromText(valores[i.id]);
    });
    onGuardar(fecha, out);
    setLocked(true);
  }

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> {backLabel}
      </button>
      <h2 className="page-title">Conteo diario</h2>

      <div className="field-row">
        <Field label="Mes">
          <select className="text-input" value={monthKey} onChange={(e) => irASemana(e.target.value, 0)}>
            {monthKeys.map((mk) => (
              <option key={mk} value={mk}>
                {months[mk].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Semana">
          <select className="text-input" value={weekIndex} onChange={(e) => irASemana(monthKey, Number(e.target.value))}>
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                Semana {i + 1}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="hint">{formatWeekRange(weekStartDate)}</p>

      <nav className="day-scroll">
        {DAYS.map((d) => {
          const dDate = dateForDay(monthKey, weekIndex, month, d);
          const hasData = Object.keys(conteosDiarios[dDate] || {}).length > 0;
          return (
            <button key={d} className={`day-chip ${d === dayName ? "active" : ""}`} onClick={() => setDayName(d)}>
              {hasData ? <CircleDot size={9} /> : <Circle size={9} />}
              {DAY_SHORT[d]} <span className="day-chip-date">{formatDayNumber(dDate)}</span>
            </button>
          );
        })}
      </nav>
      <p className="active-day-date">{formatLongDayDate(fecha)}</p>

      {insumos.length === 0 ? (
        <Empty icon={emptyIcon} text={emptyText} />
      ) : (
        <>
          {locked && (
            <div className="conteo-locked-banner">
              <span>Este conteo ya está guardado y los campos están bloqueados.</span>
              <button className="link-btn" onClick={() => setPidiendoConfirmacion(true)}>
                Editar
              </button>
            </div>
          )}
          <div className="catalog-list">
            {insumos.map((i) => (
              <div key={i.id} className="catalog-row conteo-row">
                <div>
                  <strong>{i.nombre}</strong>
                  <span>{i.unidad}</span>
                </div>
                <NumInput
                  value={valores[i.id] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [i.id]: e.target.value }))}
                  placeholder="0"
                  disabled={locked}
                />
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={guardar} disabled={locked}>
            Guardar conteo
          </button>
        </>
      )}

      {pidiendoConfirmacion && (
        <Sheet title="Editar conteo guardado" onClose={() => setPidiendoConfirmacion(false)}>
          <p className="hint">
            Este conteo de {formatLongDayDate(fecha)} ya se guardó. No deberías editarlo salvo que
            estés seguro de que el valor capturado está mal — cambiarlo afecta tu historial de
            inventario de ese día.
          </p>
          <button
            className="btn-warn"
            onClick={() => {
              setLocked(false);
              setPidiendoConfirmacion(false);
            }}
          >
            <TriangleAlert size={16} /> Sí, necesito editarlo
          </button>
          <button className="link-btn" onClick={() => setPidiendoConfirmacion(false)}>
            Cancelar
          </button>
        </Sheet>
      )}
    </div>
  );
}
