import { useState } from "react";
import { ArrowLeft, BookOpen, ChevronRight, Pencil, Plus, Search } from "lucide-react";
import { Empty, Field, Sheet } from "../ui";
import { normalizar } from "../../lib/gastosBusqueda";
import { uid } from "../../lib/dataModel";
import type { Receta } from "../../lib/types";

// Recetario: lista de recetas con buscador y la receta completa en una
// pantalla (vaso, ingredientes con medida, utensilios, preparación y
// decoración/notas). El dueño las agrega y edita (onSave/onRemove); el
// personal con el permiso "Recetario" solo las consulta.

// "2 oz Tequila blanco" → medida "2 oz", producto "Tequila blanco". Si el
// renglón no empieza con una cantidad (ej. "Hielo al gusto"), se intenta
// separar "al gusto"; si no, va todo como producto.
const UNIDADES =
  "oz|onzas?|ml|cl|lt?s?|litros?|g|gr|grs|gramos?|kg|pz|pzas?|piezas?|cdas?|cucharadas?|cditas?|cucharaditas?|dash(?:es)?|gotas?|tazas?|rodajas?|hojas?|ramitas?|chorritos?|shots?|tragos?";
const RE_MEDIDA = new RegExp(`^((?:\\d+(?:[.,]\\d+)?|[½¼¾⅓⅔]|\\d+\\/\\d+)(?:\\s*(?:[½¼¾⅓⅔]|\\d+\\/\\d+))?\\s*(?:(?:${UNIDADES})\\b\\.?)?)\\s+(.+)$`, "i");

function partirIngrediente(renglon: string): { medida: string; producto: string } {
  const r = renglon.trim();
  const m = r.match(RE_MEDIDA);
  if (m) return { medida: m[1].trim(), producto: m[2].trim() };
  const gusto = r.match(/^(.+?)\s+(al gusto|c\/s|cantidad suficiente)$/i);
  if (gusto) return { medida: gusto[2], producto: gusto[1] };
  return { medida: "", producto: r };
}

const renglones = (t: string) =>
  t
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export function RecetarioPanel({
  onBack,
  backLabel,
  titulo,
  recetas,
  area,
  onSave,
  onRemove,
}: {
  // Sin onBack (cuenta de equipo con una sola sección) no hay "regresar".
  onBack?: () => void;
  backLabel: string;
  titulo: string;
  recetas: Receta[];
  // Área de las recetas nuevas (solo para quien edita).
  area?: Receta["area"];
  onSave?: (receta: Receta) => void;
  onRemove?: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Receta | "nueva" | null>(null);
  const editable = !!onSave;

  const abierta = recetas.find((r) => r.id === abiertaId);
  const q = normalizar(busqueda);
  const lista = [...recetas]
    .filter((r) => !q || normalizar(`${r.nombre} ${r.ingredientes}`).includes(q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const formulario = editando && onSave && (
    <RecetaModal
      editing={editando === "nueva" ? undefined : editando}
      area={area || "bar"}
      onClose={() => setEditando(null)}
      onSave={(r) => {
        onSave(r);
        setEditando(null);
        setAbiertaId(r.id);
      }}
      onDelete={
        editando !== "nueva" && onRemove
          ? () => {
              onRemove(editando.id);
              setEditando(null);
              setAbiertaId(null);
            }
          : undefined
      }
    />
  );

  if (abierta) {
    const ingredientes = renglones(abierta.ingredientes).map(partirIngrediente);
    const utensilios = abierta.utensilios
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    const pasos = renglones(abierta.preparacion);
    return (
      <div className="page-section">
        <button className="link-btn back-link" onClick={() => setAbiertaId(null)}>
          <ArrowLeft size={15} /> {titulo}
        </button>
        <div className="receta-encabezado">
          <h2 className="page-title">{abierta.nombre}</h2>
          {editable && (
            <button className="icon-btn" aria-label="Editar receta" onClick={() => setEditando(abierta)}>
              <Pencil size={16} />
            </button>
          )}
        </div>
        <div className="receta-detalle">
          {abierta.vaso && (
            <div className="receta-caja">
              <h5>Vaso</h5>
              <p>{abierta.vaso}</p>
            </div>
          )}
          {ingredientes.length > 0 && (
            <div className="receta-caja">
              <h5>Ingredientes</h5>
              {ingredientes.map((ing, i) => (
                <div key={i} className="receta-ingrediente">
                  <span>{ing.producto}</span>
                  {ing.medida && <strong>{ing.medida}</strong>}
                </div>
              ))}
            </div>
          )}
          {utensilios.length > 0 && (
            <div className="receta-caja">
              <h5>Utensilios</h5>
              <div className="receta-chips">
                {utensilios.map((u) => (
                  <span key={u}>{u}</span>
                ))}
              </div>
            </div>
          )}
          {pasos.length > 0 && (
            <div className="receta-caja">
              <h5>Preparación</h5>
              <ol>
                {pasos.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </div>
          )}
          {abierta.notas.trim() && (
            <div className="receta-caja">
              <h5>Decoración / notas</h5>
              <p>{abierta.notas}</p>
            </div>
          )}
        </div>
        {formulario}
      </div>
    );
  }

  return (
    <div className="page-section">
      {onBack && (
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
      )}
      <div className="receta-encabezado">
        <h2 className="page-title">{titulo}</h2>
        {editable && (
          <button className="icon-btn accent" aria-label="Nueva receta" onClick={() => setEditando("nueva")}>
            <Plus size={18} />
          </button>
        )}
      </div>
      {recetas.length > 0 && (
        <div className="receta-buscar">
          <Search size={15} />
          <input
            className="text-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar bebida o ingrediente…"
            autoComplete="off"
          />
        </div>
      )}
      {recetas.length === 0 ? (
        <Empty
          icon={<BookOpen size={26} strokeWidth={1.3} />}
          text={editable ? "Aún no hay recetas. Agrega la primera con el botón +." : "Todavía no hay recetas. El dueño las irá agregando."}
        />
      ) : lista.length === 0 ? (
        <p className="hint">No hay recetas que coincidan con "{busqueda}".</p>
      ) : (
        <div className="card-list">
          {lista.map((r) => (
            <button key={r.id} className="card receta-card" onClick={() => setAbiertaId(r.id)}>
              <span className="card-name">{r.nombre}</span>
              <span className="receta-card-vaso">
                {r.vaso} <ChevronRight size={14} />
              </span>
            </button>
          ))}
        </div>
      )}
      {formulario}
    </div>
  );
}

function RecetaModal({
  editing,
  area,
  onClose,
  onSave,
  onDelete,
}: {
  editing?: Receta;
  area: Receta["area"];
  onClose: () => void;
  onSave: (r: Receta) => void;
  onDelete?: () => void;
}) {
  const [nombre, setNombre] = useState(editing?.nombre || "");
  const [vaso, setVaso] = useState(editing?.vaso || "");
  const [ingredientes, setIngredientes] = useState(editing?.ingredientes || "");
  const [utensilios, setUtensilios] = useState(editing?.utensilios || "");
  const [preparacion, setPreparacion] = useState(editing?.preparacion || "");
  const [notas, setNotas] = useState(editing?.notas || "");

  return (
    <Sheet title={editing ? "Editar receta" : "Nueva receta"} onClose={onClose} onDelete={onDelete}>
      <Field label="Nombre">
        <input className="text-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Margarita" />
      </Field>
      <Field label="Vaso">
        <input className="text-input" value={vaso} onChange={(e) => setVaso(e.target.value)} placeholder="Ej. Copa margarita, escarchada con sal" />
      </Field>
      <Field label="Ingredientes (uno por renglón: medida y producto)">
        <textarea
          className="text-input receta-textarea"
          rows={5}
          value={ingredientes}
          onChange={(e) => setIngredientes(e.target.value)}
          placeholder={"2 oz Tequila blanco\n1 oz Triple sec\n1 oz Jugo de limón"}
        />
      </Field>
      <Field label="Utensilios (separados por coma)">
        <input className="text-input" value={utensilios} onChange={(e) => setUtensilios(e.target.value)} placeholder="Ej. Coctelera, Jigger, Colador" />
      </Field>
      <Field label="Preparación (un paso por renglón)">
        <textarea
          className="text-input receta-textarea"
          rows={4}
          value={preparacion}
          onChange={(e) => setPreparacion(e.target.value)}
          placeholder={"Escarchar la copa con sal.\nAgitar todo con hielo 10 segundos.\nColar a la copa."}
        />
      </Field>
      <Field label="Decoración / notas (opcional)">
        <input className="text-input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Rodaja de limón" />
      </Field>
      <button
        className="btn-primary"
        disabled={!nombre.trim()}
        onClick={() =>
          onSave({
            id: editing?.id || uid(),
            area: editing?.area || area,
            nombre: nombre.trim(),
            vaso: vaso.trim(),
            ingredientes,
            utensilios,
            preparacion,
            notas: notas.trim(),
          })
        }
      >
        Guardar receta
      </button>
    </Sheet>
  );
}
