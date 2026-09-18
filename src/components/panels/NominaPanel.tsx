import { useState } from "react";
import { ArrowLeft, Trash2, Wallet } from "lucide-react";
import { Empty, Field, Sheet, SumInput } from "../ui";
import { computeNominaSemana, formatWeekRange, money, resolveWeekStartDate, sumFromText, uid } from "../../lib/dataModel";
import { DAY_SHORT, NOMINA_DESCUENTO_TIPOS } from "../../lib/types";
import type {
  EmpleadoEntry,
  HorarioMonthData,
  MonthData,
  NominaDescuento,
  NominaDescuentosMonthData,
  NominaDescuentoTipo,
} from "../../lib/types";

export function NominaPanel({
  onBack,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  empleados,
  horarios,
  nominaDescuentos,
  onSaveDescuentos,
  onGoToHorarios,
}: {
  onBack: () => void;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  empleados: EmpleadoEntry[];
  horarios: Record<string, HorarioMonthData>;
  nominaDescuentos: Record<string, NominaDescuentosMonthData>;
  onSaveDescuentos: (monthKey: string, weekIndex: number, descuentos: NominaDescuento[]) => void;
  onGoToHorarios: () => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [addingDescuentoFor, setAddingDescuentoFor] = useState<{ empleadoId: string; nombre: string } | null>(null);

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
  const descuentosSemana = nominaDescuentos[monthKey]?.weeks?.[weekIndex] ?? null;
  const reporte = computeNominaSemana(semana, empleados, descuentosSemana);

  const totalBruto = reporte.reduce((s, e) => s + e.bruto, 0);
  const totalDescuentos = reporte.reduce((s, e) => s + e.totalDescuentos, 0);
  const totalNeto = reporte.reduce((s, e) => s + e.neto, 0);

  function addDescuento(empleadoId: string, tipo: NominaDescuentoTipo, concepto: string, monto: number) {
    const current = descuentosSemana?.descuentos || [];
    onSaveDescuentos(monthKey, weekIndex, [...current, { id: uid(), empleadoId, tipo, concepto: concepto || undefined, monto }]);
    setAddingDescuentoFor(null);
  }

  function removeDescuento(id: string) {
    const current = descuentosSemana?.descuentos || [];
    onSaveDescuentos(monthKey, weekIndex, current.filter((d) => d.id !== id));
  }

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Equipo
      </button>
      <h2 className="page-title">Nómina</h2>
      <p className="hint">
        Calculada sola a partir de Horarios y el sueldo diario de cada quien en Personal: Z paga doble, O/X pagan normal, y el
        descanso (OFF) solo se paga si se trabajaron los otros 6 días. Los descuentos (tardanzas, adelantos, comida) se
        capturan aquí mismo, por persona.
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
                <strong className="nomina-emp-total">{money(e.neto)}</strong>
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

              {e.descuentos.length > 0 && (
                <div className="nomina-descuentos">
                  <div className="nomina-descuentos-row bruto">
                    <span>Bruto</span>
                    <span className="nomina-descuentos-monto">{money(e.bruto)}</span>
                  </div>
                  {e.descuentos.map((d) => (
                    <div className="nomina-descuentos-row" key={d.id}>
                      <span className="nomina-descuentos-item">
                        <strong>{NOMINA_DESCUENTO_TIPOS.find((t) => t.value === d.tipo)?.label}</strong>
                        {d.concepto ? ` · ${d.concepto}` : ""}
                      </span>
                      <span className="nomina-descuentos-monto">-{money(d.monto)}</span>
                      <button className="icon-btn" onClick={() => removeDescuento(d.id)} aria-label="Quitar descuento">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <div className="nomina-descuentos-row neto">
                    <span>Neto a pagar</span>
                    <span className="nomina-descuentos-monto">{money(e.neto)}</span>
                  </div>
                </div>
              )}

              <button
                className="link-btn"
                onClick={() => setAddingDescuentoFor({ empleadoId: e.empleadoId, nombre: e.nombre })}
              >
                + Agregar descuento
              </button>
            </div>
          ))}

          <div className="report-list">
            <div className="report-row">
              <span className="report-row-label">Bruto de la semana</span>
              <strong className="report-row-amount">{money(totalBruto)}</strong>
            </div>
            {totalDescuentos > 0 && (
              <div className="report-row">
                <span className="report-row-label">Descuentos</span>
                <strong className="report-row-amount">-{money(totalDescuentos)}</strong>
              </div>
            )}
            <div className="report-row total">
              <span className="report-row-label">Neto a pagar</span>
              <strong className="report-row-amount">{money(totalNeto)}</strong>
            </div>
          </div>
        </>
      )}

      {addingDescuentoFor && (
        <DescuentoModal
          nombre={addingDescuentoFor.nombre}
          onClose={() => setAddingDescuentoFor(null)}
          onSave={(tipo, concepto, monto) => addDescuento(addingDescuentoFor.empleadoId, tipo, concepto, monto)}
        />
      )}
    </div>
  );
}

function DescuentoModal({
  nombre,
  onClose,
  onSave,
}: {
  nombre: string;
  onClose: () => void;
  onSave: (tipo: NominaDescuentoTipo, concepto: string, monto: number) => void;
}) {
  const [tipo, setTipo] = useState<NominaDescuentoTipo>("tardanza");
  const [concepto, setConcepto] = useState("");
  const [montoText, setMontoText] = useState("");

  const monto = sumFromText(montoText);

  function save() {
    if (!monto) return;
    onSave(tipo, concepto.trim(), monto);
  }

  return (
    <Sheet title={`Descuento · ${nombre}`} onClose={onClose}>
      <Field label="Tipo">
        <select className="text-input" value={tipo} onChange={(e) => setTipo(e.target.value as NominaDescuentoTipo)}>
          {NOMINA_DESCUENTO_TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Concepto (opcional)">
        <input
          className="text-input"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Ej. llegó 20 min tarde"
        />
      </Field>
      <Field label="Monto">
        <SumInput value={montoText} onChange={setMontoText} placeholder="0.00" />
      </Field>
      <button className="btn-primary" onClick={save} disabled={!monto}>
        Guardar
      </button>
    </Sheet>
  );
}
