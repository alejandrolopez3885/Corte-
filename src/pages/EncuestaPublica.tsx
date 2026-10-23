import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { money } from "../lib/dataModel";
import { empezarEncuesta, encuestaPublica, responderEncuesta } from "../lib/encuestas";
import { Estrellas } from "../components/EncuestaRespondida";

// Lo que ve el cliente al escanear el QR (/?e=<código>), sin iniciar
// sesión. Primero solo escribe el total de su cuenta y toca "Empezar";
// luego califica atención del mesero, comida y rapidez (1 a 5) y deja un
// comentario opcional (arriba sigue su total, con "Cambiar"). Si el total
// no coincide no se le dice nada: queda sospechosa. Anónima.
type Fase = "cargando" | "abierta" | "enviando" | "gracias" | "cerrada" | "error";

export default function EncuestaPublica({ token }: { token: string }) {
  const [fase, setFase] = useState<Fase>("cargando");
  const [mensaje, setMensaje] = useState("");
  const [mesero, setMesero] = useState("");
  const [total, setTotal] = useState("");
  const [atencion, setAtencion] = useState(0);
  const [comida, setComida] = useState(0);
  const [rapidez, setRapidez] = useState(0);
  const [comentario, setComentario] = useState("");
  const [intento, setIntento] = useState(false);
  const [conTotal, setConTotal] = useState(false);
  const inicio = useRef(0);
  const empezo = useRef(false);

  // La primera vez que toca algo queda en el seguimiento del dueño.
  function tocar() {
    if (empezo.current) return;
    empezo.current = true;
    empezarEncuesta(token);
  }

  useEffect(() => {
    document.title = "Encuesta";
    encuestaPublica(token).then((r) => {
      if (r === "error") return setFase("error");
      if (!r) {
        setMensaje("Esta encuesta no existe.");
        return setFase("cerrada");
      }
      setMesero(r.mesero_nombre);
      if (r.estado === "abierta") {
        inicio.current = Date.now();
        return setFase("abierta");
      }
      setMensaje(r.estado === "respondida" ? "Esta encuesta ya se contestó. ¡Gracias!" : r.estado === "vencida" ? "Esta encuesta ya venció." : "Esta encuesta se canceló.");
      setFase("cerrada");
    });
  }, [token]);

  const falta = !(parseFloat(total) > 0) ? "Escribe el total de tu cuenta." : !atencion || !comida || !rapidez ? "Califica las tres preguntas." : null;

  async function enviar() {
    setIntento(true);
    if (falta) return;
    setFase("enviando");
    const r = await responderEncuesta(token, {
      total: parseFloat(total),
      atencion,
      comida,
      rapidez,
      comentario: comentario.trim(),
      segundos: Math.round((Date.now() - inicio.current) / 1000),
    });
    if (r === "ok") return setFase("gracias");
    if (r === "error") {
      setMensaje("No se pudo enviar. Revisa tu conexión e intenta de nuevo.");
      return setFase("abierta");
    }
    setMensaje(r === "respondida" ? "Esta encuesta ya se contestó. ¡Gracias!" : r === "vencida" ? "Esta encuesta ya venció." : "Esta encuesta ya no está disponible.");
    setFase("cerrada");
  }

  return (
    <div className="ep-fondo">
      <div className="ep-tarjeta">
        <img className="ep-logo" src="/favicon.svg" alt="" />
        {fase === "cargando" && <p className="hint">Cargando…</p>}
        {fase === "error" && <p className="hint">No se pudo abrir la encuesta. Revisa tu conexión e intenta de nuevo.</p>}
        {fase === "cerrada" && <p className="ep-mensaje">{mensaje}</p>}
        {fase === "gracias" && (
          <div className="ep-gracias">
            <CheckCircle2 size={44} />
            <h1>¡Gracias por tu opinión!</h1>
            <p className="hint">Nos ayuda a atenderte mejor.</p>
          </div>
        )}
        {(fase === "abierta" || fase === "enviando") && (
          <>
            <h1>¿Cómo te atendimos?</h1>
            <p className="hint">Te atendió {mesero} · toma 30 segundos</p>
            {!conTotal ? (
              <>
                <label className="field">
                  <span>Para empezar, escribe el total de tu cuenta (como viene en tu ticket)</span>
                  <input
                    className="text-input"
                    inputMode="decimal"
                    value={total}
                    onChange={(e) => {
                      tocar();
                      setTotal(e.target.value.replace(/[^\d.]/g, ""));
                    }}
                    placeholder="$ 0.00"
                  />
                </label>
                {intento && !(parseFloat(total) > 0) && <p className="aviso-faltante">Escribe el total de tu cuenta.</p>}
                <button
                  className="btn-primary"
                  onClick={() => {
                    if (!(parseFloat(total) > 0)) return setIntento(true);
                    setIntento(false);
                    setConTotal(true);
                  }}
                >
                  Empezar
                </button>
                <p className="hint ep-centro">Es anónima. ¡Gracias!</p>
              </>
            ) : (
              <>
                <div className="ep-total">
                  <span>
                    Total de tu cuenta: <b>{money(parseFloat(total))}</b>
                  </span>
                  <button type="button" disabled={fase === "enviando"} onClick={() => setConTotal(false)}>
                    Cambiar
                  </button>
                </div>
                <Estrellas
                  etiqueta="Atención de tu mesero"
                  valor={atencion}
                  onChange={(n) => {
                    tocar();
                    setAtencion(n);
                  }}
                />
                <Estrellas
                  etiqueta="Comida"
                  valor={comida}
                  onChange={(n) => {
                    tocar();
                    setComida(n);
                  }}
                />
                <Estrellas
                  etiqueta="Rapidez"
                  valor={rapidez}
                  onChange={(n) => {
                    tocar();
                    setRapidez(n);
                  }}
                />
                <label className="field">
                  <span>Comentario (opcional)</span>
                  <textarea className="text-input" rows={3} maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} />
                </label>
                {intento && falta && <p className="aviso-faltante">{falta}</p>}
                {mensaje && <p className="aviso-faltante">{mensaje}</p>}
                <button className="btn-primary" disabled={fase === "enviando"} onClick={enviar}>
                  {fase === "enviando" ? "Enviando…" : "Enviar"}
                </button>
                <p className="hint ep-centro">Es anónima. ¡Gracias!</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
