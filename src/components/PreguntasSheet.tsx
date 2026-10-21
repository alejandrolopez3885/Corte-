import { useEffect, useRef, useState } from "react";
import { ArrowRight, Mic, Send } from "lucide-react";
import { Sheet } from "./ui";
import { supabase } from "../lib/supabaseClient";
import { addDaysIso, mondayOnOrBefore, todayIso } from "../lib/dataModel";
import {
  PREGUNTAS,
  PREGUNTAS_INICIALES,
  consultaDePregunta,
  entenderPregunta,
  preguntaDeConsulta,
  responder,
  type Consulta,
  type GrupoPregunta,
  type PreguntaId,
  type Respuesta,
} from "../lib/preguntas";
import { DAYS, DAY_SHORT } from "../lib/types";
import type { AppData } from "../lib/types";

// Pregúntale a Cortes (solo dueño): escribir, dictar o tocar una pregunta.
// Cuántas veces se usa cada una se guarda en la cuenta del dueño
// (user_metadata.preguntasUso) para subir las más usadas al inicio.

type Uso = Partial<Record<PreguntaId, number>>;

// Dictado del navegador (Web Speech API): gratis, pero no existe en todos
// los celulares — sin él se oculta el micrófono.
interface Reconocimiento {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type ConstructorReconocimiento = new () => Reconocimiento;
const Reconocedor: ConstructorReconocimiento | undefined =
  typeof window !== "undefined"
    ? ((window as unknown as Record<string, ConstructorReconocimiento | undefined>).SpeechRecognition ||
      (window as unknown as Record<string, ConstructorReconocimiento | undefined>).webkitSpeechRecognition)
    : undefined;

const GRUPOS: GrupoPregunta[] = ["Ventas", "Estadística", "Dinero", "Nómina", "Propinas"];

export function PreguntasSheet({
  data,
  onClose,
  onIr,
}: {
  data: AppData;
  onClose: () => void;
  onIr: (destino: NonNullable<Respuesta["enlace"]>["destino"]) => void;
}) {
  const hoy = todayIso();
  const [texto, setTexto] = useState("");
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [noEntendi, setNoEntendi] = useState<string | null>(null);
  const [uso, setUso] = useState<Uso>({});
  const [escuchando, setEscuchando] = useState(false);
  const reconocimiento = useRef<Reconocimiento | null>(null);
  const usoRef = useRef<Uso>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data: u }) => {
      const guardado = (u.user?.user_metadata?.preguntasUso || {}) as Uso;
      usoRef.current = guardado;
      setUso(guardado);
    });
    return () => reconocimiento.current?.stop();
  }, []);

  function contar(id: PreguntaId) {
    const nuevo = { ...usoRef.current, [id]: (usoRef.current[id] || 0) + 1 };
    // El orden de arriba se queda como estaba al abrir, para que los botones
    // no cambien de lugar mientras se usan.
    usoRef.current = nuevo;
    supabase.auth.updateUser({ data: { preguntasUso: nuevo } }).then(({ error }) => {
      if (error) console.error("No se pudo guardar el uso de las preguntas", error);
    });
  }

  function mostrar(c: Consulta) {
    setNoEntendi(null);
    setRespuesta(responder(data, c, hoy));
  }

  function tocar(id: PreguntaId) {
    setTexto("");
    contar(id);
    mostrar(consultaDePregunta(id, hoy));
  }

  function preguntar(t: string) {
    const limpio = t.trim();
    if (!limpio) return;
    const c = entenderPregunta(limpio, hoy, data);
    if (!c) {
      setRespuesta(null);
      setNoEntendi(limpio);
      return;
    }
    contar(preguntaDeConsulta(c, hoy));
    mostrar(c);
  }

  function dictar() {
    if (!Reconocedor) return;
    if (escuchando) {
      reconocimiento.current?.stop();
      return;
    }
    const r = new Reconocedor();
    r.lang = "es-MX";
    r.interimResults = true;
    r.continuous = false;
    let ultimo = "";
    r.onresult = (e) => {
      ultimo = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(" ");
      setTexto(ultimo);
    };
    r.onend = () => {
      setEscuchando(false);
      reconocimiento.current = null;
      if (ultimo) preguntar(ultimo);
    };
    r.onerror = () => setEscuchando(false);
    reconocimiento.current = r;
    setEscuchando(true);
    setRespuesta(null);
    setNoEntendi(null);
    setTexto("");
    r.start();
  }

  const usadas = (Object.entries(uso) as [PreguntaId, number][])
    .filter(([id, n]) => n > 0 && PREGUNTAS.some((p) => p.id === id))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  const top = [...usadas, ...PREGUNTAS_INICIALES.filter((id) => !usadas.includes(id))].slice(0, 3);
  const chip = (id: PreguntaId, destacada = false) => (
    <button key={id} type="button" className={`pregunta-chip ${destacada ? "destacada" : ""}`} onClick={() => tocar(id)}>
      {PREGUNTAS.find((p) => p.id === id)?.texto}
    </button>
  );

  return (
    <Sheet title="Pregúntale a Cortes" onClose={onClose}>
      <form
        className="pregunta-barra"
        onSubmit={(e) => {
          e.preventDefault();
          preguntar(texto);
        }}
      >
        <input
          className="text-input"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={escuchando ? "Te escucho…" : "Escribe tu pregunta…"}
          enterKeyHint="send"
        />
        {Reconocedor && !texto.trim() ? (
          <button type="button" className={`pregunta-mic ${escuchando ? "escuchando" : ""}`} onClick={dictar} aria-label="Dictar pregunta">
            <Mic size={20} />
          </button>
        ) : (
          <button type="submit" className="pregunta-mic" aria-label="Preguntar">
            <Send size={19} />
          </button>
        )}
      </form>

      {respuesta && (
        <div className="pregunta-respuesta">
          <div className="pregunta-tarjeta">
            <span className="pregunta-titulo">{respuesta.titulo}</span>
            <strong className="pregunta-valor">{respuesta.valor}</strong>
            {respuesta.lineas.map((l, i) => (
              <span key={i} className="pregunta-linea">
                {l}
              </span>
            ))}
            {respuesta.filas && respuesta.filas.length > 0 && (
              <div className="pregunta-filas">
                {respuesta.filas.map((f, i) => (
                  <div key={i} className="pregunta-fila">
                    <span>
                      {f.etiqueta}
                      {f.tag && <em className={`pregunta-tag ${f.tag}`}>{f.tag === "pagada" ? "Pagada" : "Pendiente"}</em>}
                    </span>
                    <strong>{f.valor}</strong>
                  </div>
                ))}
              </div>
            )}
            {respuesta.barras && respuesta.barras.length > 0 && (
              <div className="pregunta-barras">
                {respuesta.barras.map((b, i) => (
                  <div key={i} className="pregunta-barra-fila">
                    <span>{b.etiqueta}</span>
                    <div className="pregunta-barra-pista">
                      <div className={b.destacada ? "destacada" : ""} style={{ width: `${Math.max(2, Math.round(b.valor * 100))}%` }} />
                    </div>
                    <strong>{b.texto}</strong>
                  </div>
                ))}
              </div>
            )}
            {respuesta.enlace && (
              <button type="button" className="link-btn pregunta-enlace" onClick={() => onIr(respuesta.enlace!.destino)}>
                {respuesta.enlace.texto} <ArrowRight size={14} />
              </button>
            )}
          </div>
          {respuesta.personas && respuesta.personas.length > 1 && (
            <>
              <div className="pregunta-personas">
                {respuesta.personas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={typeof respuesta.consulta.persona === "object" && respuesta.consulta.persona.id === p.id ? "activo" : ""}
                    onClick={() => mostrar({ ...respuesta.consulta, persona: p, modo: undefined })}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
              <p className="hint">Toca otro nombre para cambiar la respuesta.</p>
            </>
          )}
          {respuesta.diasSemana && (
            <>
              <div className="pregunta-dias">
                {DAYS.map((d, i) => {
                  const fecha = addDaysIso(mondayOnOrBefore(hoy), i);
                  const activo = DAYS[(new Date(`${respuesta.consulta.fecha}T00:00:00`).getDay() + 6) % 7] === d;
                  return (
                    <button key={d} type="button" className={activo ? "activo" : ""} onClick={() => mostrar({ ...respuesta.consulta, fecha })}>
                      {DAY_SHORT[d]}
                    </button>
                  );
                })}
              </div>
              <p className="hint">Toca otro día para ver su promedio.</p>
            </>
          )}
          {respuesta.dias && (
            <>
              <div className="pregunta-dias">
                {respuesta.dias.map((d) => (
                  <button
                    key={d.fecha}
                    type="button"
                    className={d.fecha === respuesta.consulta.fecha ? "activo" : ""}
                    disabled={d.futuro}
                    onClick={() => mostrar({ ...respuesta.consulta, fecha: d.fecha })}
                  >
                    {d.etiqueta}
                  </button>
                ))}
              </div>
              <p className="hint">Toca otro día para cambiar la respuesta.</p>
            </>
          )}
        </div>
      )}

      {noEntendi && (
        <div className="pregunta-tarjeta pregunta-no">
          <span>
            No entendí "{noEntendi}". Pregunta por venta, efectivo, gastos, propinas, utilidad o nómina — por ejemplo{" "}
            <em>"¿cuánto se vendió el martes?"</em> o <em>"¿cuánto le toca a {data.empleados[0]?.nombre.split(" ")[0] || "Jenny"}?"</em> — o toca una de estas:
          </span>
          <div className="pregunta-chips">{top.map((id) => chip(id))}</div>
        </div>
      )}

      <div className="pregunta-grupo">
        <span className="pregunta-grupo-titulo">Las que más preguntas</span>
        <div className="pregunta-chips">{top.map((id) => chip(id, true))}</div>
      </div>
      {GRUPOS.map((g) => {
        const lista = PREGUNTAS.filter((p) => p.grupo === g && !top.includes(p.id));
        if (lista.length === 0) return null;
        return (
          <div key={g} className="pregunta-grupo">
            <span className="pregunta-grupo-titulo">{g}</span>
            <div className="pregunta-chips">{lista.map((p) => chip(p.id))}</div>
          </div>
        );
      })}
    </Sheet>
  );
}
