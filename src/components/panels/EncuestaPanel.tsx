import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, NumInput } from "../ui";
import { TituloPagina } from "../BarraTitulo";
import { EncuestaRespondida } from "../EncuestaRespondida";
import { money, mondayOnOrBefore, todayIso } from "../../lib/dataModel";
import {
  MAXIMO_ENCUESTAS_DIA,
  MINIMO_ENCUESTAS,
  calificaciones,
  cancelarEncuesta,
  crearEncuesta,
  encuestasDeHoy,
  enviarIntentosPendientes,
  estadoEncuesta,
  misEncuestas,
  registrarIntento,
  svgQr,
  urlEncuesta,
  type EncuestaContestada,
  type EncuestaCreada,
} from "../../lib/encuestas";

// Encuesta para el cliente (personal de Piso): escribe el total de la
// cuenta y la mesa (las dos obligatorias), y muestra un QR que vale 30 minutos y una
// sola respuesta. Aquí mismo ve cuántas lleva hoy y su calificación de la
// semana y, abajo, sus encuestas de la semana que cuentan para ella: al
// tocar una la ve tal cual la contestó el cliente, con su comentario (las
// sospechosas no le salen).
// Con `prueba`, es el QR de prueba del dueño: no cuenta en calificaciones,
// ranking ni estadísticas.
const cuandoCorto = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(".", "");

export function EncuestaPanel({
  perfilId,
  meseroId,
  meseroNombre,
  prueba = false,
  onBack,
}: {
  perfilId: string;
  meseroId?: string;
  meseroNombre: string;
  prueba?: boolean;
  onBack?: () => void;
}) {
  const [total, setTotal] = useState("");
  const [mesa, setMesa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [encuesta, setEncuesta] = useState<(EncuestaCreada & { total: number; mesa: string }) | null>(null);
  const [estado, setEstado] = useState<"abierta" | "respondida" | "cancelada" | "vencida">("abierta");
  const [ahora, setAhora] = useState(() => Date.now());
  const [hoy, setHoy] = useState<number | null>(null);
  const [mia, setMia] = useState<{ promedio: number; cantidad: number } | null>(null);
  const [mias, setMias] = useState<EncuestaContestada[] | null>(null);
  const [abierta, setAbierta] = useState<EncuestaContestada | null>(null);

  useEffect(() => {
    if (!prueba) enviarIntentosPendientes();
  }, [prueba]);

  useEffect(() => {
    if (prueba) return;
    encuestasDeHoy(perfilId).then(setHoy);
    if (meseroId) calificaciones(mondayOnOrBefore(todayIso()), todayIso()).then((m) => setMia(m.get(meseroId) || { promedio: 0, cantidad: 0 }));
    misEncuestas(mondayOnOrBefore(todayIso()), todayIso()).then(setMias);
  }, [perfilId, meseroId, estado, prueba]);

  // Mientras el QR está abierto: el contador y saber si ya la contestaron.
  useEffect(() => {
    if (!encuesta || estado !== "abierta") return;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    const consulta = setInterval(() => estadoEncuesta(encuesta.id).then((e) => e && e !== "abierta" && setEstado(e)), 4000);
    return () => {
      clearInterval(reloj);
      clearInterval(consulta);
    };
  }, [encuesta, estado]);

  const restante = encuesta ? Math.max(0, new Date(encuesta.vence_en).getTime() - ahora) : 0;
  const vencida = !!encuesta && estado === "abierta" && restante === 0;
  const mmss = `${Math.floor(restante / 60000)}:${String(Math.floor((restante % 60000) / 1000)).padStart(2, "0")}`;

  async function generar() {
    const t = parseFloat(total);
    if (!(t > 0)) {
      if (!prueba) registrarIntento("sin-total", meseroId || null, meseroNombre);
      return setError("Escribe el total de la cuenta.");
    }
    if (!mesa.trim()) {
      if (!prueba) registrarIntento("sin-mesa", meseroId || null, meseroNombre);
      return setError("Escribe la mesa.");
    }
    if (!meseroId && !prueba) {
      registrarIntento("sin-ligar", null, meseroNombre);
      return setError("Tu usuario del sistema no está ligado a tu cuenta. Pídele al dueño que lo revise.");
    }
    setCreando(true);
    const r = await crearEncuesta(t, mesa.trim(), meseroId || "prueba", meseroNombre, prueba);
    setCreando(false);
    if (r.error || !r.encuesta) {
      if (!prueba) registrarIntento(r.motivo || "otro", meseroId || null, meseroNombre);
      return setError(r.error || "No se pudo crear la encuesta.");
    }
    setError(null);
    setEstado("abierta");
    setEncuesta({ ...r.encuesta, total: t, mesa: mesa.trim() });
  }

  function otra() {
    setEncuesta(null);
    setTotal("");
    setMesa("");
    setEstado("abierta");
  }

  return (
    <div className="page-section">
      <TituloPagina titulo={prueba ? "QR de prueba" : "Encuesta"} onBack={onBack} backLabel={prueba ? "Encuestas" : "Inicio"} />
      {prueba && (
        <p className="encuesta-aviso-prueba">
          Prueba: no cuenta en calificaciones, ranking ni estadísticas. Si la contestas desde tu celular saldrá como sospechosa (celular del
          personal); usa otro celular para verla como la vería un cliente.
        </p>
      )}

      {!encuesta && (
        <div className="encuesta-form">
          <h3>{prueba ? "Encuesta de prueba" : "Encuesta para el cliente"}</h3>
          <p className="hint">Escribe el total de su cuenta y la mesa: el cliente confirma el total al contestar.</p>
          <Field label="Total de la cuenta">
            <NumInput value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Mesa">
            <input className="text-input" value={mesa} maxLength={20} onChange={(e) => setMesa(e.target.value)} placeholder="Ej. 7" />
          </Field>
          {error && <p className="aviso-faltante">{error}</p>}
          <button className="btn-primary" disabled={creando} onClick={generar}>
            {creando ? "Generando…" : "Generar QR"}
          </button>
        </div>
      )}

      {encuesta && estado === "abierta" && !vencida && (
        <div className="encuesta-qr">
          <div className="encuesta-qr-img" dangerouslySetInnerHTML={{ __html: svgQr(urlEncuesta(encuesta.token)) }} />
          <strong>Escanea para calificarnos</strong>
          <span className="hint">
            {encuesta.mesa ? `Mesa ${encuesta.mesa} · ` : ""}
            {money(encuesta.total)}
          </span>
          <span className="encuesta-reloj">Vence en {mmss}</span>
          <button
            type="button"
            className="btn-secundario"
            onClick={() => {
              cancelarEncuesta(encuesta.id);
              otra();
            }}
          >
            Cancelar esta encuesta
          </button>
        </div>
      )}

      {encuesta && (estado !== "abierta" || vencida) && (
        <div className="encuesta-fin">
          {estado === "respondida" ? (
            <>
              <CheckCircle2 size={40} />
              <strong>¡Gracias! Encuesta recibida</strong>
            </>
          ) : (
            <strong>{estado === "cancelada" ? "Encuesta cancelada" : "Esta encuesta venció sin contestarse"}</strong>
          )}
          <button className="btn-primary" onClick={otra}>
            Generar otra
          </button>
        </div>
      )}

      {hoy !== null && (
        <p className="hint">
          Hoy llevas {hoy} {hoy === 1 ? "encuesta" : "encuestas"} · te quedan {Math.max(0, MAXIMO_ENCUESTAS_DIA - hoy)}.
        </p>
      )}
      {mia && (
        <div className="encuesta-mia">
          <span>Tu calificación esta semana</span>
          <strong>
            {mia.cantidad >= MINIMO_ENCUESTAS ? `⭐ ${mia.promedio.toLocaleString("es-MX", { minimumFractionDigits: 1 })}` : "⭐ —"} ·{" "}
            {mia.cantidad} {mia.cantidad === 1 ? "encuesta válida" : "encuestas válidas"}
          </strong>
          {mia.cantidad < MINIMO_ENCUESTAS && <small>Se muestra con {MINIMO_ENCUESTAS} o más en la semana.</small>}
        </div>
      )}
      {mias && mias.length > 0 && (
        <>
          <h3 className="encuesta-mias-titulo">Tus encuestas de esta semana</h3>
          <div className="encuesta-lista">
            {mias.map((r) => (
              <button key={r.encuesta_id} type="button" className="encuesta-resp encuesta-resp-abrir" onClick={() => setAbierta(r)}>
                <span className="encuesta-resp-top">
                  <span className="encuesta-estrellas">{"★".repeat(r.atencion) + "☆".repeat(5 - r.atencion)}</span>
                  <span>{cuandoCorto(r.respondida_en)}</span>
                </span>
                <span className="encuesta-resp-sub">
                  {[r.mesa ? `Mesa ${r.mesa}` : "", money(r.total_cliente), r.comentario ? "con comentario" : ""].filter(Boolean).join(" · ")}
                </span>
                <span className="encuesta-resp-ver">Ver encuesta ›</span>
              </button>
            ))}
          </div>
          <p className="hint">Solo las que cuentan para tu calificación.</p>
        </>
      )}
      {abierta && <EncuestaRespondida r={abierta} onCerrar={() => setAbierta(null)} />}
    </div>
  );
}
