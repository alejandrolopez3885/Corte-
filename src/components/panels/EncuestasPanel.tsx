import { useEffect, useState } from "react";
import { useTickRecargar } from "../JalarParaActualizar";
import { MessageSquareText, QrCode } from "lucide-react";
import { Empty } from "../ui";
import { TituloPagina } from "../BarraTitulo";
import { SeguimientoEncuestas } from "../SeguimientoEncuestas";
import { EncuestaPanel } from "./EncuestaPanel";
import { EncuestaRespondida } from "../EncuestaRespondida";
import { BorrarPrueba } from "../BorrarPrueba";
import { addDaysIso, money, round2 } from "../../lib/dataModel";
import { ubicarFechas } from "../../lib/inicio";
import { rangoRanking, type PeriodoRanking } from "../../lib/ranking";
import {
  MINIMO_ENCUESTAS, MOTIVOS, agregarMotivo, borrarPruebas, cargarRespuestas, contarPruebas, esPrueba, esValida, revisarRespuesta, type EncuestaContestada, type RespuestaEncuesta,
} from "../../lib/encuestas";
import type { AppData } from "../../lib/types";

// Encuestas (solo dueño): las respuestas con sus comentarios, el resumen
// por mesero y las sospechosas — que no cuentan hasta aprobarlas. Al abrir,
// marca como sospechosas las de un mesero cuyos totales con encuesta de un
// día pasan su venta de ese día en el corte (solo si ese corte ya tiene su
// venta; lo de antes de las 5 am es del día anterior) y les quita esa marca
// si ya no pasan (ej. se corrigió el corte). En "Seguimiento", cada paso de
// cada encuesta y dónde se quedan. "Generar QR de prueba" abre el mismo QR
// del mesero, marcado como prueba (no cuenta en ningún promedio). Tocar
// una respuesta abre la encuesta tal cual la contestó el cliente. Las de
// prueba se pueden borrar (una por una o todas), con su respuesta y sus
// pasos del seguimiento.
type Pestana = "respuestas" | "meseros" | "sospechosas" | "seguimiento";

const estrellas = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
const fechaLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Día de trabajo: lo contestado antes de las 5 am es del turno del día anterior.
const HORA_CAMBIO_DIA = 5;
const diaDeTrabajo = (iso: string) => fechaLocal(new Date(new Date(iso).getTime() - HORA_CAMBIO_DIA * 3600000).toISOString());
const cuando = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).replace(".", "");

export function EncuestasPanel({ data, perfilId, nombreDueno, onBack }: { data: AppData; perfilId: string; nombreDueno: string; onBack?: () => void }) {
  const [probando, setProbando] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoRanking>("semana");
  const [pestana, setPestana] = useState<Pestana>("respuestas");
  const [respuestas, setRespuestas] = useState<RespuestaEncuesta[] | null | "error">(null);
  const [abierta, setAbierta] = useState<EncuestaContestada | null>(null);
  const [pruebas, setPruebas] = useState(0);
  // Sube al borrar pruebas, para que Seguimiento se vuelva a leer.
  const [borradas, setBorradas] = useState(0);

  useEffect(() => {
    if (!probando) contarPruebas().then(setPruebas);
  }, [probando, borradas]);

  async function borrar(id?: string) {
    if (!(await borrarPruebas(id))) return false;
    setRespuestas((lista) => (Array.isArray(lista) ? lista.filter((r) => (id ? r.encuesta_id !== id : !esPrueba(r))) : lista));
    setBorradas((n) => n + 1);
    return true;
  }

  const tick = useTickRecargar();
  useEffect(() => {
    const { desde, hasta } = rangoRanking(periodo);
    let vivo = true;
    setRespuestas(null);
    cargarRespuestas(desde, hasta).then(async (lista) => {
      if (!vivo) return;
      if (!lista) return setRespuestas("error");
      // Capa 5: si lo de sus encuestas de un día pasa su venta del corte.
      const ubicaciones = ubicarFechas(data);
      const grupos = new Map<string, RespuestaEncuesta[]>();
      lista.forEach((r) => {
        if (esPrueba(r)) return;
        const k = `${r.mesero_id}|${diaDeTrabajo(r.respondida_en)}`;
        grupos.set(k, [...(grupos.get(k) || []), r]);
      });
      for (const [k, rs] of grupos) {
        const [meseroId, fecha] = k.split("|");
        // De madrugada del lunes: es del domingo anterior, que no se cargó completo.
        if (fecha < desde) continue;
        const day = ubicaciones.get(fecha)?.day;
        const cortes = (day?.meseros || []).filter((m) => m.meseroId === meseroId);
        // Sin su corte de ese día todavía no hay contra qué comparar: se revisa cuando se guarde.
        if (!cortes.length) continue;
        const venta = round2(cortes.reduce((s, m) => s + m.venta, 0));
        const suma = round2(rs.reduce((s, r) => s + (r.encuestas?.total || 0), 0));
        const pasa = suma > venta;
        for (const r of rs) {
          // Se marca si pasa y se le quita la marca si ya no pasa (ej. se corrigió el corte).
          if (pasa === r.motivos.includes("venta")) continue;
          r.motivos = pasa ? [...r.motivos, "venta"] : r.motivos.filter((m) => m !== "venta");
          await agregarMotivo(r.encuesta_id, r.motivos);
        }
      }
      if (vivo) setRespuestas([...lista]);
    });
    return () => {
      vivo = false;
    };
  }, [periodo, data, tick]);

  async function revisar(r: RespuestaEncuesta, revision: "aprobada" | "descartada") {
    if (!(await revisarRespuesta(r.encuesta_id, revision))) return;
    setRespuestas((lista) => (Array.isArray(lista) ? lista.map((x) => (x.encuesta_id === r.encuesta_id ? { ...x, revision } : x)) : lista));
  }

  const lista = Array.isArray(respuestas) ? respuestas : [];
  const validas = lista.filter(esValida);
  const sospechosas = lista.filter((r) => !esValida(r) && r.revision !== "descartada");
  const descartadas = lista.filter((r) => r.revision === "descartada").length;
  const porMesero = [...new Set(lista.filter((r) => !esPrueba(r)).map((r) => r.mesero_id))]
    .map((id) => {
      const rs = validas.filter((r) => r.mesero_id === id && !esPrueba(r));
      const prom = (k: "atencion" | "comida" | "rapidez") => (rs.length ? Math.round((rs.reduce((s, r) => s + r[k], 0) / rs.length) * 10) / 10 : 0);
      return {
        id,
        nombre: lista.find((r) => r.mesero_id === id)!.mesero_nombre,
        cantidad: rs.length,
        atencion: prom("atencion"),
        comida: prom("comida"),
        rapidez: prom("rapidez"),
        sospechosas: sospechosas.filter((r) => r.mesero_id === id && !esPrueba(r)).length,
      };
    })
    .sort((a, b) => b.atencion - a.atencion || b.cantidad - a.cantidad);
  const { desde, hasta } = rangoRanking(periodo);
  const nombrePeriodo = periodo === "semana" ? "esta semana" : periodo === "semanaPasada" ? "la semana pasada" : "este mes";
  const uno = (n: number) => n.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const tarjeta = (r: RespuestaEncuesta, conAcciones: boolean) => (
    <div
      key={r.encuesta_id}
      className={`encuesta-resp encuesta-resp-abrir ${conAcciones ? "sospechosa" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => setAbierta({ ...r, mesa: r.encuestas?.mesa ?? null })}
      onKeyDown={(e) => e.key === "Enter" && setAbierta({ ...r, mesa: r.encuestas?.mesa ?? null })}
    >
      <div className="encuesta-resp-top">
        <strong>
          {r.mesero_nombre} · <span className="encuesta-estrellas">{estrellas(r.atencion)}</span>
        </strong>
        <span className="encuesta-chips">
          {esPrueba(r) && <span className="chip-prueba">Prueba</span>}
          <span>{cuando(r.respondida_en)}</span>
        </span>
      </div>
      <span className="encuesta-resp-sub">
        Comida {r.comida} · Rapidez {r.rapidez}
        {r.encuestas?.mesa ? ` · Mesa ${r.encuestas.mesa}` : ""}
        {r.encuestas ? ` · ${money(r.encuestas.total)}` : ""}
        {r.revision === "aprobada" ? " · aprobada por ti" : ""}
      </span>
      {r.comentario && <em className="encuesta-resp-comentario">“{r.comentario}”</em>}
      {conAcciones && (
        <>
          <span className="encuesta-resp-motivo">
            No cuenta: {r.motivos.map((m) => (m === "total" ? `${MOTIVOS.total} (${money(r.total_cliente)} vs ${money(r.encuestas?.total || 0)})` : MOTIVOS[m] || m)).join(" · ")}
            {r.motivos.includes("rapida") && r.segundos !== null ? ` (${r.segundos} s)` : ""}
          </span>
          <div className="encuesta-resp-acciones" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="aprobar" onClick={() => revisar(r, "aprobada")}>
              Aprobar
            </button>
            <button type="button" className="descartar" onClick={() => revisar(r, "descartada")}>
              Descartar
            </button>
          </div>
        </>
      )}
      {esPrueba(r) && <BorrarPrueba texto="Borrar esta prueba" pregunta="¿Borrar esta prueba?" onBorrar={() => borrar(r.encuesta_id)} />}
      <span className="encuesta-resp-ver">Ver encuesta ›</span>
    </div>
  );

  if (probando) return <EncuestaPanel perfilId={perfilId} meseroNombre={nombreDueno} prueba onBack={() => setProbando(false)} />;

  return (
    <div className="page-section">
      <TituloPagina titulo="Encuestas" onBack={onBack} backLabel="Equipo" />
      <button type="button" className="encuesta-prueba-btn" onClick={() => setProbando(true)}>
        <QrCode size={18} /> Generar QR de prueba
      </button>
      {pruebas > 0 && (
        <BorrarPrueba
          centrado
          texto={`Borrar todas las de prueba (${pruebas})`}
          pregunta={`¿Borrar ${pruebas === 1 ? "la encuesta de prueba" : `las ${pruebas} encuestas de prueba`}? No se puede deshacer.`}
          onBorrar={() => borrar()}
        />
      )}
      <div className="ranking-periodos">
        {(
          [
            ["semana", "Esta semana"],
            ["semanaPasada", "Semana pasada"],
            ["mes", "Mes"],
          ] as [PeriodoRanking, string][]
        ).map(([p, t]) => (
          <button key={p} type="button" className={p === periodo ? "activo" : ""} onClick={() => setPeriodo(p)}>
            {t}
          </button>
        ))}
      </div>
      <div className="ranking-periodos encuestas-pestanas">
        <button type="button" className={pestana === "respuestas" ? "activo" : ""} onClick={() => setPestana("respuestas")}>
          Respuestas
        </button>
        <button type="button" className={pestana === "meseros" ? "activo" : ""} onClick={() => setPestana("meseros")}>
          Por mesero
        </button>
        <button type="button" className={pestana === "sospechosas" ? "activo" : ""} onClick={() => setPestana("sospechosas")}>
          Sospechosas{sospechosas.length ? ` · ${sospechosas.length}` : ""}
        </button>
        <button type="button" className={pestana === "seguimiento" ? "activo" : ""} onClick={() => setPestana("seguimiento")}>
          Seguimiento
        </button>
      </div>

      {pestana === "seguimiento" && <SeguimientoEncuestas key={borradas} desde={desde} hasta={hasta} nombrePeriodo={nombrePeriodo} onBorrarPrueba={borrar} />}

      {pestana !== "seguimiento" && respuestas === null && <p className="hint">Cargando…</p>}
      {pestana !== "seguimiento" && respuestas === "error" && <p className="aviso-faltante">No se pudieron leer las encuestas. Revisa tu conexión.</p>}

      {Array.isArray(respuestas) && pestana === "respuestas" &&
        (validas.length === 0 ? (
          <Empty icon={<MessageSquareText size={26} strokeWidth={1.3} />} text={`Todavía no hay encuestas válidas ${nombrePeriodo}.`} />
        ) : (
          <div className="encuesta-lista">{validas.map((r) => tarjeta(r, false))}</div>
        ))}

      {Array.isArray(respuestas) && pestana === "meseros" &&
        (porMesero.length === 0 ? (
          <Empty icon={<MessageSquareText size={26} strokeWidth={1.3} />} text={`Todavía no hay encuestas ${nombrePeriodo}.`} />
        ) : (
          <div className="encuesta-lista">
            {porMesero.map((m) => (
              <div key={m.id} className="encuesta-resp">
                <div className="encuesta-resp-top">
                  <strong>{m.nombre}</strong>
                  <span>{m.cantidad >= MINIMO_ENCUESTAS ? `⭐ ${uno(m.atencion)}` : "⭐ —"} · {m.cantidad} válidas</span>
                </div>
                <span className="encuesta-resp-sub">
                  {m.cantidad ? `Atención ${uno(m.atencion)} · Comida ${uno(m.comida)} · Rapidez ${uno(m.rapidez)}` : "Sin encuestas válidas"}
                  {m.sospechosas ? ` · ${m.sospechosas} sospechosa${m.sospechosas === 1 ? "" : "s"}` : ""}
                </span>
              </div>
            ))}
            <p className="hint">La ⭐ del ranking es la atención del mesero; se muestra con {MINIMO_ENCUESTAS} o más encuestas válidas.</p>
          </div>
        ))}

      {Array.isArray(respuestas) && pestana === "sospechosas" &&
        (sospechosas.length === 0 ? (
          <Empty icon={<MessageSquareText size={26} strokeWidth={1.3} />} text={`No hay encuestas sospechosas ${nombrePeriodo}.`} />
        ) : (
          <div className="encuesta-lista">
            {sospechosas.map((r) => tarjeta(r, true))}
            <p className="hint">Aprobar: cuenta para su calificación. Descartar: no cuenta y sale de aquí.</p>
          </div>
        ))}
      {Array.isArray(respuestas) && pestana !== "seguimiento" && descartadas > 0 && (
        <p className="hint">
          {descartadas} {descartadas === 1 ? "encuesta descartada" : "encuestas descartadas"} {nombrePeriodo}.
        </p>
      )}
      {abierta && <EncuestaRespondida r={abierta} onCerrar={() => setAbierta(null)} />}
      <p className="hint">
        Del {desde.slice(8)}/{desde.slice(5, 7)} al {addDaysIso(hasta, 0).slice(8)}/{hasta.slice(5, 7)}.
      </p>
    </div>
  );
}
