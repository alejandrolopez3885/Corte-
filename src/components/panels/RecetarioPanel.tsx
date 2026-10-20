import { useState } from "react";
import { ArrowLeft, BookOpen, ChevronRight, Pencil, Plus, Search, Upload } from "lucide-react";
import { Empty, Field, Sheet } from "../ui";
import { normalizar } from "../../lib/gastosBusqueda";
import { uid } from "../../lib/dataModel";
import { EJEMPLO_RECETAS, leerRecetas, type RecetaLeida } from "../../lib/recetasTexto";
import type { Receta } from "../../lib/types";

// Recetario: lista de recetas con buscador y la receta completa en una
// pantalla (vaso, ingredientes con medida, utensilios, preparación y
// decoración/notas). El dueño las agrega y edita (onSave/onRemove); el
// personal con el permiso "Recetario" solo las consulta.

// "2 oz Tequila blanco" → medida "2 oz", producto "Tequila blanco". Si el
// renglón no empieza con una cantidad (ej. "Hielo al gusto"), se intenta
// separar "al gusto"; si no, va todo como producto.
const UNIDADES =
  "oz|onzas?|ml|cl|lt?s?|litros?|g|gr|grs|gramos?|kg|pz|pzas?|piezas?|cdas?|cucharadas?|cditas?|cucharaditas?|dash(?:es)?|gotas?|tazas?|rodajas?|hojas?|ramitas?|chorritos?|shots?|tragos?|tri[aá]ngulos?|pizcas?";
const RE_MEDIDA = new RegExp(`^((?:\\d+(?:[.,]\\d+)?|[½¼¾⅓⅔]|\\d+\\/\\d+)(?:\\s*(?:[½¼¾⅓⅔]|\\d+\\/\\d+))?\\s*(?:(?:${UNIDADES})\\b\\.?)?)\\s+(.+)$`, "i");

function partirIngrediente(renglon: string): { medida: string; producto: string } {
  const r = renglon.trim();
  const m = r.match(RE_MEDIDA);
  if (m) return { medida: m[1].trim(), producto: m[2].trim() };
  const gusto = r.match(/^(.+?)\s+(al gusto|c\/s|cantidad suficiente)$/i);
  if (gusto) return { medida: gusto[2], producto: gusto[1] };
  return { medida: "", producto: r };
}

const AREAS: { value: Receta["area"]; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "cocina", label: "Cocina" },
];

// En Cocina no hay vaso: el mismo campo se llama "Presentación".
const etiquetaVaso = (area: Receta["area"]) => (area === "cocina" ? "Presentación" : "Vaso");

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
  onSaveVarias,
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
  // "Cargar varias": agrega/reemplaza varias recetas de un jalón.
  onSaveVarias?: (recetas: Receta[]) => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Receta | "nueva" | null>(null);
  const editable = !!onSave;

  const abierta = recetas.find((r) => r.id === abiertaId);
  const hayDosAreas = AREAS.every((a) => recetas.some((r) => r.area === a.value));
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

  const cargarVarias = cargando && onSaveVarias && (
    <CargarVariasModal
      existentes={recetas}
      area={area || "bar"}
      onClose={() => setCargando(false)}
      onGuardar={(lista) => {
        onSaveVarias(lista);
        setCargando(false);
      }}
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
              <h5>{etiquetaVaso(abierta.area)}</h5>
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
      {onSaveVarias && (
        <button type="button" className="receta-cargar" onClick={() => setCargando(true)}>
          <Upload size={14} /> Cargar varias
        </button>
      )}
      {recetas.length > 0 && (
        <div className="receta-buscar">
          <Search size={15} />
          <input
            className="text-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={area === "bar" ? "Buscar bebida o ingrediente…" : area === "cocina" ? "Buscar platillo o ingrediente…" : "Buscar receta o ingrediente…"}
            autoComplete="off"
          />
        </div>
      )}
      {recetas.length === 0 ? (
        <Empty
          icon={<BookOpen size={26} strokeWidth={1.3} />}
          text={editable ? "Aún no hay recetas. Agrega la primera con el botón + o carga varias de una vez." : "Todavía no hay recetas. El dueño las irá agregando."}
        />
      ) : lista.length === 0 ? (
        <p className="hint">No hay recetas que coincidan con "{busqueda}".</p>
      ) : (
        // Con recetas de Bar y de Cocina (vista del personal), separadas por área.
        (hayDosAreas ? AREAS : [null]).map((a) => {
          const deArea = a ? lista.filter((r) => r.area === a.value) : lista;
          if (deArea.length === 0) return null;
          return (
            <div key={a?.value || "todas"}>
              {a && <h3 className="receta-grupo">{a.label}</h3>}
              <div className="card-list">
                {deArea.map((r) => (
                  <button key={r.id} className="card receta-card" onClick={() => setAbiertaId(r.id)}>
                    <span className="card-name">{r.nombre}</span>
                    <span className="receta-card-vaso">
                      {r.vaso} <ChevronRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}
      {formulario}
      {cargarVarias}
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
  const areaReceta = editing?.area || area;
  const esCocina = areaReceta === "cocina";

  return (
    <Sheet title={editing ? "Editar receta" : "Nueva receta"} onClose={onClose} onDelete={onDelete}>
      <Field label="Nombre">
        <input className="text-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={esCocina ? "Ej. Enchiladas verdes" : "Ej. Margarita"} />
      </Field>
      <Field label={etiquetaVaso(areaReceta)}>
        <input
          className="text-input"
          value={vaso}
          onChange={(e) => setVaso(e.target.value)}
          placeholder={esCocina ? "Ej. Plato extendido, con arroz al lado" : "Ej. Copa margarita, escarchada con sal"}
        />
      </Field>
      <Field label="Ingredientes (uno por renglón: medida y producto)">
        <textarea
          className="text-input receta-textarea"
          rows={5}
          value={ingredientes}
          onChange={(e) => setIngredientes(e.target.value)}
          placeholder={esCocina ? "3 pz Tortilla\n150 g Pollo deshebrado\n120 ml Salsa verde" : "2 oz Tequila blanco\n1 oz Triple sec\n1 oz Jugo de limón"}
        />
      </Field>
      <Field label="Utensilios (separados por coma)">
        <input className="text-input" value={utensilios} onChange={(e) => setUtensilios(e.target.value)} placeholder={esCocina ? "Ej. Sartén, Pinzas, Cucharón" : "Ej. Coctelera, Jigger, Colador"} />
      </Field>
      <Field label="Preparación (un paso por renglón)">
        <textarea
          className="text-input receta-textarea"
          rows={4}
          value={preparacion}
          onChange={(e) => setPreparacion(e.target.value)}
          placeholder={
            esCocina
              ? "Calentar las tortillas.\nRellenar con pollo y enrollar.\nBañar con salsa y gratinar."
              : "Escarchar la copa con sal.\nAgitar todo con hielo 10 segundos.\nColar a la copa."
          }
        />
      </Field>
      <Field label="Decoración / notas (opcional)">
        <input className="text-input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={esCocina ? "Ej. Crema, queso y cebolla morada" : "Ej. Rodaja de limón"} />
      </Field>
      <button
        className="btn-primary"
        disabled={!nombre.trim()}
        onClick={() =>
          onSave({
            id: editing?.id || uid(),
            area: areaReceta,
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

// Pegar varias recetas en texto (formato en lib/recetasTexto.ts), revisar lo
// que se entendió y agregarlas todas. Si un nombre ya existe en este
// recetario, se elige si se reemplaza (misma receta, se conserva su id) o
// se salta.
function CargarVariasModal({
  existentes,
  area,
  onClose,
  onGuardar,
}: {
  existentes: Receta[];
  area: Receta["area"];
  onClose: () => void;
  onGuardar: (recetas: Receta[]) => void;
}) {
  const [texto, setTexto] = useState("");
  const [leidas, setLeidas] = useState<RecetaLeida[] | null>(null);
  const [saltar, setSaltar] = useState<Set<number>>(new Set());
  const [verEjemplo, setVerEjemplo] = useState(false);

  const clave = (n: string) => normalizar(n);
  const existente = (r: RecetaLeida) => existentes.find((e) => clave(e.nombre) === clave(r.nombre));

  if (leidas) {
    const repetidas = leidas.filter((r) => existente(r)).length;
    const aGuardar = leidas.filter((_, i) => !saltar.has(i));
    return (
      <Sheet title="Cargar varias recetas" onClose={onClose}>
        {leidas.length === 0 ? (
          <p className="hint">
            No se encontró ninguna receta. Cada receta tiene que empezar con un renglón que empiece con "#" y el nombre.
          </p>
        ) : (
          <p className="receta-carga-resumen">
            <strong>
              {leidas.length} {leidas.length === 1 ? "receta" : "recetas"}
            </strong>{" "}
            encontradas · {leidas.length - repetidas} {leidas.length - repetidas === 1 ? "nueva" : "nuevas"}
            {repetidas > 0 && ` · ${repetidas} ya ${repetidas === 1 ? "existe" : "existen"}`}
          </p>
        )}
        <div className="receta-carga-lista">
          {leidas.map((r, i) => {
            const ya = existente(r);
            const nIng = renglones(r.ingredientes).length;
            const nPasos = renglones(r.preparacion).length;
            return (
              <div key={i} className={`receta-carga-item${ya ? " repetida" : ""}`}>
                <span>
                  <strong>{r.nombre}</strong>
                  <small>
                    {ya
                      ? "Ya existe en el recetario"
                      : `${nIng} ${nIng === 1 ? "ingrediente" : "ingredientes"} · ${nPasos} ${nPasos === 1 ? "paso" : "pasos"}`}
                  </small>
                </span>
                {ya ? (
                  <span className="receta-carga-opciones">
                    {(["Reemplazar", "Saltar"] as const).map((op) => {
                      const activo = op === "Saltar" ? saltar.has(i) : !saltar.has(i);
                      return (
                        <button
                          key={op}
                          type="button"
                          className={activo ? "activo" : ""}
                          onClick={() =>
                            setSaltar((prev) => {
                              const next = new Set(prev);
                              if (op === "Saltar") next.add(i);
                              else next.delete(i);
                              return next;
                            })
                          }
                        >
                          {op}
                        </button>
                      );
                    })}
                  </span>
                ) : (
                  <span className="receta-carga-nueva">Nueva</span>
                )}
              </div>
            );
          })}
        </div>
        <button
          className="btn-primary"
          disabled={aGuardar.length === 0}
          onClick={() =>
            onGuardar(
              aGuardar.map((r) => {
                const ya = existente(r);
                return { ...r, id: ya?.id || uid(), area: ya?.area || area };
              })
            )
          }
        >
          Agregar {aGuardar.length} {aGuardar.length === 1 ? "receta" : "recetas"}
        </button>
        <button type="button" className="link-btn receta-carga-volver" onClick={() => setLeidas(null)}>
          <ArrowLeft size={14} /> Volver a editar el texto
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title="Cargar varias recetas" onClose={onClose}>
      <p className="hint">
        Pega todas las recetas. Cada una empieza con "#" y el nombre; abajo van Vaso, Ingredientes (uno por renglón),
        Utensilios, Preparación (un paso por renglón) y Notas. Las secciones que no pongas se quedan vacías.
      </p>
      <textarea
        className="text-input receta-textarea receta-carga-texto"
        rows={14}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={EJEMPLO_RECETAS}
      />
      <button type="button" className="link-btn" onClick={() => setVerEjemplo((v) => !v)}>
        {verEjemplo ? "Ocultar ejemplo del formato" : "Ver ejemplo del formato"}
      </button>
      {verEjemplo && <pre className="receta-carga-ejemplo">{EJEMPLO_RECETAS}</pre>}
      <button
        className="btn-primary"
        disabled={!texto.trim()}
        onClick={() => {
          setSaltar(new Set());
          setLeidas(leerRecetas(texto));
        }}
      >
        Revisar
      </button>
    </Sheet>
  );
}
