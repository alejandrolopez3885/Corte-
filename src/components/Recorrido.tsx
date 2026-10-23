import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { AppData, Profile } from "../lib/types";

// Bienvenida, recorrido guiado y opinión del acceso de invitado (y de la
// prueba del dueño). Cada paso abre la pantalla real, ilumina la sección y
// explica qué es y qué gana el negocio.

export interface PasoRecorrido {
  titulo: string;
  texto: string;
  valor: string;
  ir: () => void;
  buscar: () => Element | null;
}

// El primer elemento visible que coincide (y que contiene el texto, si se da).
export function buscarEn(selector: string, texto?: string): Element | null {
  const todos = [...document.querySelectorAll(selector)].filter((el) => el.getClientRects().length > 0);
  return (texto ? todos.find((el) => (el.textContent || "").toLowerCase().includes(texto.toLowerCase())) : todos[0]) || null;
}

export const GUSTOS = ["Encuestas", "Corte y efectivo", "Reportes al momento", "Nómina automática", "Pregúntale a Cortes", "Ranking", "Tendencias", "Inventario"];

export function Bienvenida({ data, onEmpezar, onExplorar }: { data: AppData; onEmpezar: () => void; onExplorar: () => void }) {
  const [encuestas, setEncuestas] = useState<number | null>(null);
  useEffect(() => {
    supabase
      .from("encuesta_respuestas")
      .select("encuesta_id", { count: "exact", head: true })
      .then(({ count }) => setEncuestas(count ?? 0));
  }, []);
  let cortes = 0;
  let semanas = 0;
  Object.values(data.months).forEach((m) =>
    m.weeks.forEach((w) => {
      const dias = Object.values(w?.days || {}).filter((d) => d.meseros.length > 0).length;
      cortes += dias;
      if (dias > 0) semanas += 1;
    })
  );
  return (
    <div className="recorrido-fondo recorrido-ui">
      <div className="bienvenida">
        <img src="/favicon.svg" alt="" />
        <h2>Bienvenido a Cortes · Johnster</h2>
        <p>Toda la operación del restaurante en una app: de la venta de cada mesero a la utilidad de la semana, en tiempo real.</p>
        <div className="bienvenida-datos">
          <div>
            <b>{cortes.toLocaleString("es-MX")}</b>cortes capturados
          </div>
          <div>
            <b>{data.empleados.length}</b>personas en el equipo
          </div>
          <div>
            <b>{semanas}</b>semanas de historial
          </div>
          <div>
            <b>{encuestas ?? "…"}</b>encuestas de clientes
          </div>
        </div>
        <p className="bienvenida-nota">
          Estás en modo <b>solo lectura</b>: ves todo con números reales; los botones están, pero no cambian nada.
        </p>
        <button type="button" className="bienvenida-empezar" onClick={onEmpezar}>
          Empezar recorrido (3 min)
        </button>
        <button type="button" className="bienvenida-explorar" onClick={onExplorar}>
          Explorar por mi cuenta
        </button>
      </div>
    </div>
  );
}

export function Recorrido({ pasos, onFin, onSalir }: { pasos: PasoRecorrido[]; onFin: () => void; onSalir: () => void }) {
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState<DOMRect | null>(null);
  const paso = pasos[i];

  useEffect(() => {
    paso.ir();
    setCaja(null);
    let el: Element | null = null;
    const medir = () => setCaja(el ? el.getBoundingClientRect() : null);
    const t = setTimeout(() => {
      el = paso.buscar();
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(medir, 450);
    }, 350);
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [paso]);

  // La tarjeta va abajo, o arriba si lo iluminado queda en la mitad de abajo.
  const arriba = !!caja && caja.top > window.innerHeight * 0.5;

  return (
    <div className="recorrido recorrido-ui">
      {caja ? (
        <div className="recorrido-luz" style={{ top: caja.top - 6, left: caja.left - 6, width: caja.width + 12, height: caja.height + 12 }} />
      ) : (
        <div className="recorrido-velo" />
      )}
      <div className={`recorrido-tarjeta ${arriba ? "arriba" : ""}`}>
        <h4>{paso.titulo}</h4>
        <p>{paso.texto}</p>
        <span className="recorrido-valor">Para el negocio: {paso.valor}</span>
        <div className="recorrido-pie">
          <span className="recorrido-puntos">
            {pasos.map((_, n) => (
              <i key={n} className={n <= i ? "hecho" : ""} />
            ))}
          </span>
          <button type="button" className="recorrido-saltar" onClick={onSalir}>
            Saltar
          </button>
          {i > 0 && (
            <button type="button" className="recorrido-atras" onClick={() => setI(i - 1)}>
              ‹
            </button>
          )}
          <button type="button" className="recorrido-siguiente" onClick={() => (i + 1 < pasos.length ? setI(i + 1) : onFin())}>
            {i + 1 < pasos.length ? "Siguiente ›" : "Terminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Al terminar: calificación, lo que más le gustó, otras sucursales y mejoras.
export function OpinionInvitado({ profile, prueba, onCerrar }: { profile: Profile; prueba: boolean; onCerrar: () => void }) {
  const [estrellas, setEstrellas] = useState(0);
  const [gusto, setGusto] = useState<string[]>([]);
  const [sucursales, setSucursales] = useState<"si" | "tal vez" | "no" | null>(null);
  const [mejoras, setMejoras] = useState("");
  const [estado, setEstado] = useState<"llenando" | "enviando" | "enviada" | "error">("llenando");
  const [falta, setFalta] = useState(false);

  async function enviar() {
    if (!estrellas) return setFalta(true);
    if (prueba) return setEstado("enviada");
    setEstado("enviando");
    const { error } = await supabase.from("invitado_opiniones").insert({
      owner_id: profile.owner_id,
      profile_id: profile.id,
      nombre: (profile.display_name || "Invitado").slice(0, 80),
      estrellas,
      gusto,
      sucursales,
      mejoras: mejoras.trim().slice(0, 1000) || null,
    });
    if (error) console.error("No se pudo guardar la opinión", error);
    setEstado(error ? "error" : "enviada");
  }

  return (
    <div className="recorrido-fondo recorrido-ui">
      <div className="opinion">
        {estado === "enviada" ? (
          <>
            <h2>¡Gracias por tu opinión!</h2>
            <p className="hint">{prueba ? "Es la prueba: no se guardó. Así la verá tu invitado." : "Nos ayuda a mejorar Cortes."}</p>
            <button type="button" className="bienvenida-empezar" onClick={onCerrar}>
              Explorar por mi cuenta
            </button>
          </>
        ) : (
          <>
            <h2>¡Terminaste el recorrido! ¿Qué te pareció?</h2>
            <div className="opinion-estrellas" role="radiogroup" aria-label="Calificación">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={n <= estrellas ? "llena" : ""} onClick={() => setEstrellas(n)} aria-label={`${n} de 5`}>
                  ★
                </button>
              ))}
            </div>
            <span className="opinion-pregunta">¿Qué fue lo que más te gustó? (elige las que quieras)</span>
            <div className="opinion-chips">
              {GUSTOS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={gusto.includes(g) ? "on" : ""}
                  onClick={() => setGusto(gusto.includes(g) ? gusto.filter((x) => x !== g) : [...gusto, g])}
                >
                  {g}
                </button>
              ))}
            </div>
            <span className="opinion-pregunta">¿La usarías en otras sucursales?</span>
            <div className="opinion-sucursales">
              {(
                [
                  ["si", "Sí"],
                  ["tal vez", "Tal vez"],
                  ["no", "No"],
                ] as const
              ).map(([v, t]) => (
                <button key={v} type="button" className={sucursales === v ? "on" : ""} onClick={() => setSucursales(v)}>
                  {t}
                </button>
              ))}
            </div>
            <span className="opinion-pregunta">¿Qué le mejorarías o qué te gustaría que tuviera?</span>
            <textarea className="text-input" rows={3} maxLength={1000} value={mejoras} onChange={(e) => setMejoras(e.target.value)} />
            {falta && !estrellas && <p className="aviso-faltante">Elige una calificación de 1 a 5 estrellas.</p>}
            {estado === "error" && <p className="aviso-faltante">No se pudo enviar. Revisa tu conexión e intenta de nuevo.</p>}
            <button type="button" className="bienvenida-empezar" disabled={estado === "enviando"} onClick={enviar}>
              {estado === "enviando" ? "Enviando…" : "Enviar mi opinión"}
            </button>
            <button type="button" className="bienvenida-explorar" onClick={onCerrar}>
              Ahora no
            </button>
            <p className="hint opinion-centro">También puedes dejarla después en "Ver recorrido".</p>
          </>
        )}
      </div>
    </div>
  );
}
