import { useEffect, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { Sheet, Field, SumInput } from "../ui";
import {
  computeComisionTarjetas, formatWeekRange, money, resolveGastosFijos, resolveMontoFijo, resolveWeekStartDate, round2, sumFromText,
} from "../../lib/dataModel";
import type { CreditoProveedores, MonthData, MontoFijoSemanal } from "../../lib/types";

export function CreditoProveedoresModal({
  onClose,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  montosFijos,
  onSave,
}: {
  onClose: () => void;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  montosFijos?: MontoFijoSemanal[];
  onSave: (monthKey: string, weekIndex: number, values: CreditoProveedores, nuevoMontoFijo?: number) => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);

  const [operativos, setOperativos] = useState("");
  // Gastos fijos: automáticos salvo que se editen con el lápiz (fijosManual).
  const [fijos, setFijos] = useState("");
  const [fijosManual, setFijosManual] = useState(false);
  const [editandoFijos, setEditandoFijos] = useState(false);
  const [fijosBorrador, setFijosBorrador] = useState("");
  // Nuevo monto fijo semanal (de esta semana en adelante), si se cambió.
  const [montoFijoNuevo, setMontoFijoNuevo] = useState<string | null>(null);
  const [comisionDidi, setComisionDidi] = useState("");
  const [comisionUber, setComisionUber] = useState("");
  const [comisionRappi, setComisionRappi] = useState("");

  useEffect(() => {
    const c = months[monthKey]?.weeks[weekIndex]?.creditoProveedores;
    setOperativos(c?.operativos ? String(c.operativos) : "");
    setFijos(c?.fijos ? String(c.fijos) : "");
    // Semanas guardadas antes de los gastos fijos automáticos se respetan.
    setFijosManual(c ? c.fijosManual ?? true : false);
    setEditandoFijos(false);
    setMontoFijoNuevo(null);
    setComisionDidi(c?.comisionDidi ? String(c.comisionDidi) : "");
    setComisionUber(c?.comisionUber ? String(c.comisionUber) : "");
    setComisionRappi(c?.comisionRappi ? String(c.comisionRappi) : "");
  }, [monthKey, weekIndex, months]);

  const month = months[monthKey];
  const week = month?.weeks[weekIndex];
  const weekStartDate = month ? resolveWeekStartDate(monthKey, weekIndex, month) : null;
  const comisionBancaria = week ? computeComisionTarjetas(week) : 0;

  const montoFijoGuardado = weekStartDate ? resolveMontoFijo(montosFijos, weekStartDate) : 0;
  const montoFijoEditado = montoFijoNuevo !== null && montoFijoNuevo.trim() !== "" ? sumFromText(montoFijoNuevo) : null;
  const montoFijo = montoFijoEditado ?? montoFijoGuardado;
  const calculoFijos = week ? resolveGastosFijos({ ...week, creditoProveedores: undefined }, montoFijo) : null;
  const fijosAutomatico = calculoFijos?.automatico ?? 0;
  const fijosTransferencia = fijosManual ? sumFromText(fijos) : fijosAutomatico;

  const total = round2(
    sumFromText(operativos) +
      fijosTransferencia +
      sumFromText(comisionDidi) +
      sumFromText(comisionUber) +
      sumFromText(comisionRappi) +
      comisionBancaria
  );

  function save() {
    onSave(monthKey, weekIndex, {
      operativos: sumFromText(operativos),
      fijos: fijosManual ? sumFromText(fijos) : 0,
      fijosManual,
      comisionDidi: sumFromText(comisionDidi),
      comisionUber: sumFromText(comisionUber),
      comisionRappi: sumFromText(comisionRappi),
    }, montoFijoEditado !== null && montoFijoEditado !== montoFijoGuardado ? montoFijoEditado : undefined);
    onClose();
  }

  return (
    <Sheet title="Control de gastos en transferencia" onClose={onClose}>
      <p className="hint">
        Control de los gastos que tus proveedores te dan a crédito y pagas después por transferencia. Es solo informativo — no
        afecta el efectivo a entregar ni ningún total de caja del corte.
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
      {weekStartDate && <p className="hint">{formatWeekRange(weekStartDate)}</p>}

      <Field label="Gastos operativos en transferencia">
        <SumInput value={operativos} onChange={setOperativos} placeholder="0.00" />
      </Field>
      {editandoFijos ? (
        <div className="fijos-edit">
          <Field label="Gastos fijos (solo esta semana)">
            <SumInput value={fijosBorrador} onChange={setFijosBorrador} placeholder="0.00" />
          </Field>
          <div className="gasto-row-edit-actions">
            <button type="button" className="link-btn" onClick={() => setEditandoFijos(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-chico primario"
              onClick={() => {
                setFijos(fijosBorrador);
                setFijosManual(true);
                setEditandoFijos(false);
              }}
            >
              Listo
            </button>
          </div>
        </div>
      ) : (
        <div className="field">
          <span>
            Gastos fijos {fijosManual ? <span className="tag-manual">editado a mano</span> : "(automático)"}
          </span>
          <div className="readonly-value fijos-valor">
            <span>{money(fijosTransferencia)}</span>
            <button
              type="button"
              className="icon-btn gasto-edit-btn"
              aria-label="Editar gastos fijos"
              onClick={() => {
                setFijosBorrador(String(fijosTransferencia));
                setEditandoFijos(true);
              }}
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>
      )}
      {!editandoFijos && fijosManual && (
        <button type="button" className="link-btn fijos-volver" onClick={() => setFijosManual(false)}>
          <RotateCcw size={13} /> Volver al automático ({money(fijosAutomatico)})
        </button>
      )}
      {!editandoFijos && !fijosManual && calculoFijos && (
        <div className="fijos-desglose">
          <div>
            <span>Monto fijo semanal</span>
            <span>{money(montoFijo)}</span>
          </div>
          {calculoFijos.servicios.map((g, i) => (
            <div key={i} className="fijos-menos">
              <span>− Servicio en efectivo ({g.concepto})</span>
              <span>−{money(g.total)}</span>
            </div>
          ))}
          <div className="fijos-total">
            <span>Gastos fijos en transferencia</span>
            <span>{money(fijosAutomatico)}</span>
          </div>
        </div>
      )}
      {montoFijoNuevo === null ? (
        <p className="hint fijos-monto">
          Monto fijo semanal: {money(montoFijo)} ·{" "}
          <button type="button" className="link-btn" onClick={() => setMontoFijoNuevo(String(montoFijoGuardado))}>
            Cambiar
          </button>
        </p>
      ) : (
        <Field label="Monto fijo semanal (de esta semana en adelante)">
          <SumInput value={montoFijoNuevo} onChange={setMontoFijoNuevo} placeholder="0.00" />
        </Field>
      )}
      <Field label="Comisión DIDI">
        <SumInput value={comisionDidi} onChange={setComisionDidi} placeholder="0.00" />
      </Field>
      <Field label="Comisión UBER">
        <SumInput value={comisionUber} onChange={setComisionUber} placeholder="0.00" />
      </Field>
      <Field label="Comisión RAPPI">
        <SumInput value={comisionRappi} onChange={setComisionRappi} placeholder="0.00" />
      </Field>
      <Field label="Comisión bancaria (3% de tarjetas, no editable)">
        <div className="readonly-value">{money(comisionBancaria)}</div>
      </Field>

      <div className="summary-item highlight" style={{ gridColumn: "1 / -1" }}>
        <span>Total de la semana</span>
        <strong>{money(total)}</strong>
      </div>

      <button className="btn-primary" onClick={save}>
        Guardar
      </button>
    </Sheet>
  );
}
