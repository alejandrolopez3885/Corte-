import { Check } from "lucide-react";
import { Sheet } from "../ui";
import { computeWeekFacturas, money } from "../../lib/dataModel";
import type { DayName, WeekData } from "../../lib/types";

export function FacturasSummaryModal({
  onClose,
  week,
  weekLabel,
  onToggleEstado,
}: {
  onClose: () => void;
  week: WeekData;
  weekLabel: string;
  onToggleEstado: (dayName: DayName, id: string) => void;
}) {
  const f = computeWeekFacturas(week);
  return (
    <Sheet title={weekLabel} onClose={onClose}>
      <p className="hint">Facturas y notas de proveedores pagadas por transferencia. No forman parte de tu efectivo.</p>
      <div className="summary-grid-modal">
        <div className="summary-item highlight" style={{ gridColumn: "1 / -1" }}>
          <span>Total de facturas ({f.countTotal})</span>
          <strong>{money(f.totalMonto)}</strong>
        </div>
        <div className="summary-item">
          <span>Ingresadas ({f.countIngresado})</span>
          <strong>{money(f.totalIngresado)}</strong>
        </div>
        <div className="summary-item">
          <span>Pendientes ({f.countPendiente})</span>
          <strong>{money(f.totalPendiente)}</strong>
        </div>
      </div>

      <div className="gastos-days">
        {f.perDay.map((d) => (
          <div key={d.day} className="gastos-day-block">
            <div className="gastos-day-head">
              <span>{d.day}</span>
              <strong>{money(d.dayTotal)}</strong>
            </div>
            {d.items.length === 0 ? (
              <p className="hint">Sin facturas este día.</p>
            ) : (
              <div className="gasto-existing-list">
                {d.items.map((item) => (
                  <div key={item.id} className="gasto-existing-row gasto-row-classify">
                    <div className="gasto-row-main">
                      <span className="gasto-existing-concepto">{item.proveedor}</span>
                      <span className="gasto-existing-monto">{money(item.total)}</span>
                    </div>
                    <div className="gasto-row-controls">
                      <span className="categoria-badge">Operación</span>
                      <button type="button" className={`estado-chip ${item.estado}`} onClick={() => onToggleEstado(d.day, item.id)}>
                        {item.estado === "pendiente" ? (
                          "Confirmar"
                        ) : (
                          <>
                            <Check size={13} /> Ingresada
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="week-total-row">
        <span>Total semanal</span>
        <strong>{money(f.totalMonto)}</strong>
      </div>
    </Sheet>
  );
}
