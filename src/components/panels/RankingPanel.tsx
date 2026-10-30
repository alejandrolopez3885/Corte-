import { useEffect, useState } from "react";
import { useTickRecargar } from "../JalarParaActualizar";
import { ChevronRight, Trophy } from "lucide-react";
import { Avatar } from "../Avatar";
import { Empty, Sheet } from "../ui";
import { TituloPagina } from "../BarraTitulo";
import { money, todayIso } from "../../lib/dataModel";
import {
  MINIMO_TURNOS_GANAR,
  PUNTOS_POR_ENCUESTA,
  calcularRanking,
  rangoRanking,
  rankingEncuestas,
  type EncuestasMesero,
  type FilaRanking,
  type PeriodoRanking,
} from "../../lib/ranking";
import { MINIMO_ENCUESTAS, calificaciones, encuestasParaRanking } from "../../lib/encuestas";
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

// Ranking de meseros. Dos principales: el de venta (venta por turno −
// cancelaciones + encuestas) y el de encuestas (al final quien no tiene);
// y cuatro secundarios encogidos en "Ver más rankings". Igual para todos
// (el personal sin montos); tocar a alguien abre su perfil público. Arriba,
// cómo sacó sus puntos (personal) y el ganador de la última semana.
const uno = (n: number) => n.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
  const [encuestas, setEncuestas] = useState<Map<string, EncuestasMesero>>(new Map());
  const tick = useTickRecargar();
  useEffect(() => {
    let vivo = true;
    encuestasParaRanking(desde, hasta).then((m) => vivo && setEncuestas(m));
    return () => {
      vivo = false;
    };
  }, [desde, hasta, tick]);
  const ranking = calcularRanking(data, desde, hasta, encuestas);
  const deEncuestas = rankingEncuestas(ranking.filas);
  // Ganador de la última semana cerrada y los logros de cada quien.
  const [ultima, setUltima] = useState<SemanaCerrada | null>(null);
  const [semanas, setSemanas] = useState<SemanaCerrada[]>([]);
  const [logros, setLogros] = useState<LogroGanado[]>([]);
  const [viendo, setViendo] = useState<FilaRanking | null>(null);
  const [masAbierto, setMasAbierto] = useState(false);
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
  }, [tick]);
  const yo = ranking.filas.find((f) => f.meseroId === miMeseroId);
  const periodos: [PeriodoRanking, string][] = [
    ["semana", "Esta semana"],
    ["semanaPasada", "Semana pasada"],
    ...(modo === "dueno" ? ([["mes", "Mes"]] as [PeriodoRanking, string][]) : []),
  ];
  const nombrePeriodo = periodo === "semana" ? "esta semana" : periodo === "semanaPasada" ? "la semana pasada" : "este mes";
  const maxPuntos = Math.max(1, ...ranking.filas.map((f) => f.puntos));
  const ganadorEnc = ultima?.resultados.filter((r) => r.lugarEncuestas === 1).map((r) => r.nombre) || [];

  const fila = (f: FilaRanking, lugar: number | null, ancho: number, derecha: React.ReactNode, debajo?: React.ReactNode, apagada = false) => (
    <button
      type="button"
      key={f.meseroId}
      className={`ranking-fila ${f.meseroId === miMeseroId ? "yo" : ""} ${apagada ? "apagada" : ""}`}
      onClick={() => setViendo(f)}
    >
      <span className={`ranking-lugar ${lugar && lugar <= 3 ? "podio" : ""}`}>{lugar ?? "—"}</span>
      <Avatar nombre={f.empleado?.nombre || f.nombre} foto={f.empleado?.foto} tamano={36} />
      <div className="ranking-nombre">
        <strong>
          {f.nombre}
          {f.meseroId === miMeseroId && <em className="etiqueta-tu">Tú</em>}
        </strong>
        {debajo}
        {ancho > 0 && (
          <div className="ranking-barra">
            <i style={{ width: `${Math.max(3, ancho)}%` }} />
          </div>
        )}
      </div>
      <span className="ranking-puntos">{derecha}</span>
      <ChevronRight size={16} className="ranking-ver" />
    </button>
  );

  // Secundarios.
  const porTurno = [...ranking.filas].sort((a, b) => b.ventaPorTurno - a.ventaPorTurno);
  const maxTurno = Math.max(1, ...porTurno.map((f) => f.ventaPorTurno));
  const menosCancel = [...ranking.filas].sort((a, b) => a.pctCancelacion - b.pctCancelacion || b.venta - a.venta);
  const masEnc = ranking.filas.filter((f) => (f.encuestas?.contestadas || 0) > 0).sort((a, b) => (b.encuestas?.contestadas || 0) - (a.encuestas?.contestadas || 0));
  const mejorCalif = ranking.filas
    .filter((f) => (f.encuestas?.contestadas || 0) >= MINIMO_ENCUESTAS && f.encuestas?.promedio !== null)
    .sort((a, b) => (b.encuestas?.promedio || 0) - (a.encuestas?.promedio || 0) || (b.encuestas?.contestadas || 0) - (a.encuestas?.contestadas || 0));
  const lugarDe = <T,>(xs: T[], i: number, igual: (a: T, b: T) => boolean) => {
    let l = i + 1;
    while (l > 1 && igual(xs[l - 2], xs[i])) l--;
    return l;
  };
  const sub = (titulo: string, nota: string | null, xs: FilaRanking[], valor: (f: FilaRanking) => React.ReactNode, igual: (a: FilaRanking, b: FilaRanking) => boolean, vacio: string) => (
    <div className="ranking-sub">
      <h5>
        <span>{titulo}</span>
        {nota && <small>{nota}</small>}
      </h5>
      {xs.length === 0 ? (
        <span className="hint">{vacio}</span>
      ) : (
        xs.map((f, i) => (
          <button type="button" key={f.meseroId} className={`ranking-sub-fila ${f.meseroId === miMeseroId ? "yo" : ""}`} onClick={() => setViendo(f)}>
            <b>{lugarDe(xs, i, igual)}</b>
            <span>{f.nombre}</span>
            <span className="ranking-sub-valor">{valor(f)}</span>
          </button>
        ))
      )}
    </div>
  );

  return (
    <div className="page-section">
      <TituloPagina titulo="Ranking" onBack={onBack} backLabel={backLabel} />
      {ultima?.ganador_nombre && (
        <div className="ranking-ganador">
          <span>🏆</span>
          <div>
            <strong>
              {ultima.resultados.filter((r) => r.lugar === 1).length > 1 ? "Ganadores" : "Ganó"} la semana del {nombreSemana(ultima.lunes)}: {ultima.ganador_nombre}
            </strong>
            {ganadorEnc.length > 0 && <small className="ranking-ganador-enc">⭐ En encuestas: {ganadorEnc.join(" y ")}</small>}
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
            Tus puntos {nombrePeriodo}: {yo.puntos}
          </strong>
          <div>
            <span>
              Venta por turno ({yo.turnos} {yo.turnos === 1 ? "turno" : "turnos"}
              {yo.dobles ? `, ${yo.dobles} ${yo.dobles === 1 ? "doble" : "dobles"}` : ""})
            </span>
            <b>+{yo.puntosVenta}</b>
          </div>
          <div>
            <span>Cancelaciones ({yo.pctCancelacion.toLocaleString("es-MX")}% de tu venta)</span>
            <b className={yo.puntosCancelacion > 0 ? "resta" : ""}>−{yo.puntosCancelacion}</b>
          </div>
          <div>
            <span>
              {yo.encuestas?.contestadas || 0} {yo.encuestas?.contestadas === 1 ? "encuesta contestada" : "encuestas contestadas"} × {PUNTOS_POR_ENCUESTA}
            </span>
            <b>+{(yo.encuestas?.contestadas || 0) * PUNTOS_POR_ENCUESTA}</b>
          </div>
          <div>
            <span>Calificación de tus encuestas</span>
            <b className={yo.puntosCalificacion < 0 ? "resta" : ""}>
              {yo.puntosCalificacion >= 0 ? "+" : "−"}
              {Math.abs(yo.puntosCalificacion)}
            </b>
          </div>
          {!!yo.encuestas?.pendientes && (
            <small>
              {yo.encuestas.pendientes} {yo.encuestas.pendientes === 1 ? "encuesta más suma" : "encuestas más suman"} en cuanto se haga tu corte.
            </small>
          )}
          {yo.turnos < MINIMO_TURNOS_GANAR && <small>Llevas 1 turno: con {MINIMO_TURNOS_GANAR} ya puedes ganar la semana.</small>}
        </div>
      )}

      <h4 className="ranking-titulo">🏆 Ranking general</h4>
      <small className="ranking-titulo-sub">Venta por turno · cancelaciones · encuestas</small>
      {ranking.filas.length === 0 ? (
        <Empty icon={<Trophy size={26} strokeWidth={1.3} />} text={`Todavía nadie tiene venta ${nombrePeriodo}.`} />
      ) : (
        <div className="ranking-lista">
          {ranking.filas.map((f) =>
            fila(f, f.lugar, (f.puntos / maxPuntos) * 100, f.puntos, f.turnos < MINIMO_TURNOS_GANAR ? <small className="ranking-etiqueta">1 turno</small> : undefined)
          )}
        </div>
      )}

      <h4 className="ranking-titulo">⭐ Ranking de encuestas</h4>
      {deEncuestas.length === 0 ? (
        <p className="hint">Todavía nadie tiene venta {nombrePeriodo}.</p>
      ) : (
        <div className="ranking-lista">
          {deEncuestas.map((f) =>
            f.lugarEncuestas
              ? fila(
                  f,
                  f.lugarEncuestas,
                  0,
                  f.puntosEncuestas,
                  <span className="ranking-estrellas-fila">
                    <Estrellas valor={f.encuestas?.promedio || 0} chica /> {uno(f.encuestas?.promedio || 0)} · {f.encuestas?.contestadas}
                  </span>
                )
              : fila(
                  f,
                  null,
                  0,
                  0,
                  <small className="ranking-sin">
                    {f.encuestas?.pendientes
                      ? `${f.encuestas.pendientes} ${f.encuestas.pendientes === 1 ? "contestada espera" : "contestadas esperan"} su corte`
                      : (f.encuestas?.generadas || 0) > 0
                        ? "Ninguna contestada todavía"
                        : "No ha generado encuestas"}
                  </small>,
                  true
                )
          )}
        </div>
      )}

      <button type="button" className="ranking-mas" onClick={() => setMasAbierto(!masAbierto)}>
        <span>{masAbierto ? "Ocultar más rankings" : "Ver más rankings"}</span>
        <span>{masAbierto ? "▴" : "▾"}</span>
      </button>
      {masAbierto && (
        <div className="ranking-secundarios">
          {sub(
            "💰 Venta por turno",
            modo === "dueno" ? null : "sin montos",
            porTurno,
            (f) =>
              modo === "dueno" ? (
                `${money(f.ventaPorTurno)} · ${f.turnos} ${f.turnos === 1 ? "turno" : "turnos"}`
              ) : (
                <span className="ranking-barra ranking-sub-barra">
                  <i style={{ width: `${Math.max(3, (f.ventaPorTurno / maxTurno) * 100)}%` }} />
                </span>
              ),
            (a, b) => a.ventaPorTurno === b.ventaPorTurno,
            "Sin venta."
          )}
          {sub(
            "🧼 Menos cancelaciones",
            null,
            menosCancel,
            (f) => `${f.pctCancelacion.toLocaleString("es-MX")}%${modo === "dueno" ? ` · ${money(f.cancelaciones)}` : ""}`,
            (a, b) => a.pctCancelacion === b.pctCancelacion,
            "Sin venta."
          )}
          {sub(
            "📝 Más encuestas contestadas",
            null,
            masEnc,
            (f) => f.encuestas?.contestadas || 0,
            (a, b) => a.encuestas?.contestadas === b.encuestas?.contestadas,
            "Nadie tiene encuestas contestadas todavía."
          )}
          {sub(
            "🌟 Mejor calificación",
            `mín. ${MINIMO_ENCUESTAS}`,
            mejorCalif,
            (f) => (
              <span className="ranking-estrellas-fila">
                <Estrellas valor={f.encuestas?.promedio || 0} chica /> {uno(f.encuestas?.promedio || 0)}
              </span>
            ),
            (a, b) => a.encuestas?.promedio === b.encuestas?.promedio,
            `Nadie tiene ${MINIMO_ENCUESTAS} encuestas contestadas todavía.`
          )}
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
      <div className="ranking-como">
        <h4>¿Cómo se calcula?</h4>
        <p>
          <b>Venta por turno:</b> hasta 100 puntos (100 = quien más vende por turno {nombrePeriodo}). Un día con corte es 1 turno; si en el horario
          dobla (Z) y es mesero, son 2. <b>Cancelaciones:</b> −10 por cada 1% de su venta. <b>Encuestas contestadas:</b> +{PUNTOS_POR_ENCUESTA} cada una,
          sin importar la calificación, y según sus estrellas 5⭐ +2 · 4⭐ +1 · 3⭐ 0 · 2⭐ −2 · 1⭐ −4; las de un día suman cuando ya se hizo su corte. Se aparece desde el primer turno; para
          ganar la semana y sus monedas hacen falta {MINIMO_TURNOS_GANAR}. El ranking de encuestas usa solo los puntos de encuestas (con puntos positivos gana monedas: 1º 50 ·
          2º 30 · 3º 20).{periodo === "semana" ? " La semana va de lunes a domingo." : ""}
        </p>
      </div>
    </div>
  );
}

// Tarjeta del inicio del personal de Piso: su lugar de la semana.
export function RankingTarjeta({ data, miMeseroId, onVer }: { data: AppData; miMeseroId?: string; onVer: () => void }) {
  const { desde, hasta } = rangoRanking("semana");
  const [encuestas, setEncuestas] = useState<Map<string, EncuestasMesero>>(new Map());
  const tick = useTickRecargar();
  useEffect(() => {
    let vivo = true;
    encuestasParaRanking(desde, hasta).then((m) => vivo && setEncuestas(m));
    return () => {
      vivo = false;
    };
  }, [desde, hasta, tick]);
  const ranking = calcularRanking(data, desde, hasta, encuestas);
  const yo = ranking.filas.find((f) => f.meseroId === miMeseroId);
  const arriba = yo ? ranking.filas.filter((f) => f.puntos > yo.puntos).pop() : undefined;
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
          {ranking.filas.length ? `Van ${ranking.filas.length} meseros en el ranking.` : "Todavía nadie entra al ranking esta semana."}
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
          Solo tú: {money(fila.ventaPorTurno)}/turno · {fila.turnos} {fila.turnos === 1 ? "turno" : "turnos"} · cancelaciones {money(fila.cancelaciones)} (
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
function Estrellas({ valor, chica = false }: { valor: number; chica?: boolean }) {
  const ancho = (Math.round(valor * 2) / 2 / 5) * 100;
  return (
    <b className={`estrellas-calif ${chica ? "chica" : ""}`} aria-label={`${valor} de 5 estrellas`}>
      <span>★★★★★</span>
      <span className="llenas" style={{ width: `${ancho}%` }}>
        ★★★★★
      </span>
    </b>
  );
}
