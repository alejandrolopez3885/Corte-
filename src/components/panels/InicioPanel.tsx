import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { addDaysIso, diaPorFecha, formatLongDayDate, mondayOnOrBefore, money, todayIso } from "../../lib/dataModel";
import { pronosticoDesdeLunes } from "../../lib/pronostico";
import { etiquetasDelDia } from "../../lib/etiquetas";
import { PronosticoDetalle } from "../PronosticoDetalle";
import { Sheet } from "../ui";
import { cargarBitacora, type RenglonBitacora } from "../../lib/bitacora";
import { calcularInicio, type AlertaInicio, type Destino } from "../../lib/inicio";
import { pctCambio } from "../../lib/tendencias";
import type { AppData } from "../../lib/types";
import { TituloPagina } from "../BarraTitulo";

// Inicio del dueño: lo que necesita su atención hoy, de lo más urgente a lo
// menos. Un grupo sin pendientes no aparece; sin ninguno, "Todo al día".
// Ver lib/inicio.ts.
export function InicioPanel({ data, ownerId, onIr }: { data: AppData; ownerId: string; onIr: (destino: Destino) => void }) {
  const hoy = todayIso();
  // Últimos 7 días de Actividad (si la bitácora no existe, ese grupo no sale).
  const [bitacora, setBitacora] = useState<RenglonBitacora[] | null>(null);
  useEffect(() => {
    let cancelado = false;
    const desde = new Date(`${addDaysIso(hoy, -6)}T00:00:00`).toISOString();
    const hasta = new Date(`${addDaysIso(hoy, 1)}T00:00:00`).toISOString();
    cargarBitacora(ownerId, desde, hasta).then(({ data: rows, error }) => {
      if (!cancelado && !error) setBitacora((rows || []) as RenglonBitacora[]);
    });
    return () => {
      cancelado = true;
    };
  }, [ownerId, hoy]);

  const inicio = calcularInicio(data, hoy, bitacora, ownerId);
  const grupos = [
    { key: "urgente", titulo: "Urgente", clase: "rojo", alertas: inicio.urgente },
    { key: "operacion", titulo: "Operación", clase: "amarillo", alertas: inicio.operacion },
    { key: "negocio", titulo: "El negocio", clase: "verde", alertas: inicio.negocio },
    { key: "app", titulo: "La app y el equipo", clase: "gris", alertas: inicio.app },
  ];
  const total = grupos.reduce((s, g) => s + g.alertas.length, 0);
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const { venta } = inicio;
  const cambio = pctCambio(venta.hastaHoy, venta.semanaPasada);
  const avanceMeta = venta.meta ? Math.min(100, Math.round((venta.hastaHoy / venta.meta) * 100)) : null;

  const tarjetaVenta = venta.diasContados > 0 && (
    <div className="ini-venta">
      <span className="hint">Venta hasta hoy ({venta.diasContados === 1 ? "lunes" : `lun–${["", "", "mar", "mié", "jue", "vie", "sáb", "dom"][venta.diasContados]}`})</span>
      <strong className="ini-venta-monto">{money(venta.hastaHoy)}</strong>
      {cambio !== null && (
        <div className="ini-venta-fila">
          <span>vs. semana pasada</span>
          <span className={cambio < 0 ? "baja" : "sube"}>
            {cambio < 0 ? "▼" : "▲"} {Math.abs(Math.round(cambio))}%
          </span>
        </div>
      )}
      {avanceMeta !== null && (
        <>
          <div className="ini-venta-fila">
            <span>Meta semanal {money(venta.meta)}</span>
            <span>{avanceMeta}%</span>
          </div>
          <div className="ini-barra">
            <i style={{ width: `${avanceMeta}%` }} />
          </div>
        </>
      )}
    </div>
  );

  // Venta esperada: esta semana (con lo real de los días que ya pasaron) y
  // la que viene.
  const lunes = mondayOnOrBefore(hoy);
  const estaSemana = pronosticoDesdeLunes(data.months, lunes, hoy);
  const siguiente = pronosticoDesdeLunes(data.months, addDaysIso(lunes, 7), hoy);
  const esperadaSemana = estaSemana.reduce((t, d) => t + (d.pronostico?.esperado || 0), 0);
  const esperadaSiguiente = siguiente.reduce((t, d) => t + (d.pronostico?.esperado || 0), 0);
  const hoyP = estaSemana.find((d) => d.fecha === hoy);
  const [verDia, setVerDia] = useState<(typeof estaSemana)[number] | null>(null);
  const filaDia = (d: (typeof estaSemana)[number]) => {
    const p = d.pronostico;
    if (!p) return null;
    const pasado = d.fecha < hoy && d.real > 0;
    const diff = pasado ? Math.round(((d.real - p.esperado) / p.esperado) * 100) : null;
    return (
      <button key={d.fecha} type="button" className={`ini-pron-dia ${d.fecha === hoy ? "hoy" : ""}`} onClick={() => setVerDia(d)}>
        <span>
          {d.dia.slice(0, 3)} {Number(d.fecha.slice(8))}
          {etiquetasDelDia(diaPorFecha(data.months, d.fecha), d.fecha).map((e) => e.icono).join("")}
        </span>
        <b>{money(p.esperado)}</b>
        <i className={diff === null ? "" : diff >= 0 ? "sube" : "baja"}>
          {diff === null ? (d.fecha === hoy ? "hoy" : "") : `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff)}%`}
        </i>
      </button>
    );
  };
  const tarjetaPronostico = esperadaSemana > 0 && (
    <div className="ini-pron">
      <span className="hint">Venta esperada esta semana</span>
      <strong className="ini-venta-monto">{money(esperadaSemana)}</strong>
      {hoyP?.pronostico && (
        <div className="ini-venta-fila">
          <span>Hoy se esperan</span>
          <span>
            {money(hoyP.pronostico.esperado)} <small>({money(hoyP.pronostico.bajo)}–{money(hoyP.pronostico.alto)})</small>
          </span>
        </div>
      )}
      <div className="ini-pron-dias">{estaSemana.map(filaDia)}</div>
      {esperadaSiguiente > 0 && (
        <div className="ini-venta-fila">
          <span>La semana que viene</span>
          <strong>{money(esperadaSiguiente)}</strong>
        </div>
      )}
      <p className="ini-nota">▲▼ = lo que se vendió contra lo esperado. Toca un día para ver de dónde sale.</p>
    </div>
  );
  const hojaDia = verDia?.pronostico && (
    <Sheet title={`Venta esperada · ${formatLongDayDate(verDia.fecha).replace(/ de \d{4}$/, "")}`} onClose={() => setVerDia(null)}>
      {etiquetasDelDia(diaPorFecha(data.months, verDia.fecha), verDia.fecha).map((e) => (
        <p key={e.texto} className="etq-quincena">
          {e.icono} {e.texto}
        </p>
      ))}
      <PronosticoDetalle p={verDia.pronostico} real={verDia.fecha < hoy && verDia.real > 0 ? verDia.real : undefined} />
    </Sheet>
  );

  const { pagos } = inicio;
  const tarjetaPagos = pagos && pagos.total > 0 && (
    <div className="ini-pagos">
      <span className="hint">Por pagar en transferencia esta semana (estimado hoy)</span>
      {pagos.nomina > 0 && (
        <div className="ini-pagos-fila">
          <span>Nómina (lo que no alcanza el efectivo)</span>
          <strong>{money(pagos.nomina)}</strong>
        </div>
      )}
      {pagos.fijos > 0 && (
        <div className="ini-pagos-fila">
          <span>Gastos fijos</span>
          <strong>{money(pagos.fijos)}</strong>
        </div>
      )}
      {pagos.operativos > 0 && (
        <div className="ini-pagos-fila">
          <span>Gastos operativos capturados</span>
          <strong>{money(pagos.operativos)}</strong>
        </div>
      )}
      <div className="ini-pagos-fila total">
        <span>Total</span>
        <strong>{money(pagos.total)}</strong>
      </div>
    </div>
  );
  const notaEquivalencia = inicio.sinEquivalencia > 0 && (
    <p className="ini-nota">
      {inicio.sinEquivalencia} {inicio.sinEquivalencia === 1 ? "insumo" : "insumos"} sin "¿Cuánto trae 1 …?" en el Catálogo — no se
      puede calcular su consumo.
    </p>
  );

  return (
    <div className="page-section">
      {hojaDia}
      <div>
        <TituloPagina titulo={saludo} />
        <p className="hint ini-fecha">{formatLongDayDate(hoy).replace(/ de \d{4}$/, "")}</p>
      </div>

      {total === 0 ? (
        <>
          <div className="ini-todo-bien">
            <Check size={28} />
            <strong>Todo al día</strong>
            <span>No hay cortes, gastos ni pendientes por revisar.</span>
          </div>
          {tarjetaVenta}
          {tarjetaPronostico}
          {tarjetaPagos}
        </>
      ) : (
        <>
          <div className="ini-resumen">
            <span className="ini-resumen-num">{total}</span>
            <span>
              {total === 1 ? "cosa" : "cosas"} por revisar
              {inicio.urgente.length > 0 && (
                <>
                  {" · "}
                  <strong>
                    {inicio.urgente.length} {inicio.urgente.length === 1 ? "urgente" : "urgentes"}
                  </strong>
                </>
              )}
            </span>
          </div>
          {grupos.map((g) =>
            g.alertas.length === 0 && !(g.key === "negocio" && (tarjetaVenta || tarjetaPagos || tarjetaPronostico)) && !(g.key === "operacion" && notaEquivalencia) ? null : (
              <section key={g.key} className="ini-grupo">
                <h3 className={`ini-grupo-titulo ${g.clase}`}>{g.titulo}</h3>
                {g.key === "negocio" && tarjetaVenta}
                {g.key === "negocio" && tarjetaPronostico}
                {g.key === "negocio" && tarjetaPagos}
                {g.alertas.map((al) => (
                  <Alerta key={al.id} alerta={al} clase={g.clase} onIr={onIr} />
                ))}
                {g.key === "operacion" && notaEquivalencia}
                {g.key === "negocio" && g.alertas.length > 0 && (
                  <button className="link-btn ini-ver-todo" onClick={() => onIr({ tipo: "tendencias" })}>
                    Ver todo en Tendencias ›
                  </button>
                )}
              </section>
            )
          )}
        </>
      )}
    </div>
  );
}

function Alerta({ alerta, clase, onIr }: { alerta: AlertaInicio; clase: string; onIr: (destino: Destino) => void }) {
  return (
    <button className={`ini-alerta ${clase}`} onClick={() => onIr(alerta.ir)}>
      <span className="ini-alerta-texto">
        <strong>{alerta.titulo}</strong>
        <small>{alerta.detalle}</small>
      </span>
      <span className="ini-alerta-ver">Ver ›</span>
    </button>
  );
}
