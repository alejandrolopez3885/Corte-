import { useState, type ReactNode } from "react";
import { ArrowLeftRight, Check, Lock, Plus, Receipt, Users, Wallet } from "lucide-react";
import { Empty } from "./ui";
import { acumuladosDelDia, efectivoDelDia, money, round2 } from "../lib/dataModel";
import { faltantesDelCorte } from "./modals/GuardarCorteModal";
import { etiquetaCategoria } from "./modals/asistente";
import type { AppData, DayData, Gasto, MeseroCut, Transferencia } from "../lib/types";

// Corte del día (debajo de "Historial de este día"): arriba la tarjeta
// "Siguiente paso" con la barra de avance y los pasos del día; luego las
// pestañas Turno 1 · Apertura / Turno 2 · Cierre / Todo el día (los días
// sin turnos, antes del 21/10/2026, no llevan pestañas), los totales del
// turno, los cortes de meseros en tabla (lista en celular), gastos,
// transferencias y efectivo; abajo una barra fija con el efectivo a
// entregar, "Dejar efectivo" y "Guardar corte".

type Pestana = "t1" | "t2" | "dia";

export interface CorteDelDiaProps {
  data: AppData;
  day: DayData;
  isOwner: boolean;
  corteBloqueado: boolean;
  turnos: boolean;
  abrenHoy: { nombre: string; marca: string }[];
  efectivoDia: ReturnType<typeof efectivoDelDia> | null;
  // Fondo del día anterior manejado en el turno 1 (desde el 25/10/2026).
  fondo: boolean;
  onGastoFondo: () => void;
  onFondoRecibido: () => void;
  totals: { ventaTotal: number; ventaLocal: number; ventaApps: number; tarjetas: number; transferencias: number; propina: number; gastos: number; efectivo: number };
  bloqueado: (id: string) => boolean;
  fechaHora: (iso: string) => string;
  onNuevoCorte: () => void;
  onEditarCorte: (m: MeseroCut) => void;
  onNuevoGasto: () => void;
  onEditarGasto: (g: Gasto) => void;
  onToggleGasto: (id: string) => void;
  // Desde la semana del 26/10/2026 el estado de los gastos lo decide Johnster:
  // el chip solo se muestra (sin Confirmar).
  estadoAuto?: boolean;
  onNuevaTransfer: () => void;
  onEditarTransfer: (t: Transferencia) => void;
  onApps: () => void;
  onApertura: () => void;
  onQuitarApertura: () => void;
  onDejarEfectivo: () => void;
  onGuardarCorte: () => void;
  onReabrir: () => void;
}

const suma = <T,>(l: T[], f: (x: T) => number) => round2(l.reduce((s, x) => s + f(x), 0));

export function CorteDelDia(p: CorteDelDiaProps) {
  const { day, turnos, efectivoDia, totals, corteBloqueado } = p;
  const ap = turnos ? day.apertura : undefined;
  const enApertura = (id: string) => !!ap?.ids.includes(id);
  const [pestana, setPestana] = useState<Pestana>(!turnos ? "dia" : ap ? "t2" : "t1");
  const vista: Pestana = turnos ? pestana : "dia";

  // Qué entra en cada turno: lo de la apertura (por id) y lo demás. Sin
  // apertura guardada, todo es del turno 1.
  const delTurno = <T extends { id: string }>(l: T[]): T[] =>
    vista === "dia" ? l : vista === "t1" ? (ap ? l.filter((x) => enApertura(x.id)) : l) : ap ? l.filter((x) => !enApertura(x.id)) : [];
  const cortes = delTurno(day.meseros);
  // Los gastos del fondo van en su propia tarjeta (turno 1), no con los de venta.
  const gastosFondo = p.fondo ? day.gastos.filter((g) => g.delFondo) : [];
  const gastos = delTurno(day.gastos).filter((g) => vista === "dia" || !(p.fondo && g.delFondo));
  const transferencias = delTurno(day.transferencias);
  const t1Cerrado = vista === "t1" && !!ap && !ap.desbloqueada;
  const puedeAgregar = !corteBloqueado && !t1Cerrado && !(vista === "t2" && !ap);

  // Número de corte de cada usuario acumulado ("Johnster · Corte 2").
  const numCorte: Record<string, number> = {};
  const cuenta: Record<string, number> = {};
  day.meseros.forEach((m) => {
    if (m.lecturaSistema === undefined) return;
    cuenta[m.meseroId] = (cuenta[m.meseroId] || 0) + 1;
    numCorte[m.id] = cuenta[m.meseroId];
  });

  // Los pendientes pueden ser de cualquier turno: se ven en "Todo el día".
  function verGastos() {
    if (turnos) setPestana("dia");
    setTimeout(() => document.querySelector(".cd-gastos")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }
  // fechaHora ya puede terminar en punto ("a.m.").
  const conPunto = (t: string) => (t.endsWith(".") ? t : `${t}.`);

  // --- Siguiente paso ---
  const cortesCierre = day.meseros.filter((m) => !enApertura(m.id));
  const faltan = faltantesDelCorte(day, !!p.estadoAuto).filter((f) => f.titulo !== "Meseros");
  const gastosPendientes = day.gastos.filter((g) => g.estado === "pendiente");
  const acumulados = turnos ? acumuladosDelDia(day) : [];
  const revisar = [
    ...(day.ventaApps ? [`las apps del día (${money(day.ventaApps)})`] : []),
    ...acumulados.map((a) => `${a.nombre} del día (${money(a.lectura)})`),
  ];
  const pasos: { clave: string; corto: string; hecho: boolean; titulo: string; texto: string; boton?: { texto: string; accion: () => void } }[] = [
    ...(p.fondo && efectivoDia
      ? [
          {
            clave: "fondo",
            corto: "Recibir el fondo",
            hecho: !!day.fondoRecibido || !!day.apertura,
            titulo: `Recibe el fondo: ${money(efectivoDia.dejadoAyer)}`,
            texto: `Se dejaron ayer${efectivoDia.ayer?.nota ? ` (${efectivoDia.ayer.nota})` : ""}. Cuéntalo; lo que pagues con él regístralo como gasto "Con el fondo". Lo que quede se entrega con la apertura.`,
            boton: { texto: "Ya lo recibí", accion: p.onFondoRecibido },
          },
        ]
      : []),
    ...(turnos
      ? [
          {
            clave: "apertura",
            corto: "Corte de apertura",
            hecho: !!day.apertura,
            titulo: "Haz el corte de apertura",
            texto: p.abrenHoy.length
              ? `Hoy abre ${p.abrenHoy.map((x) => `${x.nombre} (${x.marca})`).join(", ")}. Captura sus cortes y guarda la apertura.`
              : "Nadie tiene X ni Z hoy en el horario. Captura los cortes de quien abrió y guarda la apertura.",
            boton: { texto: "Corte de apertura", accion: p.onApertura },
          },
        ]
      : []),
    {
      clave: "cortes",
      corto: turnos ? "Cortes del cierre" : "Cortes de meseros",
      hecho: (turnos ? cortesCierre : day.meseros).length > 0,
      titulo: turnos ? "Haz los cortes del cierre" : "Haz los cortes de meseros",
      texto: turnos ? "Un corte por cada mesero del turno, y el de para llevar con lo que marca el sistema en todo el día." : "Un corte por cada mesero del día.",
      boton: { texto: "Hacer corte a mesero", accion: p.onNuevoCorte },
    },
    {
      clave: "pendientes",
      corto: p.estadoAuto ? (faltan.length ? "Completar gastos" : "Gastos completos") : faltan.length ? "Confirmar gastos" : "Gastos confirmados",
      hecho: faltan.length === 0,
      titulo:
        !p.estadoAuto && faltan.length && faltan.length === gastosPendientes.length
          ? `Confirma ${faltan.length === 1 ? "el gasto pendiente" : `los ${faltan.length} gastos pendientes`}`
          : `Completa ${faltan.length === 1 ? "1 pendiente" : `${faltan.length} pendientes`}`,
      texto:
        !p.estadoAuto && faltan.length && faltan.length === gastosPendientes.length
          ? `${gastosPendientes.map((g) => `${g.concepto} (${money(g.total)})`).join(", ")}: sube su comprobante al bot y toca Confirmar.`
          : faltan
              .slice(0, 3)
              .map((f) => `${f.titulo}: ${f.detalle}`)
              .join(" · "),
      boton: { texto: "Ver gastos", accion: verGastos },
    },
    {
      clave: "guardar",
      corto: "Guardar corte",
      hecho: !!day.corteGuardado,
      titulo: "Revisa y guarda el corte",
      texto: revisar.length ? `Revisa que ${revisar.join(" y ")} coincidan con el sistema y guarda el corte.` : "Revisa los totales y guarda el corte.",
      boton: { texto: "Guardar corte", accion: p.onGuardarCorte },
    },
  ];
  const actual = day.corteGuardado ? -1 : pasos.findIndex((x) => !x.hecho);
  const hechos = pasos.filter((x) => x.hecho).length;
  const porcentaje = Math.round((hechos / pasos.length) * 100);
  const paso = actual >= 0 ? pasos[actual] : null;

  // --- Totales del turno ---
  const kpis: { texto: string; valor: number; principal?: boolean; editar?: () => void }[] =
    vista === "dia"
      ? [
          { texto: "Venta total", valor: totals.ventaTotal, principal: true },
          { texto: "Venta local", valor: totals.ventaLocal },
          { texto: "Tarjetas", valor: totals.tarjetas },
          { texto: "Transferencias", valor: totals.transferencias },
          { texto: "Gastos", valor: totals.gastos },
          { texto: "Propinas", valor: totals.propina },
          { texto: "Apps del día", valor: day.ventaApps || 0, editar: corteBloqueado ? undefined : p.onApps },
        ]
      : [
          { texto: "Venta del turno", valor: suma(cortes, (m) => m.venta), principal: true },
          { texto: "Tarjetas", valor: suma(cortes, (m) => m.tarjetas) },
          { texto: "Transferencias", valor: suma(transferencias, (t) => t.total) },
          { texto: "Gastos", valor: suma(gastos, (g) => g.total) },
          { texto: "Propinas", valor: suma(cortes, (m) => m.propina) },
          vista === "t1" && ap
            ? { texto: "Apps (apertura)", valor: ap.ventaApps }
            : { texto: "Apps del día", valor: day.ventaApps || 0, editar: corteBloqueado ? undefined : p.onApps },
        ];

  // --- Efectivo ---
  const entregar = efectivoDia ? efectivoDia.entregar : totals.efectivo;
  const textoEntregar = efectivoDia?.tieneApertura ? "Efectivo a entregar en la noche" : "Efectivo a entregar";

  const tag = (texto: string, clase = "") => <span className={`cd-tag ${clase}`}>{texto}</span>;
  const nombreCorte = (m: MeseroCut) => (
    <>
      <span className="cd-nombre">
        <b>{m.nombre}</b>
        {numCorte[m.id] && tag(`Corte ${numCorte[m.id]}`, "ac")}
      </span>
      {(m.cobro || m.lecturaSistema !== undefined) && (
        <small>{[m.cobro && `Cobró ${m.cobro}`, m.lecturaSistema !== undefined && `sistema ${money(m.lecturaSistema)}`].filter(Boolean).join(" · ")}</small>
      )}
    </>
  );
  const detalleGasto = (g: Gasto) =>
    [
      etiquetaCategoria(g.categoria),
      g.meseroCutId ? `del corte de ${g.meseroNombre}` : g.delFondo ? "del fondo" : "general",
      g.empleadoId && `descuento a ${p.data.empleados.find((e) => e.id === g.empleadoId)?.nombre || "empleado eliminado"}`,
      g.meseroId && `cancelación a ${p.data.meseros.find((m) => m.id === g.meseroId)?.nombre || "mesero eliminado"}`,
    ]
      .filter(Boolean)
      .join(" · ");

  const filasCortes = (lista: MeseroCut[]) =>
    lista.map((m) => {
      const off = corteBloqueado || p.bloqueado(m.id);
      return (
        <tr key={m.id} className={off ? "off" : ""} onClick={off ? undefined : () => p.onEditarCorte(m)}>
          <td>{nombreCorte(m)}</td>
          <td>{money(m.venta)}</td>
          <td>{money(m.tarjetas)}</td>
          <td>{m.transferencia ? money(m.transferencia) : "—"}</td>
          <td>{m.gastosTotal ? money(m.gastosTotal) : "—"}</td>
          <td className="e">{money(m.total)}</td>
        </tr>
      );
    });

  const seccion = (icono: ReactNode, titulo: string, onMas: (() => void) | null, hijos: ReactNode, clase = "") => (
    <section className={`cd-card ${clase}`}>
      <div className="cd-card-head">
        <h3>
          {icono} {titulo}
        </h3>
        {onMas ? (
          <button type="button" className="icon-btn accent" aria-label={`Agregar ${titulo.toLowerCase()}`} onClick={onMas}>
            <Plus size={18} />
          </button>
        ) : (
          t1Cerrado && <Lock size={15} className="cd-candado" />
        )}
      </div>
      {hijos}
    </section>
  );

  const tablaCortes =
    cortes.length === 0 ? (
      <Empty
        icon={<Users size={26} strokeWidth={1.3} />}
        text={vista === "t2" && !ap ? "Primero guarda el corte de apertura." : "Sin cortes capturados. Toca + para agregar el primero."}
      />
    ) : (
      <>
        <table className="cd-tabla">
          <thead>
            <tr>
              <th>Mesero</th>
              <th>Venta</th>
              <th>Tarjetas</th>
              <th>Transf.</th>
              <th>Gastos</th>
              <th>Entrega</th>
            </tr>
          </thead>
          <tbody>
            {vista === "dia" && ap ? (
              <>
                <tr className="cd-sub">
                  <td colSpan={6}>Turno 1 · Apertura 🔒</td>
                </tr>
                {filasCortes(cortes.filter((m) => enApertura(m.id)))}
                <tr className="cd-sub">
                  <td colSpan={6}>Turno 2 · Cierre</td>
                </tr>
                {filasCortes(cortes.filter((m) => !enApertura(m.id)))}
              </>
            ) : (
              filasCortes(cortes)
            )}
            <tr className="tot">
              <td>{vista === "dia" ? "Total del día" : vista === "t1" ? "Total de la apertura" : "Total del turno"}</td>
              <td>{money(suma(cortes, (m) => m.venta))}</td>
              <td>{money(suma(cortes, (m) => m.tarjetas))}</td>
              <td>{money(suma(cortes, (m) => m.transferencia))}</td>
              <td>{money(suma(cortes, (m) => m.gastosTotal))}</td>
              <td className="e">{money(suma(cortes, (m) => m.total))}</td>
            </tr>
          </tbody>
        </table>
        <div className="cd-lista-movil">
          {cortes.map((m) => {
            const off = corteBloqueado || p.bloqueado(m.id);
            return (
              <button key={m.id} type="button" className="cd-it" disabled={off} onClick={() => p.onEditarCorte(m)}>
                <span>
                  {nombreCorte(m)}
                  <small>
                    {[
                      `Venta ${money(m.venta)}`,
                      `tarjetas ${money(m.tarjetas)}`,
                      m.transferencia > 0 && `transf. ${money(m.transferencia)}`,
                      m.gastosTotal > 0 && `gastos ${money(m.gastosTotal)}`,
                      vista === "dia" && ap && (enApertura(m.id) ? "apertura" : "cierre"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <b className="e">{money(m.total)}</b>
              </button>
            );
          })}
        </div>
      </>
    );

  const listaGastos =
    gastos.length === 0 ? (
      <p className="hint">No hay gastos{vista === "dia" ? " este día" : " en este turno"}.</p>
    ) : (
      gastos.map((g) => {
        const off = corteBloqueado || p.bloqueado(g.id);
        return (
          <div key={g.id} className="cd-it">
            <button type="button" className="cd-it-main" disabled={off} onClick={() => p.onEditarGasto(g)}>
              <b>{g.concepto}</b>
              <small>{detalleGasto(g)}</small>
            </button>
            <span className="cd-it-der">
              {money(g.total)}
              {p.estadoAuto ? (
                <ChipEstado g={g} />
              ) : (
                <button
                  type="button"
                  className={`estado-chip ${g.estado}`}
                  disabled={off || (g.estado === "pendiente" && !g.categoria)}
                  onClick={() => p.onToggleGasto(g.id)}
                >
                  {g.estado === "pendiente" ? "Confirmar" : "Ingresado"}
                </button>
              )}
            </span>
          </div>
        );
      })
    );

  const listaTransfer =
    transferencias.length === 0 ? (
      <p className="hint">No hay transferencias{vista === "dia" ? " este día" : " en este turno"}.</p>
    ) : (
      transferencias.map((t) => (
        <button key={t.id} type="button" className="cd-it" disabled={corteBloqueado || p.bloqueado(t.id)} onClick={() => p.onEditarTransfer(t)}>
          <span>
            <b>{t.persona}</b>
            <small>{t.meseroCutId ? `Del corte de ${t.persona}` : "No se rebaja de ningún corte"}</small>
          </span>
          <b>{money(t.total)}</b>
        </button>
      ))
    );

  // --- Efectivo: solo dinero, como cuenta de caja con lo que "lleva" ---
  // + fondo que se dejó ayer, + lo que cobraron en efectivo (sin propinas,
  // ya sin tarjetas ni transferencias), − todos los gastos del turno (de
  // corte o generales; da igual si salieron de la caja o del fondo) = lo que
  // debe haber en caja; − lo que se deja para mañana = a entregar.
  const fila = (texto: ReactNode, monto: string, clase = "") => (
    <div className={`efectivo-fila ${clase}`}>
      <span>{texto}</span>
      <strong>{monto}</strong>
    </div>
  );
  const conApertura = !!efectivoDia?.tieneApertura;
  const cobrado = round2(suma(cortes, (m) => m.venta - m.tarjetas) - suma(transferencias, (t) => t.total));
  const gastado = suma(gastos, (g) => g.total);
  const fondo = efectivoDia?.dejadoAyer || 0;
  const seDeja = efectivoDia?.dejadoHoy || 0;
  // Turno 2: lo que entregó la apertura ya salió; si en el turno 1 hubo
  // propinas o gastos sin corte, la diferencia se muestra aparte para que
  // la cuenta cierre igual que el efectivo del día.
  const ajusteApertura = vista === "t2" && efectivoDia ? round2(efectivoDia.resto - (cobrado - gastado)) : 0;
  const entregadoApertura = vista === "dia" && conApertura ? efectivoDia!.aperturaEntregado : 0;
  // El fondo: con el manejo nuevo solo vive en el turno 1 (lo que queda,
  // porque sus gastos van aparte) y en Todo el día; antes seguía en caja.
  const renglonFondo: { texto: ReactNode; detalle?: string; monto: number } | null = !efectivoDia || fondo <= 0
    ? null
    : p.fondo
      ? vista === "dia"
        ? { texto: "Fondo que se dejó ayer", detalle: efectivoDia.ayer?.nota, monto: fondo }
        : vista === "t1" && !ap
          ? { texto: "Fondo que queda", detalle: `${money(fondo)} − ${money(efectivoDia.gastosFondo)} de gastos del fondo`, monto: efectivoDia.fondoQueda }
          : null
      : vista !== "t1" || !ap
        ? { texto: "Fondo que se dejó ayer", detalle: efectivoDia.ayer?.nota, monto: fondo }
        : null;
  const renglonesCaja: { texto: ReactNode; detalle?: string; monto: number }[] = [
    ...(renglonFondo ? [renglonFondo] : []),
    {
      texto: "Efectivo que cobraron los meseros",
      detalle: `${cortes.length} ${cortes.length === 1 ? "corte" : "cortes"} · sin propinas, tarjetas ni transferencias`,
      monto: cobrado,
    },
    {
      texto: vista === "dia" ? "Gastos del día" : "Gastos del turno",
      detalle: gastos.length ? `${gastos.length} ${gastos.length === 1 ? "gasto" : "gastos"} · de corte o generales` : "ninguno",
      monto: -gastado,
    },
    ...(Math.abs(ajusteApertura) >= 0.01 ? [{ texto: "Ajuste de la apertura", detalle: "propinas y gastos del turno 1", monto: ajusteApertura }] : []),
    ...(entregadoApertura ? [{ texto: "Ya se entregó en la apertura", detalle: "turno 1, se lo llevó el dueño", monto: -entregadoApertura }] : []),
  ];
  let lleva = 0;
  const hayEnCaja = round2(renglonesCaja.reduce((t, r) => t + r.monto, 0));
  const aEntregar = efectivoDia ? round2(hayEnCaja - seDeja) : totals.efectivo;
  const efectivo =
    vista === "t1" && ap ? (
      p.fondo && efectivoDia ? (
        <>
          {fila("Efectivo de las ventas de la apertura", money(efectivoDia.aperturaEf))}
          {fila("+ Fondo que queda", money(efectivoDia.fondoQueda))}
          {fila("Entregado al dueño en la apertura", money(efectivoDia.aperturaEntregado), "total")}
        </>
      ) : (
        fila("Entregado al dueño en la apertura", money(efectivoDia?.aperturaEf ?? suma(cortes, (m) => m.total)), "total")
      )
    ) : (
      <>
        <div className="cd-caja">
          {renglonesCaja.map((r, i) => {
            lleva = round2(lleva + r.monto);
            return (
              <div key={i} className="cd-caja-fila">
                <span>
                  {r.texto}
                  {r.detalle && <small>{r.detalle}</small>}
                </span>
                <b className={r.monto < 0 ? "menos" : ""}>
                  {r.monto < 0 ? "−" : r.monto > 0 ? "+" : ""}
                  {money(Math.abs(r.monto))}
                </b>
                <i>{money(lleva)}</i>
              </div>
            );
          })}
          {/* Sin efectivo que se deja, lo que hay en caja es lo que se entrega: un solo total. */}
          {seDeja > 0 && (
            <div className="cd-caja-fila subtotal">
              <span>Debe haber en caja</span>
              <b>{money(hayEnCaja)}</b>
              <i />
            </div>
          )}
          {seDeja > 0 && (
            <div className="cd-caja-fila">
              <span>
                Se deja para mañana
                {day.efectivoDejado?.nota && <small>{day.efectivoDejado.nota}</small>}
              </span>
              <b className="menos">−{money(seDeja)}</b>
              <i>{money(aEntregar)}</i>
            </div>
          )}
          {fila(textoEntregar, money(aEntregar), "total")}
        </div>
        {conApertura && vista === "t2" && (
          <div className="cd-caja-info">
            {fila(
              `Turno 1 · ya entregado al dueño${p.fondo && efectivoDia!.fondoEnApertura ? " (con el fondo)" : ""}`,
              money(efectivoDia!.aperturaEntregado),
              "info"
            )}
            {fila("Total de efectivo del día (apertura + noche)", money(efectivoDia!.totalDia), "info")}
          </div>
        )}
        {!corteBloqueado && efectivoDia && (
          <button type="button" className="link-btn" onClick={p.onDejarEfectivo}>
            {day.efectivoDejado ? "Cambiar el efectivo que se deja" : "+ Dejar efectivo para mañana"}
          </button>
        )}
      </>
    );

  // Fondo (turno 1): lo que se recibió, lo que se pagó con él y lo que queda,
  // aparte de los cortes de venta. Lo que queda se entrega con la apertura.
  const tarjetaFondo = efectivoDia && (
    <section className="cd-card cd-fondo">
      <div className="cd-card-head">
        <h3>
          <Wallet size={17} /> Fondo
        </h3>
        {!ap && !corteBloqueado ? (
          <button type="button" className="icon-btn accent" aria-label="Agregar gasto del fondo" onClick={p.onGastoFondo}>
            <Plus size={18} />
          </button>
        ) : (
          ap && <Lock size={15} className="cd-candado" />
        )}
      </div>
      <div className="cd-caja-fila">
        <span>
          Se dejó ayer
          <small>
            {[efectivoDia.ayer?.nota, day.fondoRecibido ? `recibido por ${day.fondoRecibido.nombre}` : !ap && "por recibir"].filter(Boolean).join(" · ")}
          </small>
        </span>
        <b>+{money(efectivoDia.dejadoAyer)}</b>
        <i />
      </div>
      {gastosFondo.map((g) => {
        const off = corteBloqueado || p.bloqueado(g.id);
        return (
          <div key={g.id} className="cd-caja-fila">
            <button type="button" className="cd-it-main" disabled={off} onClick={() => p.onEditarGasto(g)}>
              <b>{g.concepto}</b>
              <small>{etiquetaCategoria(g.categoria)}</small>
            </button>
            <b className="menos">−{money(g.total)}</b>
            {p.estadoAuto ? (
              <ChipEstado g={g} />
            ) : (
              <button
                type="button"
                className={`estado-chip ${g.estado}`}
                disabled={off || (g.estado === "pendiente" && !g.categoria)}
                onClick={() => p.onToggleGasto(g.id)}
              >
                {g.estado === "pendiente" ? "Confirmar" : "Ingresado"}
              </button>
            )}
          </div>
        );
      })}
      {gastosFondo.length === 0 && <p className="hint">Si pagas algo con el fondo, tócale + para registrarlo.</p>}
      {fila(ap ? "Quedó y se entregó con la apertura" : "Queda del fondo", money(efectivoDia.fondoQueda), "total")}
    </section>
  );

  return (
    <div className="cd">
      {day.corteGuardado ? (
        <div className="cd-hero hecho">
          <div className="cd-hero-avance">
            <span>Corte terminado</span>
            <span>100%</span>
          </div>
          <div className="cd-barra">
            <i style={{ width: "100%" }} />
          </div>
          <div className="cd-hero-texto">
            <h2>
              <Lock size={19} /> Corte guardado
            </h2>
            <p>
              Por {day.corteGuardado.nombre} el {conPunto(p.fechaHora(day.corteGuardado.fecha))}{" "}
              {p.isOwner ? "Tú lo puedes seguir editando." : "Ya no se puede editar. Si algo está mal, avísale al dueño."}
            </p>
          </div>
          {p.isOwner && (
            <button type="button" className="cd-hero-btn" onClick={p.onReabrir}>
              Reabrir corte
            </button>
          )}
        </div>
      ) : (
        paso && (
          <div className="cd-hero">
            <div className="cd-hero-avance">
              <span>
                Siguiente paso · {actual + 1} de {pasos.length}
              </span>
              <span>{porcentaje}%</span>
            </div>
            <div className="cd-barra">
              <i style={{ width: `${porcentaje}%` }} />
            </div>
            <div className="cd-hero-texto">
              <h2>{paso.titulo}</h2>
              {paso.texto && <p>{paso.texto}</p>}
            </div>
            {paso.boton && !corteBloqueado && (
              <button type="button" className="cd-hero-btn" onClick={paso.boton.accion}>
                {paso.boton.texto} ›
              </button>
            )}
            <div className="cd-pasos">
              {pasos.map((x, i) => (
                <span key={x.clave} className={x.hecho ? "ok" : i === actual ? "act" : ""}>
                  {x.hecho ? <Check size={12} /> : `${i + 1} ·`} {x.corto}
                </span>
              ))}
            </div>
          </div>
        )
      )}

      {turnos && (
        <div className="cd-pestanas" role="tablist">
          <button type="button" role="tab" className={vista === "t1" ? "on" : ""} onClick={() => setPestana("t1")}>
            <span>
              Turno 1<span className="cd-largo"> · Apertura</span>
            </span>
            <small>{ap ? `✓ 🔒 ${new Date(ap.fecha).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}` : `${day.meseros.length} ${day.meseros.length === 1 ? "corte" : "cortes"} · en curso`}</small>
          </button>
          <button type="button" role="tab" className={vista === "t2" ? "on" : ""} onClick={() => setPestana("t2")}>
            <span>
              Turno 2<span className="cd-largo"> · Cierre</span>
            </span>
            <small>{!ap ? "después de la apertura" : `${cortesCierre.length} ${cortesCierre.length === 1 ? "corte" : "cortes"}${day.corteGuardado ? " · 🔒" : " · en curso"}`}</small>
          </button>
          <button type="button" role="tab" className={vista === "dia" ? "on" : ""} onClick={() => setPestana("dia")}>
            Todo el día
            <small>resumen</small>
          </button>
        </div>
      )}

      {t1Cerrado && ap && (
        <div className="cd-aviso">
          <Lock size={15} />
          <span>
            <strong>Corte de apertura</strong>
            {ap.abrio ? ` (abrió ${ap.abrio.nombre})` : ""} guardado por {ap.nombre} el {conPunto(p.fechaHora(ap.fecha))}{" "}
            {p.isOwner ? (
              <>
                El personal ya no lo puede cambiar.{" "}
                <button type="button" className="link-btn" onClick={p.onApertura}>
                  Editar apertura
                </button>
                {" · "}
                <button type="button" className="link-btn" onClick={p.onQuitarApertura}>
                  Desbloquear
                </button>
              </>
            ) : (
              "Ya no se puede editar."
            )}
          </span>
        </div>
      )}

      {vista === "t1" && ap?.desbloqueada && (
        <div className="cd-aviso">
          <span>
            <strong>Apertura desbloqueada:</strong> el personal la puede editar.{" "}
            {p.isOwner && (
              <button type="button" className="link-btn" onClick={p.onApertura}>
                Editar y volver a bloquear
              </button>
            )}
          </span>
        </div>
      )}

      <div className="cd-kpis">
        {kpis.map((k) =>
          k.editar ? (
            <button key={k.texto} type="button" className={`cd-kpi ${k.principal ? "h" : ""}`} onClick={k.editar}>
              {k.texto}
              <b>{money(k.valor)} ✎</b>
            </button>
          ) : (
            <div key={k.texto} className={`cd-kpi ${k.principal ? "h" : ""}`}>
              {k.texto}
              <b>{money(k.valor)}</b>
            </div>
          )
        )}
      </div>

      {/* iPad: cortes y efectivo a la izquierda, gastos y transferencias a la derecha. Celular: cortes, gastos, transferencias y al final el efectivo (que los suma). */}
      <div className="cd-cols">
        <div className="cd-a">
          {seccion(<Users size={17} />, vista === "t1" && ap ? "Cortes de apertura" : "Cortes de meseros", puedeAgregar ? p.onNuevoCorte : null, tablaCortes)}
        </div>
        <div className="cd-lado">
          {p.fondo && efectivoDia && vista === "t1" && tarjetaFondo}
          {seccion(<Receipt size={17} />, "Gastos", puedeAgregar ? p.onNuevoGasto : null, listaGastos, "cd-gastos")}
          {seccion(<ArrowLeftRight size={17} />, "Transferencias", puedeAgregar ? p.onNuevaTransfer : null, listaTransfer)}
        </div>
        <section className="cd-card efectivo-dia cd-c">
          <div className="cd-card-head">
            <h3>Efectivo · ¿cuánto debe haber?</h3>
          </div>
          {efectivo}
        </section>
      </div>

      <div className={`cd-barra-fija ${p.isOwner ? "con-menu" : ""}`}>
        <div className="cd-barra-fija-in">
          <div className="cd-entregar">
            <span>{textoEntregar}</span>
            <b>{money(entregar)}</b>
          </div>
          {!corteBloqueado && efectivoDia && !day.corteGuardado && (
            <button type="button" className="cd-btn sec ocultar-movil" onClick={p.onDejarEfectivo}>
              Dejar efectivo
            </button>
          )}
          {!day.corteGuardado ? (
            <button type="button" className="cd-btn" onClick={p.onGuardarCorte}>
              <Lock size={16} /> Guardar corte
            </button>
          ) : p.isOwner ? (
            <button type="button" className="cd-btn sec" onClick={p.onReabrir}>
              Reabrir corte
            </button>
          ) : (
            <span className="cd-guardado">
              <Lock size={15} /> Guardado
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Estado del gasto según Johnster (solo se muestra).
function ChipEstado({ g }: { g: Gasto }) {
  const texto =
    g.estado === "ingresado"
      ? "Ingresado"
      : g.estadoBot === "no-esta"
        ? "No está en el bot"
        : g.estadoBot === "sin-ticket"
          ? "Falta ticket"
          : g.estadoBot === "domingo"
            ? "Se sube el domingo"
            : g.estadoBot === "diferente"
              ? "Otro monto en el bot"
              : "Pendiente";
  return <span className={`estado-chip ${g.estado} ${g.estadoBot === "no-esta" || g.estadoBot === "diferente" ? "mal" : ""}`}>{texto}</span>;
}
