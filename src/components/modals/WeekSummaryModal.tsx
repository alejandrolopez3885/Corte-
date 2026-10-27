import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { TOLERANCIA, type JohnsterDatos } from "../../lib/cuadrar";
import { Sheet, Field, SumInput } from "../ui";
import { addDaysIso, computeWeekSummary, dateForDay, formatShortDayDate, formatWeekRange, money, resolveWeekStartDate, round2, sumFromText } from "../../lib/dataModel";
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
  const [guardado, setGuardado] = useState(false);
  // Lo que va escrito sin guardar todavía (null = nada nuevo).
  const [borrador, setBorrador] = useState<string | null>(null);

  // Se guarda lo que se ve escrito: el campo avisa en cada tecla, porque en
  // iPad tocar "Guardar" no siempre saca el foco del campo y se guardaba el
  // valor anterior. También se guarda solo al salir del campo.
  function commitReal(texto = realText) {
    const next = texto.trim() === "" ? "" : String(sumFromText(texto));
    setRealText(next);
    setBorrador(null);
    if ((s.efectivoReal ?? "") === (next === "" ? "" : Number(next))) return setGuardado(true);
    onSaveEfectivoReal(next);
    setGuardado(true);
  }

  // La diferencia es con lo que se ve escrito.
  const textoVisible = borrador ?? realText;
  const hasReal = textoVisible.trim() !== "";
  const realValue = sumFromText(textoVisible);
  const diff = round2(realValue - s.efectivoRecibido);

  // "Efectivo Disponible" de Johnster en esta semana, como lo calcula el bot:
  // efectivo de los cortes − gastos en efectivo (solo si está conectado).
  const [johnster, setJohnster] = useState<JohnsterDatos | null>(null);
  useEffect(() => {
    supabase
      .from("johnster_datos")
      .select("sucursal, ingresos, gastos, actualizado_en, error")
      .maybeSingle()
      .then(({ data }) => setJohnster((data as JohnsterDatos | null) ?? null));
  }, []);
  const hasta = addDaysIso(startDate, 6);
  const enSemana = (f: string) => f >= startDate && f <= hasta;
  const jIngresos = johnster?.ingresos.filter((i) => enSemana(i.fecha)) || [];
  const jVentas = round2(jIngresos.reduce((n, i) => n + i.efectivo, 0));
  const jGastos = round2((johnster?.gastos || []).filter((g) => enSemana(g.fecha)).reduce((n, g) => n + g.monto, 0));
  const jDisponible = round2(jVentas - jGastos);
  const tuVentas = round2(s.efectivoRecibido + s.gastos);
  const difJ = round2(jDisponible - s.efectivoRecibido);
  // Columna "Johnster" de la tabla: el efectivo de cada día según el bot.
  const conJ = !!johnster?.actualizado_en && jIngresos.length > 0;
  const efectivoJDia = (fecha: string) => {
    const ing = jIngresos.find((i) => i.fecha === fecha);
    if (!ing) return null;
    return round2(ing.efectivo - (johnster?.gastos || []).filter((g) => g.fecha === fecha).reduce((n, g) => n + g.monto, 0));
  };

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
      {johnster?.actualizado_en && jIngresos.length > 0 && (
        <div className={`jd-box ${Math.abs(difJ) <= TOLERANCIA ? "ok" : "mal"}`}>
          <div className="jd-head">
            <span>Efectivo disponible en Johnster</span>
            <strong>{money(jDisponible)}</strong>
          </div>
          <span className="jd-estado">
            {Math.abs(difJ) <= TOLERANCIA
              ? "✓ Igual que tu efectivo recibido"
              : `${difJ > 0 ? "Johnster tiene" : "Tu app tiene"} ${money(Math.abs(difJ))} más${jIngresos.length < 7 ? ` · el bot tiene ${jIngresos.length} de 7 días` : ""}`}
          </span>
          <div className="jd-tabla">
            <span />
            <span>Tu app</span>
            <span>Johnster</span>
            <span>Efectivo de ventas</span>
            <span>{money(tuVentas)}</span>
            <span className={Math.abs(jVentas - tuVentas) > TOLERANCIA ? "dif" : ""}>{money(jVentas)}</span>
            <span>− Gastos en efectivo</span>
            <span>{money(s.gastos)}</span>
            <span className={Math.abs(jGastos - s.gastos) > TOLERANCIA ? "dif" : ""}>{money(jGastos)}</span>
            <span>= Efectivo</span>
            <span>{money(s.efectivoRecibido)}</span>
            <span>{money(jDisponible)}</span>
          </div>
        </div>
      )}
      <p className="hint">
        Efectivo recibido = venta de meseros − tarjetas − gastos − transferencias de la semana. Las propinas se muestran aparte y no se
        suman aquí.
      </p>

      <div className="real-cash">
        <Field label="Efectivo real (lo que contaste)">
          <SumInput
            value={realText}
            onChange={(v) => commitReal(v)}
            alEscribir={(t) => {
              setBorrador(t);
              setGuardado(false);
            }}
            placeholder="0.00 o 300+300+300"
            sumar
          />
        </Field>
        <button className="link-btn" onClick={() => commitReal(borrador ?? realText)}>
          {guardado ? "✓ Guardado" : "Guardar efectivo real"}
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
        <div className={`week-table-inner ${conJ ? "con-johnster" : ""}`}>
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
            {conJ && <span>Johnster</span>}
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
              {conJ &&
                (() => {
                  const j = efectivoJDia(dateForDay(monthKey, weekIndex, month, r.day));
                  return j === null ? (
                    <span className="sin-j">—</span>
                  ) : (
                    <span className={Math.abs(j - r.efectivo) > TOLERANCIA ? "dif-j" : "ok-j"}>{money(j)}</span>
                  );
                })()}
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
            {conJ && <span className={Math.abs(difJ) > TOLERANCIA ? "dif-j" : "ok-j"}>{money(jDisponible)}</span>}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
