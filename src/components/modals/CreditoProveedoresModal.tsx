import { useEffect, useState } from "react";
import { useAlRecargar } from "../JalarParaActualizar";
import { supabase } from "../../lib/supabaseClient";
import { TOLERANCIA, type JohnsterDatos, type TipoTransferencia, avisarDatosJohnster } from "../../lib/cuadrar";
import { Pencil, RotateCcw } from "lucide-react";
import { Sheet, Field, SumInput } from "../ui";
import {
  addDaysIso, computeComisionTarjetas, nominaPagoSemana, dateForDay, formatShortDayDate, formatWeekRange, money, resolveGastosFijos, resolveMontoFijo, resolveWeekStartDate, round2, sumFromText,
} from "../../lib/dataModel";
import { DAY_SHORT } from "../../lib/types";
import type { CreditoProveedores, DayName, EmpleadoEntry, HorarioMonthData, MonthData, MontoFijoSemanal, NominaDescuentosMonthData } from "../../lib/types";

export function CreditoProveedoresModal({
  onClose,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  montosFijos,
  onSave,
  horarios,
  empleados = [],
  nominaDescuentos,
}: {
  onClose: () => void;
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  montosFijos?: MontoFijoSemanal[];
  onSave: (monthKey: string, weekIndex: number, values: CreditoProveedores, nuevoMontoFijo?: number) => void;
  // Para la nómina en transferencia (la calcula Equipo › Nómina).
  horarios?: Record<string, HorarioMonthData>;
  empleados?: EmpleadoEntry[];
  nominaDescuentos?: Record<string, NominaDescuentosMonthData>;
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
  // Johnster: los gastos en transferencia de la semana para comparar.
  const [johnster, setJohnster] = useState<JohnsterDatos | null | undefined>(undefined);
  const [actualizando, setActualizando] = useState(false);
  async function cargarJohnster() {
    const { data } = await supabase.from("johnster_datos").select("sucursal, ingresos, gastos, transferencias, actualizado_en, error").maybeSingle();
    setJohnster((data as JohnsterDatos | null) ?? null);
    avisarDatosJohnster(data as JohnsterDatos | null);
    return data as JohnsterDatos | null;
  }
  async function actualizarJohnster() {
    setActualizando(true);
    await supabase.functions.invoke("johnster", { body: {} });
    await cargarJohnster();
    setActualizando(false);
  }
  useAlRecargar(actualizarJohnster);
  useEffect(() => {
    // Datos guardados antes de traer transferencias: se actualizan una vez.
    cargarJohnster().then((d) => {
      if (d?.actualizado_en && (!d.transferencias?.length || !d.gastos.some((g) => g.tipo))) actualizarJohnster();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const diaCorto = (d: DayName) =>
    month ? `${DAY_SHORT[d]} ${formatShortDayDate(dateForDay(monthKey, weekIndex, month, d)).split(" ")[0]}` : DAY_SHORT[d];

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

  // Contra Johnster, en el mismo rango (lunes a domingo). Tu app manda:
  // ok = está en el bot con el mismo monto ($5 de tolerancia), falta = no
  // está, otro = está con otro monto.
  const conectado = !!johnster?.actualizado_en;
  const hasta = weekStartDate ? addDaysIso(weekStartDate, 6) : "";
  const deLaSemana = conectado && weekStartDate ? (johnster!.transferencias || []).filter((t) => t.fecha >= weekStartDate && t.fecha <= hasta) : [];
  const enBot = (tipo: TipoTransferencia) => {
    const xs = deLaSemana.filter((t) => t.tipo === tipo);
    return xs.length ? { monto: round2(xs.reduce((n, t) => n + t.monto, 0)), cuantos: xs.length, fecha: xs[xs.length - 1].fecha } : null;
  };
  // Si no está en la semana pero hay uno igual hasta 3 días antes o
  // después (ej. la bancaria con fecha del lunes siguiente), se avisa para
  // cambiarle la fecha en el bot.
  const distancia = (f: string) => Math.abs(new Date(`${f}T12:00:00`).getTime() - new Date(`${f > hasta ? hasta : weekStartDate}T12:00:00`).getTime());
  const fueraDeSemana = (tipo: TipoTransferencia) =>
    conectado && weekStartDate
      ? (johnster!.transferencias || [])
          .filter((t) => t.tipo === tipo && t.fecha >= addDaysIso(weekStartDate, -3) && t.fecha <= addDaysIso(hasta, 3) && (t.fecha < weekStartDate || t.fecha > hasta))
          .sort((a, b) => distancia(a.fecha) - distancia(b.fecha))[0] || null
      : null;
  const comparar = (tuyo: number, tipo: TipoTransferencia) => {
    const b = enBot(tipo);
    return {
      bot: b,
      estado: !b ? ("falta" as const) : Math.abs(b.monto - tuyo) <= TOLERANCIA ? ("ok" as const) : ("otro" as const),
      fuera: b ? null : fueraDeSemana(tipo),
    };
  };
  const cOperativos = comparar(sumFromText(operativos), "operacion");
  const cFijos = comparar(fijosTransferencia, "fijos");
  const cBancaria = comparar(comisionBancaria, "bancaria");
  const apps = [
    { clave: "didi" as const, nombre: "DIDI", valor: comisionDidi, set: setComisionDidi },
    { clave: "uber" as const, nombre: "UBER", valor: comisionUber, set: setComisionUber },
    { clave: "rappi" as const, nombre: "RAPPI", valor: comisionRappi, set: setComisionRappi },
  ].map((a) => ({ ...a, c: comparar(sumFromText(a.valor), a.clave) }));
  // Nómina en transferencia: no se edita (la calcula Nómina), sí suma al
  // total y se confirma que el bot la tenga.
  const nomina = nominaPagoSemana(week, horarios?.[monthKey]?.weeks?.[weekIndex] ?? null, empleados, nominaDescuentos?.[monthKey]?.weeks?.[weekIndex] ?? null);
  const cNominaBase = comparar(nomina.transferencia, "nomina");
  const cNomina = nomina.transferencia === 0 && !cNominaBase.bot ? { ...cNominaBase, estado: "ok" as const } : cNominaBase;
  const todos = [cOperativos, cFijos, cBancaria, ...apps.map((a) => a.c), cNomina];
  // El total (con la nómina en transferencia) contra todas las
  // transferencias de la semana en el bot.
  const totalSemana = round2(total + nomina.transferencia);
  const totalBot = round2(deLaSemana.reduce((n, t) => n + t.monto, 0));
  const otrosBot = deLaSemana.filter((t) => t.tipo === "otro");
  const cTotal = { estado: Math.abs(totalBot - totalSemana) <= TOLERANCIA ? ("ok" as const) : ("otro" as const) };
  const nOk = todos.filter((c) => c.estado === "ok").length;
  const nOtro = todos.filter((c) => c.estado === "otro").length;
  const nFalta = todos.filter((c) => c.estado === "falta").length;
  const diaBot = (f: string) => `${DAY_SHORT[(["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as DayName[])[new Date(`${f}T12:00:00`).getDay()]]} ${Number(f.slice(8))}`;
  const avisoFuera = (t: { fecha: string; monto: number }) =>
    `No está en esta semana (${diaBot(weekStartDate!)} – ${diaBot(hasta)}), pero en el bot hay uno el ${diaBot(t.fecha)} por ${money(t.monto)}: cámbiale la fecha en el bot.`;
  // Fijos y bancaria: lo de tu app es lo que debe estar en el bot.
  const confirmar = (c: ReturnType<typeof comparar>, tuyo: number) =>
    !conectado ? null : c.estado === "ok" ? (
      <p className="tr-bot">Johnster: {money(c.bot!.monto)} ({diaBot(c.bot!.fecha)})</p>
    ) : c.estado === "falta" ? (
      <p className="tr-bot tr-falta">{c.fuera ? avisoFuera(c.fuera) : `No está en el bot: súbelo como gasto en transferencia por ${money(tuyo)}.`}</p>
    ) : (
      <p className="tr-bot tr-mal">
        Johnster tiene {money(c.bot!.monto)}: corrígelo en el bot a {money(tuyo)}.
      </p>
    );
  const chip = (c: ReturnType<typeof comparar>, etiquetas?: { falta?: string }) =>
    !conectado ? null : (
      <span className={`tr-chip ${c.estado}`}>
        {c.estado === "ok" ? "✓ En el bot" : c.estado === "falta" ? (c.fuera ? `Está el ${diaBot(c.fuera.fecha)}` : etiquetas?.falta || "No está en el bot") : "Otro monto en el bot"}
      </span>
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

      {johnster !== undefined &&
        (conectado ? (
          <>
            <div className="tr-sync">
              <span>{johnster!.sucursal || "Johnster"}</span>
              <button type="button" className="link-btn" disabled={actualizando} onClick={actualizarJohnster}>
                {actualizando ? "Trayendo datos de Johnster…" : "Revisar de nuevo en Johnster ↻"}
              </button>
            </div>
            <div className="tr-resumen">
              {nOk > 0 && <span className="tr-chip ok">✓ {nOk} en el bot</span>}
              {nOtro > 0 && <span className="tr-chip otro">{nOtro} con otro monto</span>}
              {nFalta > 0 && <span className="tr-chip falta">{nFalta} no están en el bot</span>}
            </div>
          </>
        ) : (
          <p className="hint">Conecta Johnster en Corte › ⚖︎ Cuadrar para comparar con el bot.</p>
        ))}

      <div className={`tr-card ${conectado ? cOperativos.estado : ""}`}>
        <div className="tr-head">
          <span>Gastos de operación (proveedores)</span>
          {conectado && (
            <span className={`tr-chip ${cOperativos.estado}`}>
              {cOperativos.estado === "ok"
                ? "✓ Cuadra"
                : cOperativos.estado === "falta"
                  ? "No hay en el bot"
                  : `${cOperativos.bot!.monto > sumFromText(operativos) ? "−" : "+"}${money(Math.abs(cOperativos.bot!.monto - sumFromText(operativos)))} vs bot`}
            </span>
          )}
        </div>
        <Field label="Tu total de las notas">
          <SumInput value={operativos} onChange={setOperativos} placeholder="0.00" sumar />
        </Field>
        {conectado && cOperativos.bot && (
          <p className="tr-bot">
            Johnster: <b>{money(cOperativos.bot.monto)}</b> · {cOperativos.bot.cuantos} {cOperativos.bot.cuantos === 1 ? "gasto" : "gastos"} de operación
          </p>
        )}
        {conectado && cOperativos.estado === "otro" && (
          <p className="tr-bot tr-mal">
            {cOperativos.bot!.monto > sumFromText(operativos)
              ? `Johnster tiene ${money(cOperativos.bot!.monto - sumFromText(operativos))} más que tus notas: revisa si falta una nota o si hay un gasto repetido en el bot.`
              : `Tus notas tienen ${money(sumFromText(operativos) - cOperativos.bot!.monto)} más que Johnster: falta subir algún gasto al bot.`}
          </p>
        )}
      </div>

      <div className={`tr-card ${conectado ? cFijos.estado : ""}`}>
        <div className="tr-head">
          <span>Gastos fijos</span>
          {chip(cFijos)}
        </div>
        {editandoFijos ? (
          <div className="fijos-edit">
            <Field label="Gastos fijos (solo esta semana)">
              <SumInput value={fijosBorrador} onChange={setFijosBorrador} placeholder="0.00" sumar />
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
                <span>
                  − {g.concepto} · {diaCorto(g.dia)}
                </span>
                <span>−{money(g.total)}</span>
              </div>
            ))}
            <div className="fijos-total">
              <span>Gastos fijos en transferencia</span>
              <span>{money(fijosAutomatico)}</span>
            </div>
          </div>
        )}
        {!editandoFijos && fijosManual && calculoFijos && calculoFijos.servicios.length > 0 && (
          <div className="fijos-desglose">
            <div className="fijos-referencia">
              <span>Servicio pagado en efectivo esta semana</span>
            </div>
            {calculoFijos.servicios.map((g, i) => (
              <div key={i} className="fijos-menos">
                <span>
                  {g.concepto} · {diaCorto(g.dia)}
                </span>
                <span>{money(g.total)}</span>
              </div>
            ))}
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
        {confirmar(cFijos, fijosTransferencia)}
      </div>

      <div className={`tr-card ${conectado ? (apps.some((a) => a.c.estado === "otro") ? "otro" : apps.every((a) => a.c.estado === "ok") ? "ok" : "falta") : ""}`}>
        <div className="tr-head">
          <span>Comisiones de apps</span>
        </div>
        {apps.map((a) => (
          <div key={a.clave} className="tr-app">
            <Field label={`Comisión ${a.nombre}`}>
              <SumInput value={a.valor} onChange={a.set} placeholder="0.00" sumar />
            </Field>
            {conectado && (
              <span className={`tr-chip ${a.c.estado}`}>
                {a.c.estado === "ok" ? "✓ En el bot" : a.c.estado === "falta" ? (a.c.fuera ? `Está el ${diaBot(a.c.fuera.fecha)}` : "No está en el bot") : `Bot: ${money(a.c.bot!.monto)}`}
              </span>
            )}
          </div>
        ))}
        {conectado && apps.some((a) => a.c.fuera) && (
          <p className="tr-bot tr-falta">
            {apps
              .filter((a) => a.c.fuera)
              .map((a) => `${a.nombre}: ${avisoFuera(a.c.fuera!)}`)
              .join(" ")}
          </p>
        )}
      </div>

      <div className={`tr-card ${conectado ? cBancaria.estado : ""}`}>
        <div className="tr-head">
          <span>Comisión bancaria (3% de tarjetas)</span>
          {chip(cBancaria)}
        </div>
        <div className="readonly-value">{money(comisionBancaria)}</div>
        {confirmar(cBancaria, comisionBancaria)}
      </div>

      <div className={`tr-card ${conectado ? cNomina.estado : ""}`}>
        <div className="tr-head">
          <span>Nómina en transferencia</span>
          {nomina.transferencia === 0 && !cNomina.bot ? null : chip(cNomina)}
        </div>
        <div className="readonly-value">{money(nomina.transferencia)}</div>
        <p className="tr-bot">
          Se calcula en Equipo › Nómina: neto a pagar {money(nomina.neto)} − efectivo de la semana {money(nomina.efectivo)}.
        </p>
        {nomina.transferencia === 0 && !cNomina.bot ? (
          <p className="tr-bot">El efectivo de la semana alcanza para la nómina: no hay transferencia.</p>
        ) : (
          confirmar(cNomina, nomina.transferencia)
        )}
      </div>

      <div className="summary-item highlight" style={{ gridColumn: "1 / -1" }}>
        <span>Total de la semana</span>
        <strong>{money(totalSemana)}</strong>
      </div>
      {conectado && (
        <div className={`tr-total-j ${cTotal.estado}`}>
          <span>
            Johnster: {money(totalBot)} en transferencias de la semana
            {otrosBot.length > 0 && (
              <small>
                Incluye {money(round2(otrosBot.reduce((n, t) => n + t.monto, 0)))} de otros gastos que no están en esta pantalla:{" "}
                {otrosBot.map((t) => `${t.concepto.trim()} ${money(t.monto)}`).join(", ")}.
              </small>
            )}
          </span>
          <span className={`tr-chip ${cTotal.estado}`}>
            {cTotal.estado === "ok" ? "✓ Cuadra" : `${totalBot > totalSemana ? "Johnster +" : "Tu app +"}${money(Math.abs(totalBot - totalSemana))}`}
          </span>
        </div>
      )}

      <button className="btn-primary" onClick={save}>
        Guardar
      </button>
    </Sheet>
  );
}
