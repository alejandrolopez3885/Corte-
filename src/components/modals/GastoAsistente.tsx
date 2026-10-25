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

export interface GastoAsistenteValores extends GastoFormValues {
  meseroCutId: string; // "" = gasto general
}

export function GastoAsistente({
  onClose,
  onSave,
  onDelete,
  editing,
  cortesDelDia,
  catalog,
  empleados,
  historial,
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
}) {
  const conPregunta = cortesDelDia.length > 0;
  const [corteId, setCorteId] = useState<string | null>(editing ? editing.meseroCutId || "" : conPregunta ? null : "");
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
  const [paso, setPaso] = useState(editing || !conPregunta ? 1 : 0);
  const [aviso, setAviso] = useState("");
  const [guardados, setGuardados] = useState<{ id: string; concepto: string; categoria: GastoCategoria; monto: number; corte?: string }[]>([]);

  const corte = cortesDelDia.find((c) => c.id === corteId);
  const totalPasos = conPregunta ? 2 : 1;
  const numero = conPregunta ? paso + 1 : 1;
  const vacio = gastoSinLlenar(g);

  function guardar(otro: boolean) {
    const falta = faltaEnGasto(g);
    if (falta) return setAviso(falta);
    onSave({ concepto: g.concepto.trim(), total: g.monto, estado: g.estado, categoria: g.categoria, empleadoId: g.empleadoId, meseroId: g.meseroId, meseroCutId: corteId || "" }, editing?.id, otro);
    if (otro) {
      setGuardados((l) => [
        ...l,
        { id: String(Date.now()), concepto: g.concepto.trim(), categoria: g.categoria as GastoCategoria, monto: parseFloat(g.monto) || 0, corte: corte?.nombre },
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
          <h2 className="ca-pregunta">¿Se rebaja de algún corte?</h2>
          <p className="ca-ayuda">Si lo pagó un mesero con su efectivo, se le descuenta de lo que entrega.</p>
          <PreguntaCorte cortes={cortesDelDia} valor={corteId} onElegir={setCorteId} textoNo="No, es un gasto general" />
        </>
      ) : (
        <>
          <h2 className="ca-pregunta">{guardados.length ? "¿Otro gasto?" : editing ? "El gasto" : "¿Qué gasto es?"}</h2>
          <p className="ca-ayuda">{corte ? `Se rebaja de la entrega de ${corte.nombre} (${money(corte.total)}).` : "Gasto general: no se rebaja de ningún corte."}</p>
          <ListaAgregados
            filas={guardados.map((x) => ({
              id: x.id,
              titulo: x.concepto,
              detalle: `${etiquetaCategoria(x.categoria)} · guardado${x.corte ? ` · corte de ${x.corte}` : ""}`,
              monto: x.monto,
            }))}
          />
          <FormularioGasto g={g} setG={setG} catalog={catalog} empleados={empleados} historial={historial} meseroCancelacion={corte?.meseroId} aviso={aviso} />
        </>
      )}
    </MarcoAsistente>
  );
}
