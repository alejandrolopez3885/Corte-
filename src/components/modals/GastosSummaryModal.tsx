import { Check } from "lucide-react";
import { Sheet } from "../ui";
import { computeWeekGastos, dateForDay, formatShortDayDate, money } from "../../lib/dataModel";
import { GASTO_CATEGORIAS } from "../../lib/types";
import type { DayName, GastoCategoria, WeekData } from "../../lib/types";

export function GastosSummaryModal({
  onClose,
  week,
  weekLabel,
  monthKey,
  weekIndex,
  onToggleEstado,
  onSetCategoria,
}: {
  onClose: () => void;
  week: WeekData;
  weekLabel: string;
  monthKey: string;
  weekIndex: number;
  onToggleEstado: (dayName: DayName, id: string) => void;
  onSetCategoria: (dayName: DayName, id: string, categoria: GastoCategoria | "") => void;
}) {
  const g = computeWeekGastos(week);
  return (
    <Sheet title={weekLabel} onClose={onClose}>
      <div className="summary-grid-modal">
        <div className="summary-item highlight" style={{ gridColumn: "1 / -1" }}>
          <span>Total de gastos ({g.countTotal})</span>
          <strong>{money(g.totalMonto)}</strong>
        </div>
        <div className="summary-item">
          <span>Ingresados ({g.countIngresado})</span>
          <strong>{money(g.totalIngresado)}</strong>
        </div>
        <div className="summary-item">
          <span>Pendientes ({g.countPendiente})</span>
          <strong>{money(g.totalPendiente)}</strong>
        </div>
      </div>
      <p className="hint">
        Elige la categoría de cada gasto antes de confirmarlo. Una vez ingresado, la categoría queda bloqueada — para cambiarla,
        vuelve a marcarlo como pendiente.
      </p>

      <div className="gastos-days">
        {g.perDay.map((d) => (
          <div key={d.day} className="gastos-day-block">
            <div className="gastos-day-head">
              <span>
                {d.day} <em>{formatShortDayDate(dateForDay(monthKey, weekIndex, week, d.day))}</em>
              </span>
              <strong>{money(d.dayTotal)}</strong>
            </div>
            {d.items.length === 0 ? (
              <p className="hint">Sin gastos este día.</p>
            ) : (
              <div className="gasto-existing-list">
                {d.items.map((item) => (
                  <div key={item.id} className="gasto-existing-row gasto-row-classify">
                    <div className="gasto-row-main">
                      <span className="gasto-existing-concepto">{item.concepto}</span>
                      <span className="gasto-existing-monto">{money(item.total)}</span>
                    </div>
                    <div className="gasto-row-controls">
                      <select
                        className="categoria-select"
                        value={item.categoria || ""}
                        disabled={item.estado === "ingresado"}
                        onChange={(e) => onSetCategoria(d.day, item.id, e.target.value as GastoCategoria | "")}
                      >
                        <option value="">Sin categoría</option>
                        {GASTO_CATEGORIAS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={`estado-chip ${item.estado}`}
                        disabled={item.estado === "pendiente" && !item.categoria}
                        onClick={() => onToggleEstado(d.day, item.id)}
                      >
                        {item.estado === "pendiente" ? (
                          "Confirmar"
                        ) : (
                          <>
                            <Check size={13} /> Ingresado
                          </>
                        )}
                      </button>
                    </div>
                    {item.estado === "pendiente" && !item.categoria && (
                      <p className="hint gasto-row-hint">Elige una categoría para poder confirmarlo.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="week-total-row">
        <span>Total semanal</span>
        <strong>{money(g.totalMonto)}</strong>
      </div>
    </Sheet>
  );
}
