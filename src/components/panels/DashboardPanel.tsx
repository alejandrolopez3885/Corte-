import { useEffect, useState } from "react";
import { Field, SumInput } from "../ui";
import { computeDashboardReport, formatWeekRange, money, resolveWeekStartDate, sumFromText } from "../../lib/dataModel";
import type { MonthData } from "../../lib/types";

export function DashboardPanel({
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  onSaveNomina,
}: {
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  onSaveNomina: (monthKey: string, weekIndex: number, value: number) => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [nominaText, setNominaText] = useState("");

  const month = months[monthKey];
  const week = month?.weeks[weekIndex];

  useEffect(() => {
    setNominaText(week?.nominaManual ? String(week.nominaManual) : "");
  }, [monthKey, weekIndex, week?.nominaManual]);

  if (!month || !week) return null;

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const report = computeDashboardReport(week);

  function commitNomina() {
    onSaveNomina(monthKey, weekIndex, sumFromText(nominaText));
  }

  return (
    <div className="page-section">
      <h2 className="page-title">Dashboard</h2>
      <p className="hint">
        Reporte de resultados de la semana — solo para leer. Lo único capturable aquí es Nómina, porque todavía no hay un
        generador de nómina; todo lo demás viene de lo que ya registraste en Corte y Proveedores.
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

      <Field label="Nómina de la semana">
        <SumInput value={nominaText} onChange={setNominaText} placeholder="0.00" />
      </Field>
      <button className="link-btn" onClick={commitNomina}>
        Guardar nómina
      </button>

      <div className="report-list">
        <div className="report-row">
          <span className="report-row-label">Venta total</span>
          <span className="report-row-pct">100%</span>
          <strong className="report-row-amount">{money(report.ventaTotal)}</strong>
        </div>
        <div className="report-row">
          <span className="report-row-label">Gastos operativos</span>
          <span className="report-row-pct">{report.pct.gastosOperativos}%</span>
          <strong className="report-row-amount">{money(report.gastosOperativos)}</strong>
        </div>
        <div className="report-row">
          <span className="report-row-label">Gastos fijos</span>
          <span className="report-row-pct">{report.pct.gastosFijos}%</span>
          <strong className="report-row-amount">{money(report.gastosFijos)}</strong>
        </div>
        <div className="report-row">
          <span className="report-row-label">Comisión DIDI</span>
          <span className="report-row-pct">{report.pct.comisionDidi}%</span>
          <strong className="report-row-amount">{money(report.comisionDidi)}</strong>
        </div>
        <div className="report-row">
          <span className="report-row-label">Comisión UBER</span>
          <span className="report-row-pct">{report.pct.comisionUber}%</span>
          <strong className="report-row-amount">{money(report.comisionUber)}</strong>
        </div>
        <div className="report-row">
          <span className="report-row-label">Comisión RAPPI</span>
          <span className="report-row-pct">{report.pct.comisionRappi}%</span>
          <strong className="report-row-amount">{money(report.comisionRappi)}</strong>
        </div>
        {report.otrosCategorias.map((c) => (
          <div className="report-row" key={c.key}>
            <span className="report-row-label">{c.label}</span>
            <span className="report-row-pct">{c.pct}%</span>
            <strong className="report-row-amount">{money(c.total)}</strong>
          </div>
        ))}
        <div className="report-row">
          <span className="report-row-label">Nómina</span>
          <span className="report-row-pct">{report.pct.nomina}%</span>
          <strong className="report-row-amount">{money(report.nomina)}</strong>
        </div>
        <div className={`report-row total ${report.utilidad < 0 ? "negative" : ""}`}>
          <span className="report-row-label">Utilidad</span>
          <span className="report-row-pct">{report.pct.utilidad}%</span>
          <strong className="report-row-amount">{money(report.utilidad)}</strong>
        </div>
      </div>
    </div>
  );
}
