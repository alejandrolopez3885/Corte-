import { useEffect, useState } from "react";
import { ChevronRight, Trophy } from "lucide-react";
import { Avatar } from "../Avatar";
import { Empty, Sheet } from "../ui";
import { TituloPagina } from "../BarraTitulo";
import { money, todayIso } from "../../lib/dataModel";
import { MINIMO_DIAS_RANKING, calcularRanking, rangoRanking, type FilaRanking, type PeriodoRanking } from "../../lib/ranking";
import { MINIMO_ENCUESTAS, calificaciones } from "../../lib/encuestas";
import {
  LOGROS,
  cargarLogros,
  cargarMovimientos,
  cargarSemanas,
  emojiLogro,
  nombreLogro,
  nombreSemana,
  type LogroGanado,
  type SemanaCerrada,
} from "../../lib/puntos";
import type { AppData } from "../../lib/types";

// Ranking de meseros: lugar, foto, nombre, barra y puntaje, igual para
// todos. Tocar a alguien abre su perfil público (descripción, lugar, ⭐,
// logros y semanas ganadas); el dueño ve además venta, días, cancelaciones
// y sus puntos acumulados. Personal: arriba, cómo ganó su propio puntaje.
// Dueño: también el del mes.
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
  // Ganador de la última semana cerrada y los logros de cada quien.
  const [ultima, setUltima] = useState<SemanaCerrada | null>(null);
  const [semanas, setSemanas] = useState<SemanaCerrada[]>([]);
  const [logros, setLogros] = useState<LogroGanado[]>([]);
  const [viendo, setViendo] = useState<FilaRanking | null>(null);
  useEffect(() => {
    let vivo = true;
    cargarSemanas(52).then((s) => {
      if (!vivo) return;
      setUltima(s?.[0] || null);
      setSemanas(s || []);
    });
    cargarLogros().then((l) => vivo && setLogros(l));
    return () => {
      vivo = false;
    };
  }, []);
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
      {ultima?.ganador_nombre && (
        <div className="ranking-ganador">
          <span>🏆</span>
          <div>
            <strong>
              {ultima.resultados.filter((r) => r.lugar === 1).length > 1 ? "Ganadores" : "Ganó"} la semana del {nombreSemana(ultima.lunes)}:{" "}
              {ultima.ganador_nombre}
            </strong>
            {miMeseroId && ultima.resultados.some((r) => r.lugar === 1 && r.meseroId === miMeseroId) && <small>¡Felicidades, fuiste tú!</small>}
          </div>
        </div>
      )}
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
            Tus puntos del ranking {nombrePeriodo}: {yo.puntos}
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
            <button type="button" key={f.meseroId} className={`ranking-fila ${f.meseroId === miMeseroId ? "yo" : ""}`} onClick={() => setViendo(f)}>
              <span className={`ranking-lugar ${f.lugar <= 3 ? "podio" : ""}`}>{f.lugar}</span>
              <Avatar nombre={f.empleado?.nombre || f.nombre} foto={f.empleado?.foto} tamano={36} />
              <div className="ranking-nombre">
                <strong>
                  {f.nombre}
                  {f.meseroId === miMeseroId && <em className="etiqueta-tu">Tú</em>}
                </strong>
                <div className="ranking-barra">
                  <i style={{ width: `${Math.max(3, f.puntos)}%` }} />
                </div>
              </div>
              <span className="ranking-puntos">{f.puntos}</span>
              <ChevronRight size={16} className="ranking-ver" />
            </button>
          ))}
        </div>
      )}

      {ranking.filas.length > 0 && <p className="hint">Toca a alguien para ver su perfil.</p>}
      {viendo && (
        <PerfilRanking
          data={data}
          fila={viendo}
          total={ranking.filas.length}
          nombrePeriodo={nombrePeriodo}
          logros={logros.filter((l) => l.mesero_id === viendo.meseroId)}
          semanasGanadas={semanas.filter((s) => s.resultados.some((r) => r.meseroId === viendo.meseroId && r.lugar === 1)).length}
          dueno={modo === "dueno"}
          onClose={() => setViendo(null)}
        />
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
        {periodo === "semana" ? " La semana va de lunes a domingo." : ""} En el perfil de cada quien, las estrellas son su calificación
        de atención en las encuestas desde el inicio (1 a 5) y cuántas válidas; se muestra con {MINIMO_ENCUESTAS} o más y no cambia los puntos.
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

// Perfil público de alguien del ranking: su lugar y puntos del periodo que
// se ve, y sus encuestas desde el inicio con estrellas. Sin sus Monedas
// Anubis ni montos, salvo para el dueño (en el recuadro "Solo tú").
function PerfilRanking({
  data,
  fila,
  total,
  nombrePeriodo,
  logros,
  semanasGanadas,
  dueno,
  onClose,
}: {
  data: AppData;
  fila: FilaRanking;
  total: number;
  nombrePeriodo: string;
  logros: LogroGanado[];
  semanasGanadas: number;
  dueno: boolean;
  onClose: () => void;
}) {
  const [acumulados, setAcumulados] = useState<number | null>(null);
  // Encuestas desde el inicio (válidas, sin las de prueba).
  const [estrellas, setEstrellas] = useState<{ promedio: number; cantidad: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    calificaciones("2000-01-01", todayIso()).then((m) => vivo && setEstrellas(m.get(fila.meseroId) || { promedio: 0, cantidad: 0 }));
    return () => {
      vivo = false;
    };
  }, [fila.meseroId]);
  useEffect(() => {
    if (!dueno) return;
    let vivo = true;
    cargarMovimientos(fila.meseroId).then((m) => vivo && m && setAcumulados(m.reduce((s, x) => s + x.puntos, 0)));
    return () => {
      vivo = false;
    };
  }, [dueno, fila.meseroId]);
  const e = fila.empleado;
  const puesto = e?.puestoId ? data.puestos.find((p) => p.id === e.puestoId) : undefined;
  const area = puesto ? data.areas.find((a) => a.id === puesto.areaId) : undefined;
  const ganados = LOGROS.flatMap((def) => logros.filter((l) => l.logro === def.id).map((l) => `${emojiLogro(def, l.nivel)} ${nombreLogro(def, l.nivel)}`));
  return (
    <Sheet title={fila.nombre} onClose={onClose}>
      <div className="perfil-publico">
        <Avatar nombre={e?.nombre || fila.nombre} foto={e?.foto} tamano={84} />
        <strong>{e?.nombre || fila.nombre}</strong>
        {(puesto || area) && <span className="hint">{[puesto?.nombre, area?.nombre].filter(Boolean).join(" · ")}</span>}
        {e?.descripcion && <em>“{e.descripcion}”</em>}
      </div>
      <div className="perfil-publico-datos">
        <div>
          <b>{fila.lugar}º</b>
          <span>
            {nombrePeriodo} · de {total}
          </span>
        </div>
        <div>
          <b>{fila.puntos}</b>
          <span>puntos {nombrePeriodo}</span>
        </div>
        <div>
          {estrellas && estrellas.cantidad >= MINIMO_ENCUESTAS ? <Estrellas valor={estrellas.promedio} /> : <b>⭐ —</b>}
          <span>
            {estrellas && estrellas.cantidad >= MINIMO_ENCUESTAS
              ? `${estrellas.promedio.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · `
              : ""}
            {estrellas?.cantidad || 0} {estrellas?.cantidad === 1 ? "encuesta" : "encuestas"}
          </span>
        </div>
      </div>
      <div className="perfil-publico-logros">
        <span className="hint">Logros</span>
        {ganados.length ? (
          <div>
            {ganados.map((g) => (
              <em key={g}>{g}</em>
            ))}
          </div>
        ) : (
          <span className="hint">Todavía ninguno.</span>
        )}
        {semanasGanadas > 0 && (
          <span className="hint">
            🏆 Ganó {semanasGanadas} {semanasGanadas === 1 ? "semana" : "semanas"}
          </span>
        )}
      </div>
      {dueno && (
        <p className="perfil-publico-dueno">
          Solo tú: {money(fila.ventaPorDia)}/día · {fila.dias} días · cancelaciones {money(fila.cancelaciones)} (
          {fila.pctCancelacion.toLocaleString("es-MX")}%){acumulados !== null ? ` · ${acumulados.toLocaleString("es-MX")} 🪙 Monedas Anubis` : ""}
        </p>
      )}
      <button type="button" className="btn-secundario" onClick={onClose}>
        Cerrar
      </button>
    </Sheet>
  );
}

// Cinco estrellas con el promedio redondeado a media estrella.
function Estrellas({ valor }: { valor: number }) {
  const ancho = (Math.round(valor * 2) / 2 / 5) * 100;
  return (
    <b className="estrellas-calif" aria-label={`${valor} de 5 estrellas`}>
      <span>★★★★★</span>
      <span className="llenas" style={{ width: `${ancho}%` }}>
        ★★★★★
      </span>
    </b>
  );
}
