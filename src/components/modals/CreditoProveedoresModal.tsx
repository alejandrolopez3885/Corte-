import { useEffect, useState } from "react";
import { Sheet, Field, SumInput } from "../ui";
import { formatWeekRange, money, resolveWeekStartDate, round2, sumFromText } from "../../lib/dataModel";
import type { CreditoProveedores, MonthData } from "../../lib/types";

export function CreditoProveedoresModal({
  onClose,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  onSave,
}: {
  onClose: () => void;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  onSave: (monthKey: string, weekIndex: number, values: CreditoProveedores) => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);

  const [operativos, setOperativos] = useState("");
  const [fijos, setFijos] = useState("");
  const [comisionDidi, setComisionDidi] = useState("");
  const [comisionUber, setComisionUber] = useState("");
  const [comisionRappi, setComisionRappi] = useState("");

  useEffect(() => {
    const c = months[monthKey]?.weeks[weekIndex]?.creditoProveedores;
    setOperativos(c?.operativos ? String(c.operativos) : "");
    setFijos(c?.fijos ? String(c.fijos) : "");
    setComisionDidi(c?.comisionDidi ? String(c.comisionDidi) : "");
    setComisionUber(c?.comisionUber ? String(c.comisionUber) : "");
    setComisionRappi(c?.comisionRappi ? String(c.comisionRappi) : "");
  }, [monthKey, weekIndex, months]);

  const month = months[monthKey];
  const weekStartDate = month ? resolveWeekStartDate(monthKey, weekIndex, month) : null;

  const total = round2(
    sumFromText(operativos) + sumFromText(fijos) + sumFromText(comisionDidi) + sumFromText(comisionUber) + sumFromText(comisionRappi)
  );

  function save() {
    onSave(monthKey, weekIndex, {
      operativos: sumFromText(operativos),
      fijos: sumFromText(fijos),
      comisionDidi: sumFromText(comisionDidi),
      comisionUber: sumFromText(comisionUber),
      comisionRappi: sumFromText(comisionRappi),
    });
    onClose();
  }

  return (
    <Sheet title="Gastos de proveedores a crédito" onClose={onClose}>
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
      <Field label="Gastos fijos">
        <SumInput value={fijos} onChange={setFijos} placeholder="0.00" />
      </Field>
      <Field label="Comisión DIDI">
        <SumInput value={comisionDidi} onChange={setComisionDidi} placeholder="0.00" />
      </Field>
      <Field label="Comisión UBER">
        <SumInput value={comisionUber} onChange={setComisionUber} placeholder="0.00" />
      </Field>
      <Field label="Comisión RAPPI">
        <SumInput value={comisionRappi} onChange={setComisionRappi} placeholder="0.00" />
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
