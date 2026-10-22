import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { addDaysIso, formatLongDayDate, money, todayIso } from "../../lib/dataModel";
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
            g.alertas.length === 0 && !(g.key === "negocio" && (tarjetaVenta || tarjetaPagos)) && !(g.key === "operacion" && notaEquivalencia) ? null : (
              <section key={g.key} className="ini-grupo">
                <h3 className={`ini-grupo-titulo ${g.clase}`}>{g.titulo}</h3>
                {g.key === "negocio" && tarjetaVenta}
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
