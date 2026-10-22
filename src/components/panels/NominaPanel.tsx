import { useState } from "react";
import { DatoPagoFila } from "../DatoPagoFila";
import type { DatosPago } from "../../lib/datosPago";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Copy, Trash2, Wallet } from "lucide-react";
import { Empty, Field, Sheet, SumInput } from "../ui";
import { computeNominaHastaHoyPorEmpleado, computeNominaSemana, computeWeekSummary, formatShortDayDate, formatWeekRange, isoWeekNumber, money, resolveWeekStartDate, sumFromText, todayIso, uid } from "../../lib/dataModel";
import { copyNominaImage } from "../../lib/nominaImage";
import { DAY_SHORT, NOMINA_DESCUENTO_TIPOS, NOMINA_EXTRA_TIPOS } from "../../lib/types";
import type {
  EmpleadoEntry,
  HorarioMonthData,
  MonthData,
  NominaDescuentosMonthData,
  NominaDescuentosSemana,
  NominaDescuentoTipo,
  NominaExtraTipo,
} from "../../lib/types";

export function NominaPanel({
  onBack,
  backLabel = "Equipo",
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  empleados,
  horarios,
  nominaDescuentos,
  onSaveDescuentos,
  onGoToHorarios,
  onTogglePagado,
  soloEmpleadoId,
  pagoDe,
  avisoPago,
}: {
  onBack?: () => void;
  backLabel?: string;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  empleados: EmpleadoEntry[];
  horarios: Record<string, HorarioMonthData>;
  nominaDescuentos: Record<string, NominaDescuentosMonthData>;
  onSaveDescuentos?: (monthKey: string, weekIndex: number, semana: NominaDescuentosSemana) => void;
  onGoToHorarios?: () => void;
  // Etiqueta Pendiente/Pagada de cada persona (solo dueño): un toque la
  // marca como pagada esa semana guardando lo que le tocaba hasta ese
  // momento (monto), y otro la regresa a pendiente.
  onTogglePagado?: (monthKey: string, weekIndex: number, empleadoId: string, nombre: string, monto: number) => void;
  // Cuando se pasa, es la vista de una cuenta de equipo viendo solo su
  // propia nómina: se filtra a esa sola persona y queda de solo lectura
  // (sin agregar/quitar descuentos ni percepciones extra de nadie).
  soloEmpleadoId?: string;
  // Solo dueño: a dónde pagarle a cada quien (Mi perfil > Datos para tu
  // pago). "sin-datos" = tiene cuenta pero no los ha puesto.
  pagoDe?: (empleadoId: string) => DatosPago | "sin-datos" | null;
  avisoPago?: string;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [addingDescuentoFor, setAddingDescuentoFor] = useState<{ empleadoId: string; nombre: string } | null>(null);
  const [addingExtraFor, setAddingExtraFor] = useState<{ empleadoId: string; nombre: string } | null>(null);
  // Tarjetas abiertas en la vista del dueño — todas arrancan cerradas
  // (solo nombre y lo que le toca hasta hoy) para que la lista no sea tan
  // larga. La vista del empleado (soloLectura) siempre va abierta.
  const [abiertas, setAbiertas] = useState<string[]>([]);
  // Resultado del último "Copiar imagen" — se borra solo a los pocos
  // segundos para que el botón vuelva a su texto normal.
  const [copiaEstado, setCopiaEstado] = useState<"copiada" | "descargada" | null>(null);

  const soloLectura = !!soloEmpleadoId;
  const month = months[monthKey];

  if (!month) {
    return (
      <div className="page-section">
        {onBack && (
          <button className="link-btn back-link" onClick={onBack}>
            <ArrowLeft size={15} /> {backLabel}
          </button>
        )}
        <h2 className="page-title">Nómina</h2>
        <Empty icon={<Wallet size={26} strokeWidth={1.3} />} text="Primero crea un mes en Corte para poder calcular la nómina." />
      </div>
    );
  }

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const week = month.weeks[weekIndex];
  const semana = horarios[monthKey]?.weeks?.[weekIndex] ?? null;
  const descuentosSemana = nominaDescuentos[monthKey]?.weeks?.[weekIndex] ?? null;
  const reporteCompleto = computeNominaSemana(semana, empleados, descuentosSemana, week);
  const reporte = soloEmpleadoId ? reporteCompleto.filter((e) => e.empleadoId === soloEmpleadoId) : reporteCompleto;

  const totalBruto = reporte.reduce((s, e) => s + e.bruto, 0);
  const totalExtras = reporte.reduce((s, e) => s + e.totalExtras, 0);
  const totalDescuentos = reporte.reduce((s, e) => s + e.totalDescuentos, 0);
  const totalNeto = reporte.reduce((s, e) => s + e.neto, 0);
  const pagados = reporte.filter((e) => e.confirmado);

  const today = todayIso();
  const hastaHoyPorEmpleado = computeNominaHastaHoyPorEmpleado(monthKey, weekIndex, month, semana, empleados);
  const totalHastaHoy = reporte.reduce((s, e) => s + (hastaHoyPorEmpleado[e.empleadoId] || 0), 0);
  // Lo que se le debe a cada quien al día de hoy: lo generado hasta hoy
  // (no la semana completa del horario) más sus percepciones extra, menos
  // sus descuentos. Es el número principal de la pantalla; el neto de la
  // semana completa (e.neto) queda como referencia discreta al cierre.
  const aRecibirHastaHoy = (e: (typeof reporte)[number]) =>
    Math.round(((hastaHoyPorEmpleado[e.empleadoId] || 0) + e.totalExtras - e.totalDescuentos) * 100) / 100;
  const totalARecibirHastaHoy = reporte.reduce((s, e) => s + aRecibirHastaHoy(e), 0);
  // Lo pagado a cada quien es lo que se guardó al marcarla; las marcas
  // viejas (sin monto) usan lo que le toca hasta hoy. El restante es lo
  // que se debe hasta hoy menos lo ya pagado.
  const montoPagado = (e: (typeof reporte)[number]) => e.montoPagado ?? aRecibirHastaHoy(e);
  const totalPagado = Math.round(pagados.reduce((s, e) => s + montoPagado(e), 0) * 100) / 100;
  const totalPorPagar = Math.round((totalARecibirHastaHoy - totalPagado) * 100) / 100;

  // Cómo se paga el neto de la semana: primero con el efectivo que debe
  // haber según el corte semanal (el calculado, no el contado — los
  // adelantos del corte ya vienen restados ahí como gasto) y lo que falte,
  // por transferencia. Si el efectivo alcanza para todo, la transferencia
  // queda en $0; si el efectivo calculado es negativo, no se usa nada.
  const efectivoSemana = week ? computeWeekSummary(week).efectivoRecibido : 0;
  const nominaEfectivo = Math.max(0, Math.min(efectivoSemana, totalNeto));
  const nominaTransferencia = Math.round((totalNeto - nominaEfectivo) * 100) / 100;

  // Una sola imagen con todo el personal (todas las áreas) — se copia al
  // portapapeles para pegarla en WhatsApp.
  async function copiarImagen() {
    const copiada = await copyNominaImage(
      reporte,
      `Nómina · ${month.label} · Semana ${isoWeekNumber(weekStartDate)}`,
      `${formatWeekRange(weekStartDate)} · Sueldo bruto, sin descuentos`
    );
    setCopiaEstado(copiada ? "copiada" : "descargada");
    setTimeout(() => setCopiaEstado(null), copiada ? 3000 : 6000);
  }

  function toggleAbierta(empleadoId: string) {
    setAbiertas((cur) => (cur.includes(empleadoId) ? cur.filter((id) => id !== empleadoId) : [...cur, empleadoId]));
  }

  function addDescuento(empleadoId: string, tipo: NominaDescuentoTipo, concepto: string, monto: number) {
    const descuentos = descuentosSemana?.descuentos || [];
    const extras = descuentosSemana?.extras || [];
    onSaveDescuentos?.(monthKey, weekIndex, {
      descuentos: [...descuentos, { id: uid(), empleadoId, tipo, concepto: concepto || undefined, monto }],
      extras,
    });
    setAddingDescuentoFor(null);
  }

  function removeDescuento(id: string) {
    const descuentos = descuentosSemana?.descuentos || [];
    onSaveDescuentos?.(monthKey, weekIndex, { descuentos: descuentos.filter((d) => d.id !== id), extras: descuentosSemana?.extras || [] });
  }

  function addExtra(empleadoId: string, tipo: NominaExtraTipo, concepto: string, monto: number) {
    const descuentos = descuentosSemana?.descuentos || [];
    const extras = descuentosSemana?.extras || [];
    onSaveDescuentos?.(monthKey, weekIndex, {
      descuentos,
      extras: [...extras, { id: uid(), empleadoId, tipo, concepto: concepto || undefined, monto }],
    });
    setAddingExtraFor(null);
  }

  function removeExtra(id: string) {
    const extras = descuentosSemana?.extras || [];
    onSaveDescuentos?.(monthKey, weekIndex, { descuentos: descuentosSemana?.descuentos || [], extras: extras.filter((x) => x.id !== id) });
  }

  return (
    <div className="page-section">
      {onBack && (
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
      )}
      <h2 className="page-title">Nómina</h2>
      {avisoPago && <p className="aviso-dejado">{avisoPago}</p>}
      <p className="hint">
        Calculada sola a partir de Horarios y el sueldo diario de cada quien en Personal: Z paga doble, O/X pagan normal, el
        descanso (OFF) solo se paga si se trabajaron los otros 6 días, y un día marcado festivo en Horarios paga 1 turno
        extra a quien lo trabajó.{" "}
        {soloLectura
          ? "Los descuentos y percepciones extra los agrega el dueño — aquí solo se ven."
          : "Los descuentos (tardanzas, adelantos, comida) y las percepciones extra (finiquitos, bonos — solo existen en la semana donde se capturan) se agregan aquí mismo, por persona."}
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
            text={
              soloLectura
                ? "Aún no se ha capturado el horario de esta semana — tu nómina se calcula de ahí."
                : "Aún no has capturado el horario de esta semana — la nómina se calcula de ahí."
            }
          />
          {onGoToHorarios && (
            <button className="link-btn" onClick={onGoToHorarios}>
              Ir a Horarios
            </button>
          )}
        </>
      ) : reporte.length === 0 ? (
        <Empty
          icon={<Wallet size={26} strokeWidth={1.3} />}
          text={
            soloLectura
              ? "Todavía no tienes horario capturado esta semana."
              : "El horario de esta semana no tiene personal capturado todavía."
          }
        />
      ) : (
        <>
          {!soloLectura && (
            <div className="field-row">
              <button className="link-btn" onClick={copiarImagen}>
                {copiaEstado === "copiada" ? (
                  <>
                    <Check size={15} /> ¡Copiada! Pégala en WhatsApp
                  </>
                ) : (
                  <>
                    <Copy size={15} /> Copiar imagen de la nómina
                  </>
                )}
              </button>
            </div>
          )}
          {!soloLectura && copiaEstado === "descargada" && (
            <p className="hint">Tu navegador no permite copiar imágenes — se descargó el PNG.</p>
          )}
          {!soloLectura && (
            <div className="report-list">
              <div className="report-row total">
                <span className="report-row-label">
                  Total a pagar hasta hoy
                  <em>{formatShortDayDate(today)} · todo el personal</em>
                </span>
                <strong className="report-row-amount nomina-total-hoy">{money(totalARecibirHastaHoy)}</strong>
              </div>
              <div className="report-row">
                <span className="report-row-label">Generada hasta hoy</span>
                <strong className="report-row-amount">{money(totalHastaHoy)}</strong>
              </div>
              {totalExtras > 0 && (
                <div className="report-row">
                  <span className="report-row-label">Percepciones extra</span>
                  <strong className="report-row-amount">+{money(totalExtras)}</strong>
                </div>
              )}
              <div className="report-row">
                <span className="report-row-label">Descuentos</span>
                <strong className="report-row-amount">-{money(totalDescuentos)}</strong>
              </div>
            </div>
          )}
          {reporte.map((e) => {
            const abierta = soloLectura || abiertas.includes(e.empleadoId);
            return (
              <div className="nomina-emp" key={e.empleadoId}>
                <div
                  className={`nomina-emp-head ${soloLectura ? "" : "plegable"}`}
                  onClick={soloLectura ? undefined : () => toggleAbierta(e.empleadoId)}
                >
                  <span className="nomina-emp-nombre">
                    {e.nombre}
                    {!soloLectura && (
                      <button
                        type="button"
                        className={`nomina-pago-tap ${e.confirmado ? "pagada" : ""}`}
                        onClick={(ev) => {
                          // No abre ni cierra la tarjeta — solo cambia el estado de pago.
                          ev.stopPropagation();
                          onTogglePagado?.(monthKey, weekIndex, e.empleadoId, e.nombre, aRecibirHastaHoy(e));
                        }}
                      >
                        {e.confirmado ? (
                          <>
                            <Check size={12} /> Pagada {money(montoPagado(e))}
                          </>
                        ) : (
                          "Pendiente"
                        )}
                      </button>
                    )}
                  </span>
                  {!soloLectura && (
                    <span className="nomina-emp-head-right">
                      <span className="nomina-emp-head-monto">
                        <small>A recibir hasta hoy</small>
                        <strong>{money(aRecibirHastaHoy(e))}</strong>
                      </span>
                      {abierta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  )}
                </div>
                {!soloLectura && pagoDe && (() => {
                  const pago = pagoDe(e.empleadoId);
                  if (!pago) return null;
                  return pago === "sin-datos" ? <p className="dato-pago-falta">Sin datos de pago todavía</p> : <DatoPagoFila datos={pago} />;
                })()}
                {abierta && (
                  <>
                    {e.sueldoDiario === 0 ? (
                      <p className="nomina-emp-sub">Sin sueldo diario capturado en Personal.</p>
                    ) : (
                      <p className="nomina-emp-sub">
                        {e.areaNombre} · {money(e.sueldoDiario)}/día · {e.diasTrabajados} días trabajados
                        {e.offPagado ? " · descanso pagado" : ""}
                      </p>
                    )}
                    <div className="nomina-recibir">
                      <div className="nomina-recibir-top">
                        <span>A recibir hasta hoy</span>
                        <strong>{money(aRecibirHastaHoy(e))}</strong>
                      </div>
                      <div className="nomina-recibir-calc">
                        <div className="nomina-recibir-row">
                          <span className="nomina-recibir-item">Generada hasta hoy ({formatShortDayDate(today)})</span>
                          <span>{money(hastaHoyPorEmpleado[e.empleadoId])}</span>
                          {!soloLectura && (e.extras.length > 0 || e.descuentos.length > 0) && <span className="icon-btn-spacer" />}
                        </div>
                        {e.extras.map((x) => (
                          <div className="nomina-recibir-row" key={x.id}>
                            <span className="nomina-recibir-item">
                              {NOMINA_EXTRA_TIPOS.find((t) => t.value === x.tipo)?.label}
                              {x.concepto ? ` · ${x.concepto}` : ""}
                            </span>
                            <span>+{money(x.monto)}</span>
                            {!soloLectura && (
                              <button className="icon-btn" onClick={() => removeExtra(x.id)} aria-label="Quitar percepción extra">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                        {e.descuentos.map((d) => (
                          <div className="nomina-recibir-row" key={d.id}>
                            <span className="nomina-recibir-item">
                              {NOMINA_DESCUENTO_TIPOS.find((t) => t.value === d.tipo)?.label}
                              {d.concepto ? ` · ${d.concepto}` : ""}
                              {d.origen === "corte" && <em> (Corte)</em>}
                            </span>
                            <span>-{money(d.monto)}</span>
                            {!soloLectura &&
                              (d.origen === "corte" ? (
                                <span className="icon-btn-spacer" />
                              ) : (
                                <button className="icon-btn" onClick={() => removeDescuento(d.id)} aria-label="Quitar descuento">
                                  <Trash2 size={13} />
                                </button>
                              ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="nomina-dias">
                      {e.dias.map((d) => (
                        <div className={`nomina-dia ${d.monto === 0 ? "cero" : ""} ${d.esFestivo ? "festivo" : ""}`} key={d.day}>
                          <div className="nomina-dia-label">{DAY_SHORT[d.day]}</div>
                          <div className="nomina-dia-valor">{d.valor || "–"}</div>
                          <div className="nomina-dia-monto">{money(d.monto)}</div>
                        </div>
                      ))}
                    </div>
      
                    {!soloLectura && (
                      <div className="field-row">
                        <button
                          className="link-btn"
                          onClick={() => setAddingExtraFor({ empleadoId: e.empleadoId, nombre: e.nombre })}
                        >
                          + Agregar percepción extra
                        </button>
                        <button
                          className="link-btn"
                          onClick={() => setAddingDescuentoFor({ empleadoId: e.empleadoId, nombre: e.nombre })}
                        >
                          + Agregar descuento
                        </button>
                      </div>
                    )}
      
                    <div className="nomina-cierre">
                      <span>Al cierre de la semana (según horario)</span>
                      <span>{money(e.neto)}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {!soloLectura && (
            <div className="report-list">
              <div className="report-row">
                <span className="report-row-label">Ya pagados</span>
                <strong className="report-row-amount">
                  {pagados.length} de {reporte.length}
                </strong>
              </div>
              <div className="report-row">
                <span className="report-row-label">
                  Total pagado
                  <em>lo que les pagaste al marcarlos</em>
                </span>
                <strong className="report-row-amount good">{money(totalPagado)}</strong>
              </div>
              <div className={`report-row total ${totalPorPagar > 0 ? "" : "positive"}`}>
                <span className="report-row-label">
                  Restante por pagar
                  <em>total a pagar hasta hoy − total pagado</em>
                </span>
                <strong className="report-row-amount">{money(totalPorPagar)}</strong>
              </div>
            </div>
          )}

          {!soloLectura && (
            <>
              <span className="menu-subtitle">Cómo se paga al cierre de la semana</span>
              <div className="report-list">
                <div className="report-row">
                  <span className="report-row-label">Nómina bruto</span>
                  <strong className="report-row-amount">{money(totalBruto)}</strong>
                </div>
                <div className="report-row">
                  <span className="report-row-label">
                    Descuentos
                    <em>adelantos, comidas, retardos</em>
                  </span>
                  <strong className="report-row-amount">-{money(totalDescuentos)}</strong>
                </div>
                <div className="report-row">
                  <span className="report-row-label">
                    Percepciones extra
                    <em>vacaciones, finiquito, bonos, etc.</em>
                  </span>
                  <strong className="report-row-amount">+{money(totalExtras)}</strong>
                </div>
                <div className="report-row total">
                  <span className="report-row-label">Neto a pagar</span>
                  <strong className="report-row-amount">{money(totalNeto)}</strong>
                </div>
                <div className="report-row">
                  <span className="report-row-label">
                    Nómina en efectivo
                    <em>efectivo que debe haber según el corte semanal (calculado, no el contado)</em>
                  </span>
                  <strong className="report-row-amount good">{money(nominaEfectivo)}</strong>
                </div>
                <div className="report-row">
                  <span className="report-row-label">
                    Nómina en transferencia
                    <em>neto a pagar − nómina en efectivo</em>
                  </span>
                  <strong className="report-row-amount">{money(nominaTransferencia)}</strong>
                </div>
              </div>
              <p className="hint">
                Si el efectivo de la semana alcanza para todo el neto, la nómina en efectivo es el neto completo y en
                transferencia queda en $0.00.
              </p>
            </>
          )}
        </>
      )}

      {addingDescuentoFor && (
        <DescuentoModal
          nombre={addingDescuentoFor.nombre}
          onClose={() => setAddingDescuentoFor(null)}
          onSave={(tipo, concepto, monto) => addDescuento(addingDescuentoFor.empleadoId, tipo, concepto, monto)}
        />
      )}

      {addingExtraFor && (
        <ExtraModal
          nombre={addingExtraFor.nombre}
          onClose={() => setAddingExtraFor(null)}
          onSave={(tipo, concepto, monto) => addExtra(addingExtraFor.empleadoId, tipo, concepto, monto)}
        />
      )}
    </div>
  );
}

function ExtraModal({
  nombre,
  onClose,
  onSave,
}: {
  nombre: string;
  onClose: () => void;
  onSave: (tipo: NominaExtraTipo, concepto: string, monto: number) => void;
}) {
  const [tipo, setTipo] = useState<NominaExtraTipo>("finiquito");
  const [concepto, setConcepto] = useState("");
  const [montoText, setMontoText] = useState("");

  const monto = sumFromText(montoText);

  function save() {
    if (!monto) return;
    onSave(tipo, concepto.trim(), monto);
  }

  return (
    <Sheet title={`Percepción extra · ${nombre}`} onClose={onClose}>
      <p className="hint">Se suma al bruto de esta semana nada más — no se repite en las siguientes.</p>
      <Field label="Tipo">
        <select className="text-input" value={tipo} onChange={(e) => setTipo(e.target.value as NominaExtraTipo)}>
          {NOMINA_EXTRA_TIPOS.map((t) => (
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
          placeholder="Ej. liquidación por baja"
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
