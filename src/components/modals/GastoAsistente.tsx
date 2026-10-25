import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { money } from "../../lib/dataModel";
import type { NombreHistorial } from "../../lib/gastosBusqueda";
import type { EmpleadoEntry, Gasto, GastoCategoria, MeseroCatalogEntry, MeseroCut } from "../../lib/types";
import type { GastoFormValues } from "./GastoModal";
import {
  FormularioGasto, ListaAgregados, MarcoAsistente, PreguntaCorte, etiquetaCategoria, faltaEnGasto, gastoEnBlanco, gastoSinLlenar, type BorradorGasto,
} from "./asistente";

// Gasto del día paso por paso, igual que en el corte de mesero: primero
// "¿Se rebaja de algún corte?" (los cortes de meseros del día o "No, es un
// gasto general") y luego el formulario completo del gasto, con "Guardar
// otro gasto" (lo guarda, limpia y sigue ahí) y "Guardar gasto". Si se
// rebaja de un corte, se descuenta de la entrega de ese mesero. Al editar
// abre directo en el gasto; "Atrás" deja cambiar de qué corte se rebaja.
// En el turno 1, si hay fondo del día anterior, la pregunta es "¿Con qué
// dinero se pagó?" y la primera opción es "Con el fondo": se resta del fondo
// y no de las ventas.

export interface GastoAsistenteValores extends GastoFormValues {
  meseroCutId: string; // "" = gasto general
  delFondo?: boolean;
}

const FONDO = "__fondo__";

export function GastoAsistente({
  onClose,
  onSave,
  onDelete,
  editing,
  cortesDelDia,
  catalog,
  empleados,
  historial,
  fondo,
  inicialFondo = false,
}: {
  onClose: () => void;
  // otro: guardar y seguir capturando otro gasto.
  onSave: (form: GastoAsistenteValores, editingId?: string, otro?: boolean) => void;
  onDelete?: () => void;
  editing?: Gasto;
  cortesDelDia: MeseroCut[];
  catalog: MeseroCatalogEntry[];
  empleados: EmpleadoEntry[];
  historial: NombreHistorial[];
  // Fondo del día anterior que todavía se puede usar (turno 1): cuánto queda.
  fondo?: { queda: number };
  // Abierto desde la tarjeta del fondo: ya viene elegido "Con el fondo".
  inicialFondo?: boolean;
}) {
  const conPregunta = cortesDelDia.length > 0 || !!fondo;
  const [corteId, setCorteId] = useState<string | null>(
    editing ? (editing.delFondo ? FONDO : editing.meseroCutId || "") : inicialFondo && fondo ? FONDO : conPregunta ? null : ""
  );
  const [g, setG] = useState<BorradorGasto>(() =>
    editing
      ? {
          categoria: editing.categoria || "",
          concepto: editing.concepto,
          monto: String(editing.total),
          estado: editing.estado,
          empleadoId: editing.empleadoId || "",
          meseroId: editing.meseroId || "",
        }
      : gastoEnBlanco()
  );
  const [paso, setPaso] = useState(editing || !conPregunta || (inicialFondo && fondo) ? 1 : 0);
  const [aviso, setAviso] = useState("");
  const [guardados, setGuardados] = useState<{ id: string; concepto: string; categoria: GastoCategoria; monto: number; corte?: string }[]>([]);

  const esFondo = corteId === FONDO;
  const corte = esFondo ? undefined : cortesDelDia.find((c) => c.id === corteId);
  const totalPasos = conPregunta ? 2 : 1;
  const numero = conPregunta ? paso + 1 : 1;
  const vacio = gastoSinLlenar(g);

  function guardar(otro: boolean) {
    const falta = faltaEnGasto(g);
    if (falta) return setAviso(falta);
    onSave({ concepto: g.concepto.trim(), total: g.monto, estado: g.estado, categoria: g.categoria, empleadoId: g.empleadoId, meseroId: g.meseroId, meseroCutId: esFondo ? "" : corteId || "", delFondo: esFondo }, editing?.id, otro);
    if (otro) {
      setGuardados((l) => [
        ...l,
        { id: String(Date.now()), concepto: g.concepto.trim(), categoria: g.categoria as GastoCategoria, monto: parseFloat(g.monto) || 0, corte: esFondo ? "fondo" : corte?.nombre },
      ]);
      setG(gastoEnBlanco());
      setAviso("");
    }
  }

  const pie =
    paso === 0 ? (
      <>
        <button type="button" className="ca-boton secundario" onClick={onClose}>
          <ArrowLeft size={19} /> Atrás
        </button>
        <button type="button" className="ca-boton" disabled={corteId === null} onClick={() => setPaso(1)}>
          Siguiente <ArrowRight size={19} />
        </button>
      </>
    ) : (
      <>
        <button type="button" className="ca-boton secundario" onClick={() => (conPregunta ? setPaso(0) : onClose())}>
          <ArrowLeft size={19} /> Atrás
        </button>
        {!editing && (
          <button type="button" className="ca-boton secundario ca-medio" disabled={vacio} onClick={() => guardar(true)}>
            Guardar otro gasto
          </button>
        )}
        {/* Ya guardados con "Guardar otro gasto" y el formulario vacío: "Listo" cierra. */}
        {!editing && vacio && guardados.length ? (
          <button type="button" className="ca-boton" onClick={onClose}>
            <Check size={19} /> Listo
          </button>
        ) : (
          <button type="button" className="ca-boton" onClick={() => guardar(false)}>
            <Check size={19} /> {editing ? "Guardar cambios" : "Guardar gasto"}
          </button>
        )}
      </>
    );

  return (
    <MarcoAsistente
      titulo={editing ? "Editar gasto" : "Nuevo gasto"}
      avance={`Pregunta ${numero} de ${totalPasos}`}
      porcentaje={Math.round(((numero - 1) / totalPasos) * 100)}
      clavePaso={paso}
      onClose={onClose}
      onDelete={onDelete}
      etiquetaEliminar="Eliminar gasto"
      pie={pie}
    >
      {paso === 0 ? (
        <>
          <h2 className="ca-pregunta">{fondo ? "¿Con qué dinero se pagó?" : "¿Se rebaja de algún corte?"}</h2>
          <p className="ca-ayuda">
            {fondo
              ? "Con el fondo que se dejó ayer, del efectivo de un mesero (se le descuenta de lo que entrega) o de la caja."
              : "Si lo pagó un mesero con su efectivo, se le descuenta de lo que entrega."}
          </p>
          <PreguntaCorte
            cortes={cortesDelDia}
            valor={corteId}
            onElegir={setCorteId}
            textoNo={fondo ? "De la caja (gasto general)" : "No, es un gasto general"}
            fondo={fondo ? { valor: FONDO, queda: fondo.queda } : undefined}
          />
        </>
      ) : (
        <>
          <h2 className="ca-pregunta">{guardados.length ? "¿Otro gasto?" : editing ? "El gasto" : "¿Qué gasto es?"}</h2>
          <p className="ca-ayuda">
            {esFondo
              ? `Se paga con el fondo: quedan ${money(fondo?.queda ?? 0)}. No se resta de las ventas.`
              : corte
                ? `Se rebaja de la entrega de ${corte.nombre} (${money(corte.total)}).`
                : "Gasto general: no se rebaja de ningún corte."}
          </p>
          <ListaAgregados
            filas={guardados.map((x) => ({
              id: x.id,
              titulo: x.concepto,
              detalle: `${etiquetaCategoria(x.categoria)} · guardado${x.corte === "fondo" ? " · del fondo" : x.corte ? ` · corte de ${x.corte}` : ""}`,
              monto: x.monto,
            }))}
          />
          <FormularioGasto g={g} setG={setG} catalog={catalog} empleados={empleados} historial={historial} meseroCancelacion={corte?.meseroId} aviso={aviso} />
        </>
      )}
    </MarcoAsistente>
  );
}
