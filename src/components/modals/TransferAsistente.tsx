import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { SumInput } from "../ui";
import { money, sumFromText } from "../../lib/dataModel";
import type { MeseroCatalogEntry, MeseroCut, Transferencia } from "../../lib/types";
import type { TransferFormValues } from "./TransferModal";
import { ListaAgregados, MarcoAsistente, Opcion, PreguntaCorte, iniciales } from "./asistente";

// Transferencia del día paso por paso, igual que el corte de mesero:
// "¿Se rebaja de algún corte?" (los cortes de meseros del día o "No"), si
// no, "¿Quién cobró?", y "¿De cuánto es?" (con "+" para sumar varias), con
// "Guardar otra transferencia" y "Guardar transferencia". Si se rebaja de
// un corte, va a nombre de ese mesero y se descuenta de su entrega. Al
// editar abre directo en el monto.

export interface TransferAsistenteValores extends TransferFormValues {
  meseroCutId: string; // "" = no se rebaja de ningún corte
}

type Paso = "corte" | "persona" | "monto";

export function TransferAsistente({
  onClose,
  onSave,
  onDelete,
  editing,
  cortesDelDia,
  catalog,
}: {
  onClose: () => void;
  // otro: guardar y seguir capturando otra transferencia.
  onSave: (form: TransferAsistenteValores, editingId?: string, otro?: boolean) => void;
  onDelete?: () => void;
  editing?: Transferencia;
  cortesDelDia: MeseroCut[];
  catalog: MeseroCatalogEntry[];
}) {
  const conPregunta = cortesDelDia.length > 0;
  const [corteId, setCorteId] = useState<string | null>(editing ? editing.meseroCutId || "" : conPregunta ? null : "");
  const [persona, setPersona] = useState(editing && !editing.meseroCutId ? editing.persona : "");
  const enCatalogo = catalog.some((c) => c.nombre === persona);
  const [otraPersona, setOtraPersona] = useState(!!persona && !enCatalogo);
  const [monto, setMonto] = useState(editing ? String(editing.total) : "");
  const [desglose, setDesglose] = useState<number[] | undefined>(editing?.desglose);
  const [paso, setPaso] = useState<Paso>(editing ? "monto" : conPregunta ? "corte" : "persona");
  const [aviso, setAviso] = useState("");
  const [guardadas, setGuardadas] = useState<{ id: string; persona: string; total: number; corte: boolean }[]>([]);

  const corte = cortesDelDia.find((c) => c.id === corteId);
  const pasos: Paso[] = [...(conPregunta ? (["corte"] as Paso[]) : []), ...(corte ? [] : (["persona"] as Paso[])), "monto"];
  const i = Math.max(0, pasos.indexOf(paso));
  const quien = corte ? corte.nombre : persona.trim();
  const total = sumFromText(monto);

  function atras() {
    if (i === 0) onClose();
    else setPaso(pasos[i - 1]);
  }
  function siguiente() {
    setPaso(pasos[i + 1]);
  }
  function guardar(otra: boolean) {
    if (!quien) return setAviso("Elige quién cobró.");
    if (!(total > 0)) return setAviso("Escribe el monto de la transferencia.");
    onSave({ persona: quien, total: String(total), desglose, meseroCutId: corteId || "" }, editing?.id, otra);
    if (otra) {
      setGuardadas((l) => [...l, { id: String(Date.now()), persona: quien, total, corte: !!corte }]);
      setMonto("");
      setDesglose(undefined);
      setAviso("");
    }
  }

  const listoPaso = paso === "corte" ? corteId !== null : paso === "persona" ? !!persona.trim() : true;
  const vacio = monto.trim() === "";

  const pie =
    paso !== "monto" ? (
      <>
        <button type="button" className="ca-boton secundario" onClick={atras}>
          <ArrowLeft size={19} /> Atrás
        </button>
        <button type="button" className="ca-boton" disabled={!listoPaso} onClick={siguiente}>
          Siguiente <ArrowRight size={19} />
        </button>
      </>
    ) : (
      <>
        <button type="button" className="ca-boton secundario" onClick={atras}>
          <ArrowLeft size={19} /> Atrás
        </button>
        {!editing && (
          <button type="button" className="ca-boton secundario ca-medio" onClick={() => guardar(true)}>
            Guardar otra transferencia
          </button>
        )}
        {/* Ya guardadas con "Guardar otra" y el monto vacío: "Listo" cierra. */}
        {!editing && vacio && guardadas.length ? (
          <button type="button" className="ca-boton" onClick={onClose}>
            <Check size={19} /> Listo
          </button>
        ) : (
          <button type="button" className="ca-boton" onClick={() => guardar(false)}>
            <Check size={19} /> {editing ? "Guardar cambios" : "Guardar transferencia"}
          </button>
        )}
      </>
    );

  return (
    <MarcoAsistente
      titulo={editing ? "Editar transferencia" : "Nueva transferencia"}
      avance={`Pregunta ${i + 1} de ${pasos.length}`}
      porcentaje={Math.round((i / pasos.length) * 100)}
      clavePaso={paso}
      onClose={onClose}
      onDelete={onDelete}
      etiquetaEliminar="Eliminar transferencia"
      pie={pie}
    >
      {paso === "corte" && (
        <>
          <h2 className="ca-pregunta">¿Se rebaja de algún corte?</h2>
          <p className="ca-ayuda">Si la cobró un mesero, se le descuenta de lo que entrega.</p>
          <PreguntaCorte cortes={cortesDelDia} valor={corteId} onElegir={setCorteId} textoNo="No se rebaja de ningún corte" />
        </>
      )}
      {paso === "persona" && (
        <>
          <h2 className="ca-pregunta">¿Quién cobró la transferencia?</h2>
          <div className="ca-opciones">
            {catalog.map((c) => (
              <Opcion
                key={c.id}
                elegida={!otraPersona && persona === c.nombre}
                onClick={() => {
                  setOtraPersona(false);
                  setPersona(c.nombre);
                }}
                extra={<span className="ca-avatar">{iniciales(c.nombre)}</span>}
              >
                {c.nombre}
              </Opcion>
            ))}
            <Opcion
              elegida={otraPersona}
              onClick={() => {
                setOtraPersona(true);
                if (enCatalogo) setPersona("");
              }}
            >
              Otra persona
            </Opcion>
            {otraPersona && (
              <label className="ca-campo">
                <span>Nombre</span>
                <input className="text-input" autoFocus value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Nombre" />
              </label>
            )}
          </div>
        </>
      )}
      {paso === "monto" && (
        <>
          <h2 className="ca-pregunta">{guardadas.length ? "¿Otra transferencia?" : "¿De cuánto es la transferencia?"}</h2>
          <p className="ca-ayuda">
            {corte ? `Del corte de ${corte.nombre}: se rebaja de su entrega (${money(corte.total)}).` : `A nombre de ${quien || "—"}.`} Si son varias, súmalas con +.
          </p>
          <ListaAgregados
            filas={guardadas.map((x) => ({ id: x.id, titulo: x.persona, detalle: x.corte ? "guardada · se rebajó de su corte" : "guardada", monto: x.total }))}
          />
          <div className="ca-grande-suma">
            <SumInput value={monto} onChange={setMonto} onPartes={setDesglose} placeholder="$0.00 o 300+450" sumar />
          </div>
          {aviso && <p className="aviso-faltante">{aviso}</p>}
        </>
      )}
    </MarcoAsistente>
  );
}
