import { useCallback, useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Empty, Field } from "../ui";
import { TituloPagina } from "../BarraTitulo";
import { addDaysIso, mondayOnOrBefore, todayIso } from "../../lib/dataModel";
import {
  LOGROS,
  ajustarPuntos,
  cargarLogros,
  cargarMovimientos,
  cargarSemanas,
  cerrarSemana,
  emojiLogro,
  nombreLogro,
  nombreSemana,
  type LogroGanado,
  type Movimiento,
  type SemanaCerrada,
} from "../../lib/puntos";
import type { AppData } from "../../lib/types";

// Monedas Anubis y logros (solo dueño): la semana pasada (se cierra sola al
// guardar el corte del domingo; aquí se puede cerrar o recalcular), los
// monedas de cada quien con su historial y logros, y ajustes a mano.
export function PuntosPanel({ data, ownerId, onBack }: { data: AppData; ownerId: string; onBack?: () => void }) {
  const [datos, setDatos] = useState<{ semanas: SemanaCerrada[]; movimientos: Movimiento[]; logros: LogroGanado[] } | null | "error">(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [persona, setPersona] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState({ meseroId: "", puntos: "", motivo: "" });

  const cargar = useCallback(() => {
    Promise.all([cargarSemanas(12), cargarMovimientos(), cargarLogros()]).then(([semanas, movimientos, logros]) =>
      setDatos(semanas && movimientos ? { semanas, movimientos, logros } : "error")
    );
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cerrar(lunes: string) {
    setOcupado(lunes);
    setAviso(null);
    const r = await cerrarSemana(data, lunes);
    setOcupado(null);
    setAviso(r.ok ? `Semana del ${nombreSemana(lunes)} cerrada${r.ganador ? ` · ganó ${r.ganador}` : ""}.` : r.error);
    cargar();
  }

  async function guardarAjuste() {
    const puntos = Math.round(Number(ajuste.puntos));
    const nombre = nombres.get(ajuste.meseroId);
    if (!ajuste.meseroId || !nombre) return setAviso("Elige a la persona.");
    if (!puntos) return setAviso("Escribe las monedas (con − para quitar).");
    if (!ajuste.motivo.trim()) return setAviso("Escribe el motivo.");
    setOcupado("ajuste");
    const ok = await ajustarPuntos(ownerId, ajuste.meseroId, nombre, puntos, ajuste.motivo.trim());
    setOcupado(null);
    setAviso(ok ? `Ajuste guardado: ${puntos > 0 ? "+" : ""}${puntos} 🪙 a ${nombre}.` : "No se pudo guardar el ajuste. Revisa tu conexión.");
    if (ok) setAjuste({ meseroId: "", puntos: "", motivo: "" });
    cargar();
  }

  const lunesPasado = addDaysIso(mondayOnOrBefore(todayIso()), -7);
  const semanas = datos && datos !== "error" ? datos.semanas : [];
  const movimientos = datos && datos !== "error" ? datos.movimientos : [];
  const logros = datos && datos !== "error" ? datos.logros : [];
  const pasadaCerrada = semanas.find((s) => s.lunes === lunesPasado);

  // Personas: quienes tienen monedas y los meseros del corte.
  const nombres = new Map<string, string>();
  data.meseros.filter((m) => !m.acumulado).forEach((m) => nombres.set(m.id, m.nombre));
  movimientos.forEach((m) => nombres.set(m.mesero_id, nombres.get(m.mesero_id) || m.nombre));
  const totales = [...new Set(movimientos.map((m) => m.mesero_id))]
    .map((id) => {
      const suyos = movimientos.filter((m) => m.mesero_id === id);
      const ultimaLunes = semanas[0]?.lunes;
      return {
        id,
        nombre: nombres.get(id) || suyos[0].nombre,
        total: suyos.reduce((s, m) => s + m.puntos, 0),
        semana: ultimaLunes ? suyos.filter((m) => m.lunes === ultimaLunes).reduce((s, m) => s + m.puntos, 0) : 0,
        logros: logros.filter((l) => l.mesero_id === id),
      };
    })
    .sort((a, b) => b.total - a.total);
  const elegido = totales.find((t) => t.id === persona);

  return (
    <div className="page-section">
      <TituloPagina titulo="Monedas y logros" onBack={onBack} backLabel="Equipo" />
      {datos === null && <p className="hint">Cargando…</p>}
      {datos === "error" && <p className="aviso-faltante">No se pudieron leer las monedas. Revisa tu conexión.</p>}
      {aviso && <p className="puntos-aviso">{aviso}</p>}

      {datos && datos !== "error" && (
        <>
          <div className="puntos-seccion">
            <h4>Semana del {nombreSemana(lunesPasado)}</h4>
            {pasadaCerrada ? (
              <span className="hint">
                Cerrada{pasadaCerrada.ganador_nombre ? ` · ganó ${pasadaCerrada.ganador_nombre} 🏆` : ""}. Si corregiste algún corte de esa semana,
                recalcúlala.
              </span>
            ) : (
              <span className="hint">Todavía no se cierra. Se cierra sola al guardar el corte del domingo, o ciérrala aquí.</span>
            )}
            <button type="button" className={pasadaCerrada ? "btn-secundario" : "btn-primary"} disabled={!!ocupado} onClick={() => cerrar(lunesPasado)}>
              {ocupado === lunesPasado ? "Calculando…" : pasadaCerrada ? "Recalcular semana" : "Cerrar semana"}
            </button>
          </div>

          <div className="puntos-seccion">
            <h4>Monedas de cada quien</h4>
            {totales.length === 0 ? (
              <Empty icon={<Trophy size={26} strokeWidth={1.3} />} text="Todavía nadie tiene monedas. Se suman al cerrar la primera semana." />
            ) : (
              <div className="puntos-tabla">
                <span className="izq">Persona</span>
                <span>{semanas[0] ? `Sem. ${nombreSemana(semanas[0].lunes)}` : "Semana"}</span>
                <span>Total</span>
                {totales.map((t) => (
                  <button key={t.id} type="button" className={`puntos-fila ${t.id === persona ? "activo" : ""}`} onClick={() => setPersona(t.id === persona ? null : t.id)}>
                    <b>
                      {semanas[0]?.resultados.some((r) => r.meseroId === t.id && r.lugar === 1) ? "🏆 " : ""}
                      {t.nombre}
                    </b>
                    <span>{t.semana ? `+${t.semana.toLocaleString("es-MX")} 🪙` : "—"}</span>
                    <span>{t.total.toLocaleString("es-MX")}</span>
                  </button>
                ))}
              </div>
            )}
            {totales.length > 0 && <p className="hint">Toca a alguien para ver su historial y sus logros.</p>}
          </div>

          {elegido && (
            <div className="puntos-seccion">
              <h4>
                {elegido.nombre} · {elegido.total.toLocaleString("es-MX")} 🪙
              </h4>
              <span className="hint">
                Logros:{" "}
                {elegido.logros.length
                  ? LOGROS.flatMap((def) =>
                      elegido.logros.filter((l) => l.logro === def.id).map((l) => `${emojiLogro(def, l.nivel)} ${nombreLogro(def, l.nivel)}`)
                    ).join(" · ")
                  : "todavía ninguno"}
              </span>
              {movimientos
                .filter((m) => m.mesero_id === elegido.id)
                .map((m, i) => (
                  <div key={m.id ?? i} className="puntos-mov">
                    <span>{m.motivo}</span>
                    <b className={m.puntos < 0 ? "neg" : ""}>
                      {m.puntos > 0 ? "+" : ""}
                      {m.puntos.toLocaleString("es-MX")} 🪙
                    </b>
                  </div>
                ))}
            </div>
          )}

          <div className="puntos-seccion">
            <h4>Ajustar monedas</h4>
            <Field label="Persona">
              <select className="text-input" value={ajuste.meseroId} onChange={(e) => setAjuste({ ...ajuste, meseroId: e.target.value })}>
                <option value="">Elige…</option>
                {[...nombres.entries()]
                  .sort((a, b) => a[1].localeCompare(b[1]))
                  .map(([id, n]) => (
                    <option key={id} value={id}>
                      {n}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Monedas (con − para quitar)">
              <input
                className="text-input"
                inputMode="numeric"
                value={ajuste.puntos}
                placeholder="Ej. 50 o -20"
                onChange={(e) => setAjuste({ ...ajuste, puntos: e.target.value.replace(/[^\d-]/g, "") })}
              />
            </Field>
            <Field label="Motivo">
              <input
                className="text-input"
                maxLength={120}
                value={ajuste.motivo}
                placeholder="Ej. cubrió un turno extra"
                onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })}
              />
            </Field>
            <button type="button" className="btn-primary" disabled={!!ocupado} onClick={guardarAjuste}>
              {ocupado === "ajuste" ? "Guardando…" : "Guardar ajuste"}
            </button>
          </div>

          {semanas.length > 0 && (
            <div className="puntos-seccion">
              <h4>Semanas cerradas</h4>
              {semanas.map((s) => (
                <div key={s.lunes} className="puntos-mov">
                  <span>
                    Sem. {nombreSemana(s.lunes)}
                    {s.ganador_nombre ? ` · 🏆 ${s.ganador_nombre}` : ""}
                  </span>
                  <button type="button" className="link-btn" disabled={!!ocupado} onClick={() => cerrar(s.lunes)}>
                    {ocupado === s.lunes ? "Calculando…" : "Recalcular"}
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="hint">
            Monedas Anubis por semana: 1º 100 · 2º 70 · 3º 50 · los demás del ranking 20 · sin cancelaciones +30 · cada encuesta válida +5 ·
            promedio de 4.5⭐ o más (con 3 o más) +30. Los logros dan monedas extra la primera vez. Cada quien ve solo sus monedas; los logros y el ganador los ve
            todo el equipo.
          </p>
        </>
      )}
    </div>
  );
}
