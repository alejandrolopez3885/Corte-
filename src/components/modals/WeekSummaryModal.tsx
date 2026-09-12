import { useState } from "react";
import { Sheet, Field, SumInput } from "../ui";
import { computeWeekSummary, dateForDay, formatShortDayDate, formatWeekRange, money, resolveWeekStartDate, round2, sumFromText } from "../../lib/dataModel";
import { DAY_SHORT } from "../../lib/types";
import type { MonthData, WeekData } from "../../lib/types";

export function WeekSummaryModal({
  onClose,
  week,
  month,
  weekLabel,
  monthKey,
  weekIndex,
  onSaveEfectivoReal,
  onSaveStartDate,
}: {
  onClose: () => void;
  week: WeekData;
  month: MonthData;
  weekLabel: string;
  monthKey: string;
  weekIndex: number;
  onSaveEfectivoReal: (rawValue: string) => void;
  onSaveStartDate: (dateStr: string) => void;
}) {
  const s = computeWeekSummary(week);
  const [realText, setRealText] = useState(s.efectivoReal != null ? String(s.efectivoReal) : "");
  const startDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const [dateDraft, setDateDraft] = useState(startDate);

  function commitReal() {
    const sum = sumFromText(realText);
    const next = realText.trim() === "" ? "" : String(sum);
    setRealText(next);
    onSaveEfectivoReal(next);
  }

  const hasReal = realText.trim() !== "";
  const realValue = sumFromText(realText);
  const diff = round2(realValue - s.efectivoRecibido);

  return (
    <Sheet title={weekLabel} onClose={onClose}>
      <div className="real-cash">
        <Field label="Esta semana empieza el (Lunes)">
          <input type="date" className="date-input" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} />
        </Field>
        {dateDraft !== startDate ? (
          <button className="btn-primary" onClick={() => onSaveStartDate(dateDraft)}>
            Corregir y recorrer todo el mes
          </button>
        ) : (
          <p className="hint">
            {formatWeekRange(startDate)}. Si la corriges, las demás semanas del mes se recorren junto con ella (siempre quedan
            de Lunes a Domingo, aunque se asomen a otro mes).
          </p>
        )}
      </div>

      <div className="summary-grid-modal">
        <div className="summary-item highlight">
          <span>Venta total</span>
          <strong>{money(s.ventaTotal)}</strong>
        </div>
        <div className="summary-item">
          <span>Venta local</span>
          <strong>{money(s.ventaLocal)}</strong>
        </div>
        <div className="summary-item">
          <span>Venta apps</span>
          <strong>{money(s.ventaApps)}</strong>
        </div>
        <div className="summary-item highlight">
          <span>Total tarjetas</span>
          <strong>{money(s.tarjetas)}</strong>
        </div>
        <div className="summary-item highlight">
          <span>Total transferencias</span>
          <strong>{money(s.transferencias)}</strong>
        </div>
        <div className="summary-item">
          <span>Total propinas</span>
          <strong>{money(s.propina)}</strong>
        </div>
        <div className="summary-item">
          <span>Total gastos</span>
          <strong>{money(s.gastos)}</strong>
        </div>
        <div className="summary-item highlight" style={{ gridColumn: "1 / -1" }}>
          <span>Efectivo recibido (calculado)</span>
          <strong>{money(s.efectivoRecibido)}</strong>
        </div>
      </div>
      <p className="hint">
        Efectivo recibido = venta de meseros − tarjetas − gastos − transferencias de la semana. Las propinas se muestran aparte y no se
        suman aquí.
      </p>

      <div className="real-cash">
        <Field label="Efectivo real (lo que contaste)">
          <SumInput value={realText} onChange={setRealText} placeholder="0.00 o 300,300,300" />
        </Field>
        <button className="link-btn" onClick={commitReal}>
          Guardar efectivo real
        </button>
        {hasReal && (
          <div className={`diff-box ${diff === 0 ? "ok" : diff > 0 ? "over" : "under"}`}>
            <span>Diferencia</span>
            <strong>
              {diff > 0 ? "+" : ""}
              {money(diff)}
            </strong>
          </div>
        )}
      </div>

      <div className="week-table">
        <div className="week-table-inner">
          <div className="week-table-row week-table-head">
            <span>Día</span>
            <span>Venta total</span>
            <span>Venta local</span>
            <span>Venta apps</span>
            <span>Tarjetas</span>
            <span>Transf.</span>
            <span>Gastos</span>
            <span>Propinas</span>
            <span>Efectivo</span>
          </div>
          {s.perDay.map((r) => (
            <div className="week-table-row" key={r.day}>
              <span>
                {DAY_SHORT[r.day]} <em>{formatShortDayDate(dateForDay(monthKey, weekIndex, month, r.day))}</em>
              </span>
              <span>{money(r.ventaTotal)}</span>
              <span>{money(r.ventaLocal)}</span>
              <span>{money(r.ventaApps)}</span>
              <span>{money(r.tarjetas)}</span>
              <span>{money(r.transferencias)}</span>
              <span>{money(r.gastos)}</span>
              <span>{money(r.propina)}</span>
              <span>{money(r.efectivo)}</span>
            </div>
          ))}
          <div className="week-table-row week-table-total">
            <span>Total</span>
            <span>{money(s.ventaTotal)}</span>
            <span>{money(s.ventaLocal)}</span>
            <span>{money(s.ventaApps)}</span>
            <span>{money(s.tarjetas)}</span>
            <span>{money(s.transferencias)}</span>
            <span>{money(s.gastos)}</span>
            <span>{money(s.propina)}</span>
            <span>{money(s.efectivoRecibido)}</span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
