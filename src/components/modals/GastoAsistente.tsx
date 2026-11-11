import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { money } from "../../lib/dataModel";
import type { NombreHistorial } from "../../lib/gastosBusqueda";
import type { EmpleadoEntry, Gasto, MeseroCatalogEntry, MeseroCut } from "../../lib/types";
import type { GastoFormValues } from "./GastoModal";
import { GastoPasos } from "./GastoPasos";
import { MarcoAsistente, PreguntaCorte, gastoEnBlanco, ligasDeGasto, type BorradorGasto } from "./asistente";

export interface GastoAsistenteValores extends GastoFormValues {
  meseroCutId: string;
  delFondo?: boolean;
}

const FONDO = "__fondo__";

export function GastoAsistente({ onClose, onSave, onDelete, editing, cortesDelDia, catalog, empleados, historial, fondo, inicialFondo = false, estadoAuto = false }: {
  onClose: () => void;
  onSave: (form: GastoAsistenteValores, editingId?: string, otro?: boolean) => void;
  onDelete?: () => void;
  editing?: Gasto;
  cortesDelDia: MeseroCut[];
  catalog: MeseroCatalogEntry[];
  empleados: EmpleadoEntry[];
  historial: NombreHistorial[];
  fondo?: { queda: number };
  inicialFondo?: boolean;
  estadoAuto?: boolean;
}) {
  const conPregunta = cortesDelDia.length > 0 || !!fondo;
  const [corteId, setCorteId] = useState<string | null>(editing ? editing.delFondo ? FONDO : editing.meseroCutId || "" : inicialFondo && fondo ? FONDO : conPregunta ? null : "");
  const [eligiendo, setEligiendo] = useState(!editing && conPregunta && !(inicialFondo && fondo));
  const [guardados, setGuardados] = useState(0);
  const [vuelta, setVuelta] = useState(0);
  const inicial: BorradorGasto = editing ? {
    categoria: editing.categoria || "", concepto: editing.concepto, monto: String(editing.total),
    estado: editing.estado, empleadoId: editing.empleadoId || "", meseroId: editing.meseroId || "",
  } : gastoEnBlanco();
  const corte = cortesDelDia.find((c) => c.id === corteId);

  function guardar(g: BorradorGasto, otro: boolean) {
    onSave({
      concepto: g.concepto, total: g.monto, estado: g.estado, categoria: g.categoria,
      empleadoId: ligasDeGasto(g).empleadoId || "", meseroId: ligasDeGasto(g).meseroId || "", meseroCutId: corteId === FONDO ? "" : corteId || "", delFondo: corteId === FONDO,
    }, editing?.id, otro);
    if (otro) {
      setGuardados((n) => n + 1);
      setVuelta((n) => n + 1);
    }
  }

  return (
    <MarcoAsistente titulo={editing ? "Editar gasto" : "Nuevo gasto"} avance={eligiendo ? "Elegir origen" : "Gasto paso a paso"} porcentaje={eligiendo ? 0 : 20} clavePaso={eligiendo ? "origen" : vuelta}
      onClose={onClose} onDelete={onDelete} etiquetaEliminar="Eliminar gasto"
      pie={eligiendo ? <><button type="button" className="ca-boton secundario" onClick={onClose}><ArrowLeft size={19} /> Atrás</button><button type="button" className="ca-boton" disabled={corteId === null} onClick={() => setEligiendo(false)}>Siguiente <ArrowRight size={19} /></button></> : null}
    >
      {eligiendo ? <>
        <h2 className="ca-pregunta">{fondo ? "¿Con qué dinero se pagó?" : "¿Se rebaja de algún corte?"}</h2>
        <p className="ca-ayuda">{fondo ? "Elige el fondo, el corte de un mesero o la caja." : "Si lo pagó un mesero, se descuenta de su corte."}</p>
        <PreguntaCorte cortes={cortesDelDia} valor={corteId} onElegir={setCorteId} textoNo={fondo ? "De la caja (gasto general)" : "No, es un gasto general"} fondo={fondo ? { valor: FONDO, queda: fondo.queda } : undefined} />
      </> : <>
        {corteId === FONDO && <p className="ca-ayuda">Se paga con el fondo; quedan {money(fondo?.queda ?? 0)}.</p>}
        {corte && <p className="ca-ayuda">Se rebaja del corte de {corte.nombre}.</p>}
        {guardados > 0 && <p className="ca-ayuda">{guardados} {guardados === 1 ? "gasto guardado" : "gastos guardados"}.</p>}
        <GastoPasos key={vuelta} inicial={inicial} catalog={catalog} empleados={empleados} historial={historial} meseroCancelacion={corte?.meseroId} estadoAuto={estadoAuto}
          onCancelar={() => conPregunta ? setEligiendo(true) : onClose()}
          onGuardar={(g) => guardar(g, false)}
          onGuardarOtro={!editing ? (g) => guardar(g, true) : undefined}
        />
      </>}
    </MarcoAsistente>
  );
}
