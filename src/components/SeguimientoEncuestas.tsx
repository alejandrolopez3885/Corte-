import { useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { Empty } from "./ui";
import { BorrarPrueba } from "./BorrarPrueba";
import { money } from "../lib/dataModel";
import { ETIQUETA_FINAL, MOTIVOS_INTENTO, cargarSeguimiento, duracion, resumirSeguimiento, type Final, type Seguimiento } from "../lib/seguimientoEncuestas";

// Pestaña "Seguimiento" de Encuestas (solo dueño): el embudo, dónde se
// quedaron, el resumen por mesero y la bitácora de cada encuesta paso a paso
// (las de prueba se pueden borrar desde ahí).
const TONO_FINAL: Record<Final, string> = {
  enviada: "ok",
  sospechosa: "mal",
  descartada: "gris",
  medias: "medio",
  "sin-abrir": "gris",
  cancelada: "gris",
  abierta: "medio",
  fallida: "mal",
};
const POR_VISTA = 30;

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }).replace(".", "");
const pct = (n: number, de: number) => (de ? `${Math.round((n / de) * 100)}%` : "—");

export function SeguimientoEncuestas({
  desde,
  hasta,
  nombrePeriodo,
  onBorrarPrueba,
}: {
  desde: string;
  hasta: string;
  nombrePeriodo: string;
  onBorrarPrueba: (id: string) => Promise<boolean>;
}) {
  const [datos, setDatos] = useState<Seguimiento | null | "error">(null);
  const [mesero, setMesero] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(POR_VISTA);

  useEffect(() => {
    let vivo = true;
    setDatos(null);
    setMostrar(POR_VISTA);
    cargarSeguimiento(desde, hasta).then((r) => {
      if (!vivo) return;
      setDatos(r ? resumirSeguimiento(r.encuestas, r.eventos, Date.now()) : "error");
    });
    return () => {
      vivo = false;
    };
  }, [desde, hasta]);

  if (datos === null) return <p className="hint">Cargando…</p>;
  if (datos === "error") return <p className="aviso-faltante">No se pudo leer el seguimiento. Revisa tu conexión.</p>;
  if (!datos.generadas && !datos.fallidas && !datos.bitacora.length)
    return <Empty icon={<MessageSquareText size={26} strokeWidth={1.3} />} text={`Todavía no se ha generado ninguna encuesta ${nombrePeriodo}.`} />;

  const g = datos.generadas;
  const embudo: [string, number, boolean?][] = [
    ["Generadas", g],
    ["El cliente la abrió (escaneó)", datos.abiertas],
    ["Empezó a contestar", datos.empezadas],
    ["La envió", datos.enviadas],
    ["Válidas", datos.validas, true],
  ];
  const quedaron: [string, number, boolean?][] = [
    ["Vencieron sin que nadie la abriera", datos.sinAbrir],
    ["La abrieron y no la terminaron", datos.medias],
    ["Canceladas por el mesero", datos.canceladas],
    ["Abiertas ahora mismo", datos.abiertasAhora],
    ["Sospechosas por revisar", datos.sospechosas, true],
    ["Intentos que no se generaron", datos.fallidas, true],
  ];
  const elegido = datos.meseros.find((m) => m.clave === mesero) || null;
  const bitacora = elegido ? datos.bitacora.filter((b) => b.meseroClave === elegido.clave) : datos.bitacora;

  return (
    <div className="seg">
      {g > 0 && (
        <div className="seg-tarjeta">
          <h4>
            De {g} {g === 1 ? "encuesta generada" : "encuestas generadas"}
          </h4>
          {embudo.map(([texto, n, valida]) => (
            <div key={texto} className="seg-paso">
              <strong>{texto}</strong>
              <span>{texto === "Generadas" ? n : `${n} · ${pct(n, g)}`}</span>
              <div className="ranking-barra">
                <i style={{ width: `${g ? (n / g) * 100 : 0}%` }} className={valida ? "valida" : ""} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="seg-tarjeta">
        <h4>Dónde se quedaron</h4>
        <div className="seg-quedaron">
          {quedaron.map(([texto, n, rojo]) => (
            <div key={texto}>
              <span>{texto}</span>
              <b className={rojo && n ? "rojo" : ""}>{n}</b>
            </div>
          ))}
        </div>
      </div>
      {(datos.tardaAbrir !== null || datos.tardaContestar !== null) && (
        <p className="hint">
          Tiempo típico:
          {datos.tardaAbrir !== null && ` la abren ${duracion(datos.tardaAbrir)} después de generarla`}
          {datos.tardaAbrir !== null && datos.tardaContestar !== null && " y"}
          {datos.tardaContestar !== null && ` tardan ${duracion(datos.tardaContestar)} en contestar`}.
        </p>
      )}

      <div className="seg-tarjeta">
        <h4>Por mesero</h4>
        <div className="seg-tabla">
          <span className="izq">Mesero</span>
          <span>Generó</span>
          <span>Enviadas</span>
          <span>Sin abrir</span>
          <span>Fallidos</span>
          {datos.meseros.map((m) => (
            <button
              key={m.clave}
              type="button"
              className={`seg-fila ${m.clave === mesero ? "activo" : ""}`}
              onClick={() => {
                setMesero(m.clave === mesero ? null : m.clave);
                setMostrar(POR_VISTA);
              }}
            >
              <b>{m.nombre}</b>
              <span>{m.genero}</span>
              <span>{m.genero ? `${m.enviadas} · ${pct(m.enviadas, m.genero)}` : "—"}</span>
              <span>{m.sinAbrir}</span>
              <span className={m.fallidas ? "rojo" : ""}>{m.fallidas}</span>
            </button>
          ))}
        </div>
        <p className="hint">Toca un mesero para ver solo su bitácora.</p>
      </div>

      {elegido && (
        <div className="seg-tarjeta">
          <h4>{elegido.nombre}</h4>
          <span>
            Generó {elegido.genero} · enviadas {elegido.enviadas}
            {elegido.medias ? ` · ${elegido.medias} a medias` : ""}
            {elegido.sinAbrir ? ` · ${elegido.sinAbrir} sin abrir` : ""}
            {elegido.canceladas ? ` · canceló ${elegido.canceladas}` : ""}
            {elegido.sospechosas ? ` · ${elegido.sospechosas} ${elegido.sospechosas === 1 ? "sospechosa" : "sospechosas"}` : ""}
          </span>
          {elegido.fallidas > 0 && (
            <span className="seg-rojo">
              {elegido.fallidas} {elegido.fallidas === 1 ? "intento que no se generó" : "intentos que no se generaron"}:{" "}
              {Object.entries(elegido.porMotivo)
                .map(([motivo, n]) => `${n} · ${MOTIVOS_INTENTO[motivo] || motivo}`)
                .join(", ")}
            </span>
          )}
          <button type="button" className="seg-todos" onClick={() => setMesero(null)}>
            Ver a todos
          </button>
        </div>
      )}

      <h4 className="seg-titulo">Bitácora{elegido ? ` de ${elegido.nombre}` : ""}</h4>
      <div className="encuesta-lista">
        {bitacora.slice(0, mostrar).map((b) => (
          <div key={b.clave} className={`encuesta-resp ${b.final === "fallida" ? "sospechosa" : ""}`}>
            <div className="encuesta-resp-top">
              <strong>
                {b.meseroNombre}
                {b.mesa ? ` · Mesa ${b.mesa}` : ""}
                {b.total !== undefined ? ` · ${money(b.total)}` : ""}
              </strong>
              <span className="encuesta-chips">
                {b.prueba && <span className="chip-prueba">Prueba</span>}
                <span className={`seg-chip ${TONO_FINAL[b.final]}`}>{ETIQUETA_FINAL[b.final]}</span>
              </span>
            </div>
            <span className="encuesta-resp-sub">{dia(b.cuando)}</span>
            <div className="seg-pasos">
              {b.pasos.map((p, i) => (
                <span key={i} className={p.tono || ""}>
                  {hora(p.cuando)} {p.texto}
                </span>
              ))}
            </div>
            {b.prueba && <BorrarPrueba texto="Borrar esta prueba" pregunta="¿Borrar esta prueba?" onBorrar={() => onBorrarPrueba(b.clave)} />}
          </div>
        ))}
        {bitacora.length > mostrar && (
          <button type="button" className="btn-secundario" onClick={() => setMostrar((n) => n + POR_VISTA)}>
            Ver más ({bitacora.length - mostrar})
          </button>
        )}
      </div>
    </div>
  );
}
