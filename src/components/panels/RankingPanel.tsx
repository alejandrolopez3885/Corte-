import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Avatar } from "../Avatar";
import { Empty } from "../ui";
import { TituloPagina } from "../BarraTitulo";
import { money } from "../../lib/dataModel";
import { MINIMO_DIAS_RANKING, calcularRanking, rangoRanking, type PeriodoRanking } from "../../lib/ranking";
import { MINIMO_ENCUESTAS, calificaciones } from "../../lib/encuestas";
import type { AppData } from "../../lib/types";

// Ranking de meseros. Personal de Piso ("equipo"): lugar, foto, nombre,
// barra y puntos, sin montos; arriba, cómo ganó sus propios puntos. Dueño:
// con venta por día, días y cancelaciones en dinero, y también el del mes.
export function RankingPanel({
  data,
  modo,
  miMeseroId,
  onBack,
  backLabel,
}: {
  data: AppData;
  modo: "dueno" | "equipo";
  miMeseroId?: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  const [periodo, setPeriodo] = useState<PeriodoRanking>("semana");
  const { desde, hasta } = rangoRanking(periodo);
  const ranking = calcularRanking(data, desde, hasta);
  // ⭐ de las encuestas: columna aparte, no cambia los puntos.
  const [estrellas, setEstrellas] = useState<Map<string, { promedio: number; cantidad: number }>>(new Map());
  useEffect(() => {
    let vivo = true;
    calificaciones(desde, hasta).then((m) => vivo && setEstrellas(m));
    return () => {
      vivo = false;
    };
  }, [desde, hasta]);
  const yo = ranking.filas.find((f) => f.meseroId === miMeseroId);
  const yoSinEntrar = ranking.sinEntrar.find((f) => f.meseroId === miMeseroId);
  const periodos: [PeriodoRanking, string][] = [
    ["semana", "Esta semana"],
    ["semanaPasada", "Semana pasada"],
    ...(modo === "dueno" ? ([["mes", "Mes"]] as [PeriodoRanking, string][]) : []),
  ];
  const nombrePeriodo = periodo === "semana" ? "esta semana" : periodo === "semanaPasada" ? "la semana pasada" : "este mes";

  return (
    <div className="page-section">
      <TituloPagina titulo="Ranking" onBack={onBack} backLabel={backLabel} />
      <div className="ranking-periodos">
        {periodos.map(([p, t]) => (
          <button key={p} type="button" className={p === periodo ? "activo" : ""} onClick={() => setPeriodo(p)}>
            {t}
          </button>
        ))}
      </div>

      {modo === "equipo" && yo && (
        <div className="ranking-mio">
          <strong>
            Tus puntos {nombrePeriodo}: {yo.puntos}
          </strong>
          <div>
            <span>Venta por día trabajado</span>
            <b>+{yo.puntosVenta}</b>
          </div>
          <div>
            <span>Cancelaciones ({yo.pctCancelacion.toLocaleString("es-MX")}% de tu venta)</span>
            <b className={yo.puntosCancelacion > 0 ? "resta" : ""}>−{yo.puntosCancelacion}</b>
          </div>
          <div>
            <span>Días trabajados</span>
            <b>{yo.dias}</b>
          </div>
        </div>
      )}
      {modo === "equipo" && !yo && yoSinEntrar && (
        <p className="hint">
          Llevas {yoSinEntrar.dias} {yoSinEntrar.dias === 1 ? "día" : "días"}: te falta{MINIMO_DIAS_RANKING - yoSinEntrar.dias === 1 ? "" : "n"}{" "}
          {MINIMO_DIAS_RANKING - yoSinEntrar.dias} para entrar al ranking.
        </p>
      )}

      {ranking.filas.length === 0 ? (
        <Empty icon={<Trophy size={26} strokeWidth={1.3} />} text={`Todavía nadie lleva ${MINIMO_DIAS_RANKING} días con venta ${nombrePeriodo}.`} />
      ) : (
        <div className="ranking-lista">
          {ranking.filas.map((f) => (
            <div key={f.meseroId} className={`ranking-fila ${f.meseroId === miMeseroId ? "yo" : ""}`}>
              <span className={`ranking-lugar ${f.lugar <= 3 ? "podio" : ""}`}>{f.lugar}</span>
              <Avatar nombre={f.empleado?.nombre || f.nombre} foto={f.empleado?.foto} tamano={36} />
              <div className="ranking-nombre">
                <strong>
                  {f.nombre}
                  {f.meseroId === miMeseroId && <em className="etiqueta-tu">Tú</em>}
                </strong>
                {modo === "dueno" ? (
                  <span>
                    {money(f.ventaPorDia)}/día · {f.dias} días · cancel. {money(f.cancelaciones)} ({f.pctCancelacion.toLocaleString("es-MX")}%)
                  </span>
                ) : (
                  <div className="ranking-barra">
                    <i style={{ width: `${Math.max(3, f.puntos)}%` }} />
                  </div>
                )}
              </div>
              <span className="ranking-derecha">
                <span className="ranking-puntos">
                  {f.puntos}
                  {modo === "dueno" && <small> pts</small>}
                </span>
                {estrellas.get(f.meseroId) && (
                  <span className="ranking-estrellas">
                    ⭐{" "}
                    {estrellas.get(f.meseroId)!.cantidad >= MINIMO_ENCUESTAS
                      ? estrellas.get(f.meseroId)!.promedio.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                      : "—"}{" "}
                    · {estrellas.get(f.meseroId)!.cantidad}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {ranking.sinEntrar.length > 0 && (
        <p className="hint">
          Para aparecer: {MINIMO_DIAS_RANKING} días trabajados. Aún sin entrar:{" "}
          {ranking.sinEntrar.map((s) => `${s.nombre} (${s.dias} ${s.dias === 1 ? "día" : "días"})`).join(", ")}.
        </p>
      )}
      <p className="hint">
        Cómo se calcula: la venta por día trabajado da hasta 100 puntos (100 = quien más vende por día {nombrePeriodo}) y cada 1% de
        cancelaciones sobre su venta resta 10 puntos. Para aparecer hacen falta {MINIMO_DIAS_RANKING} días trabajados.
        {periodo === "semana" ? " La semana va de lunes a domingo." : ""} ⭐ = calificación de atención en las encuestas (1 a 5) y
        cuántas válidas; se muestra con {MINIMO_ENCUESTAS} o más y no cambia los puntos.
      </p>
    </div>
  );
}

// Tarjeta del inicio del personal de Piso: su lugar de la semana.
export function RankingTarjeta({ data, miMeseroId, onVer }: { data: AppData; miMeseroId?: string; onVer: () => void }) {
  const { desde, hasta } = rangoRanking("semana");
  const ranking = calcularRanking(data, desde, hasta);
  const yo = ranking.filas.find((f) => f.meseroId === miMeseroId);
  const arriba = yo ? ranking.filas.filter((f) => f.puntos > yo.puntos).pop() : undefined;
  const sinEntrar = ranking.sinEntrar.find((f) => f.meseroId === miMeseroId);
  return (
    <button type="button" className="ranking-tarjeta" onClick={onVer}>
      <span className="ranking-tarjeta-top">
        <span>
          <Trophy size={14} /> Ranking de esta semana
        </span>
      </span>
      {yo ? (
        <>
          <span className="ranking-tarjeta-lugar">
            {yo.lugar}º <small>de {ranking.filas.length} meseros · {yo.puntos} puntos</small>
          </span>
          <span className="ranking-tarjeta-sub">
            {arriba ? `Te faltan ${arriba.puntos - yo.puntos} puntos para el ${arriba.lugar}º lugar.` : "¡Vas en primer lugar!"}
          </span>
        </>
      ) : (
        <span className="ranking-tarjeta-sub">
          {sinEntrar
            ? `Llevas ${sinEntrar.dias} día: con ${MINIMO_DIAS_RANKING} días entras al ranking.`
            : ranking.filas.length
              ? `Van ${ranking.filas.length} meseros en el ranking.`
              : "Todavía nadie entra al ranking esta semana."}
        </span>
      )}
      <span className="ranking-tarjeta-ver">Ver ranking ›</span>
    </button>
  );
}
