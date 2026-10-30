import { useEffect, useState } from "react";
import { useTickRecargar } from "./JalarParaActualizar";
import {
  LOGROS,
  TOTAL_LOGROS,
  cargarLogros,
  cargarMovimientos,
  cargarSemanas,
  emojiLogro,
  nombreLogro,
  nombreSemana,
  progresoLogro,
  type LogroGanado,
  type Movimiento,
  type SemanaCerrada,
} from "../lib/puntos";

// En Mi perfil (quien juega en el ranking): sus Monedas Anubis, de dónde
// salieron y sus logros — los ganados y los que siguen, con cuánto lleva.
const VISIBLES = 6;

export function MisPuntos({ meseroId }: { meseroId: string }) {
  const [datos, setDatos] = useState<{ movimientos: Movimiento[]; logros: LogroGanado[]; semanas: SemanaCerrada[] } | null | "error">(null);
  const [todo, setTodo] = useState(false);

  const tick = useTickRecargar();
  useEffect(() => {
    let vivo = true;
    Promise.all([cargarMovimientos(meseroId), cargarLogros(), cargarSemanas(20)]).then(([movimientos, logros, semanas]) => {
      if (!vivo) return;
      if (!movimientos) return setDatos("error");
      setDatos({ movimientos, logros: logros.filter((l) => l.mesero_id === meseroId), semanas: semanas || [] });
    });
    return () => {
      vivo = false;
    };
  }, [meseroId, tick]);

  if (datos === null) return <p className="hint">Cargando tus monedas…</p>;
  if (datos === "error") return <p className="aviso-faltante">No se pudieron leer tus monedas. Revisa tu conexión.</p>;

  const total = datos.movimientos.reduce((s, m) => s + m.puntos, 0);
  const ultimaSemana = datos.movimientos.map((m) => m.lunes).filter((l): l is string => !!l).sort().pop();
  const ganadaUltima = ultimaSemana ? datos.movimientos.filter((m) => m.lunes === ultimaSemana).reduce((s, m) => s + m.puntos, 0) : 0;
  const ganados = datos.logros.length;

  return (
    <>
      <div className="puntos-total monedas">
        <small>🪙 Mis monedas Anubis</small>
        <b>{total.toLocaleString("es-MX")}</b>
        <span>
          {ultimaSemana ? `+${ganadaUltima.toLocaleString("es-MX")} la semana del ${nombreSemana(ultimaSemana)} · ` : ""}se podrán canjear más
          adelante
        </span>
      </div>

      <div className="puntos-seccion">
        <h4>Historial</h4>
        {datos.movimientos.length === 0 ? (
          <p className="hint">Todavía no tienes monedas. Se suman al cerrar cada semana (al guardar el corte del domingo).</p>
        ) : (
          <>
            {(todo ? datos.movimientos : datos.movimientos.slice(0, VISIBLES)).map((m, i) => (
              <div key={m.id ?? i} className="puntos-mov">
                <span>{m.motivo}</span>
                <b className={m.puntos < 0 ? "neg" : ""}>
                  {m.puntos > 0 ? "+" : ""}
                  {m.puntos.toLocaleString("es-MX")} 🪙
                </b>
              </div>
            ))}
            {datos.movimientos.length > VISIBLES && (
              <button type="button" className="link-btn" onClick={() => setTodo((t) => !t)}>
                {todo ? "Ver menos" : `Ver todo (${datos.movimientos.length})`}
              </button>
            )}
          </>
        )}
      </div>

      <div className="puntos-seccion">
        <h4>
          Mis logros · {ganados} de {TOTAL_LOGROS}
        </h4>
        <div className="logros-grid">
          {LOGROS.flatMap((def) => {
            const llevo = progresoLogro(def, meseroId, datos.semanas);
            return def.niveles.map((nivel) => {
              const ganado = datos.logros.some((l) => l.logro === def.id && l.nivel === nivel.n);
              return (
                <div key={`${def.id}-${nivel.n}`} className={`logro ${ganado ? "" : "pendiente"}`}>
                  <b>
                    {emojiLogro(def, nivel.n)} {nombreLogro(def, nivel.n)}
                  </b>
                  <span>
                    {def.descripcion(nivel.n)}
                    {!ganado && def.id !== "primer-lugar" && llevo > 0 ? ` · llevas ${Math.min(llevo, nivel.n)}` : ""}
                  </span>
                  <small>+{nivel.puntos} 🪙</small>
                </div>
              );
            });
          })}
        </div>
        <p className="hint">Los logros sin color son los que siguen. Al ganarlos se suman sus monedas. Tus monedas solo las ves tú.</p>
      </div>
    </>
  );
}
