import { useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { Sheet, Field, Toggle } from "../ui";
import { normalizarNombre, uid } from "../../lib/dataModel";
import type { InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";

// Palabras que no ayudan a saber si dos proveedores son el mismo.
const GENERICAS = new Set(["compras", "compra", "comercial", "comercializadora", "distribuidora", "abarrotes", "de", "del", "la", "el", "los", "las", "y", "sa", "cv"]);

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Nombre parecido: mismo nombre con un error de dedo ("Johnster"/"Johster")
// o uno contenido en otro ("Pan"/"Panadería"), sin contar palabras
// genéricas como "Compras".
function seParecen(a: string, b: string): boolean {
  const pa = normalizarNombre(a).split(" ").filter((w) => w.length >= 3 && !GENERICAS.has(w));
  const pb = normalizarNombre(b).split(" ").filter((w) => w.length >= 3 && !GENERICAS.has(w));
  return pa.some((x) =>
    pb.some((y) => x === y || x.startsWith(y) || y.startsWith(x) || (Math.min(x.length, y.length) >= 4 && distancia(x, y) <= (x.length >= 7 ? 2 : 1)))
  );
}

export function ProveedoresModal({
  onClose,
  proveedores,
  insumos,
  onSave,
  onToggleJueves,
  onRemove,
  onUnir,
}: {
  onClose: () => void;
  proveedores: ProveedorCatalogEntry[];
  insumos: InsumoEntry[];
  onSave: (entry: ProveedorCatalogEntry) => void;
  onToggleJueves: (id: string, incluyeJueves: boolean) => void;
  onRemove: (id: string) => void;
  onUnir: (quedaId: string, seVaId: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  // Unir: el proveedor desde el que se abrió y, si viene de un par
  // sugerido, con cuál.
  const [uniendo, setUniendo] = useState<{ desde: string; con?: string } | null>(null);

  const cuantos = (id: string) => insumos.filter((i) => i.proveedorId === id).length;
  const repetidos: [ProveedorCatalogEntry, ProveedorCatalogEntry][] = [];
  proveedores.forEach((a, i) => proveedores.slice(i + 1).forEach((b) => seParecen(a.nombre, b.nombre) && repetidos.push([a, b])));

  function add() {
    if (!nombre.trim()) return;
    onSave({ id: uid(), nombre: nombre.trim() });
    setNombre("");
  }

  if (uniendo) {
    return (
      <UnirSheet
        desde={uniendo.desde}
        con={uniendo.con}
        proveedores={proveedores}
        cuantos={cuantos}
        onUnir={(queda, seVa) => {
          onUnir(queda, seVa);
          setUniendo(null);
        }}
        onClose={() => setUniendo(null)}
      />
    );
  }

  return (
    <Sheet title="Proveedores" onClose={onClose}>
      <p className="hint">
        Los mismos proveedores que usas en el Catálogo de Bar/Cocina y en Inventario. Un proveedor con insumos asignados
        no se puede eliminar; si está repetido, únelo con el bueno.
      </p>
      {repetidos.length > 0 && (
        <div className="prov-repetidos">
          <strong>
            <TriangleAlert size={15} /> Posibles repetidos
          </strong>
          {repetidos.map(([a, b]) => (
            <div key={`${a.id}-${b.id}`} className="prov-par">
              <span>
                {a.nombre} · {b.nombre}
              </span>
              <button className="prov-par-btn" onClick={() => setUniendo({ desde: a.id, con: b.id })}>
                Unir
              </button>
            </div>
          ))}
          <span className="hint">Los que no se parecen en el nombre (ej. Pollo y JD Alimentos) se unen con "Unir con…".</span>
        </div>
      )}
      <div className="catalog-list">
        {proveedores.length === 0 && <p className="hint">Aún no agregas proveedores.</p>}
        {proveedores.map((p) => {
          const n = cuantos(p.id);
          return (
            <div className="proveedor-row" key={p.id}>
              <div className="proveedor-row-top">
                <strong>
                  {p.nombre}
                  <span className="prov-cuantos">
                    {n} {n === 1 ? "insumo" : "insumos"}
                  </span>
                </strong>
                <span className="prov-acciones">
                  {proveedores.length > 1 && (
                    <button className="link-btn" onClick={() => setUniendo({ desde: p.id })}>
                      Unir con…
                    </button>
                  )}
                  <button
                    className="icon-btn"
                    onClick={() => onRemove(p.id)}
                    disabled={n > 0}
                    aria-label={n > 0 ? `${p.nombre} tiene insumos asignados, no se puede eliminar` : `Eliminar ${p.nombre}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              </div>
              <Toggle
                checked={!!p.incluyeJueves}
                onChange={(v) => onToggleJueves(p.id, v)}
                label="También se cuenta los jueves"
              />
              {(p.apodos || []).length > 0 && <p className="proveedor-row-hint">También se llama: {p.apodos!.join(", ")}</p>}
            </div>
          );
        })}
      </div>
      <div className="field-row">
        <Field label="Nombre">
          <input className="text-input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nuevo proveedor" />
        </Field>
      </div>
      <button className="btn-primary" onClick={add} disabled={!nombre.trim()}>
        Agregar proveedor
      </button>
    </Sheet>
  );
}

function UnirSheet({
  desde,
  con,
  proveedores,
  cuantos,
  onUnir,
  onClose,
}: {
  desde: string;
  con?: string;
  proveedores: ProveedorCatalogEntry[];
  cuantos: (id: string) => number;
  onUnir: (quedaId: string, seVaId: string) => void;
  onClose: () => void;
}) {
  const nombreDe = (id: string) => proveedores.find((p) => p.id === id)?.nombre || "";
  const otros = proveedores.filter((p) => p.id !== desde);
  const [otro, setOtro] = useState(con || "");
  // De inicio se queda el que tiene más insumos.
  const [queda, setQueda] = useState(con ? (cuantos(con) > cuantos(desde) ? con : desde) : "");
  const elegirOtro = (id: string) => {
    setOtro(id);
    setQueda(id ? (cuantos(id) > cuantos(desde) ? id : desde) : "");
  };
  const seVa = queda === desde ? otro : desde;
  const n = seVa ? cuantos(seVa) : 0;

  return (
    <Sheet title="Unir proveedores" onClose={onClose}>
      <p className="hint">
        Une <strong>{nombreDe(desde)}</strong> con:
      </p>
      <select className="text-input" value={otro} onChange={(e) => elegirOtro(e.target.value)}>
        <option value="">Elige el proveedor…</option>
        {otros.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
      {otro && (
        <>
          <p className="hint">¿Cuál nombre se queda?</p>
          {[desde, otro].map((id) => (
            <label key={id} className={`prov-opcion ${queda === id ? "sel" : ""}`}>
              <input type="radio" checked={queda === id} onChange={() => setQueda(id)} />
              {nombreDe(id)}
              <span className="prov-cuantos">
                {cuantos(id)} {cuantos(id) === 1 ? "insumo" : "insumos"}
              </span>
            </label>
          ))}
          <div className="prov-resultado">
            {n > 0 ? (
              <>
                {n === 1 ? "El " : "Los "}
                <strong>
                  {n} {n === 1 ? "insumo" : "insumos"}
                </strong>{" "}
                de {nombreDe(seVa)} {n === 1 ? "pasa" : "pasan"} a <strong>{nombreDe(queda)}</strong> y {nombreDe(seVa)}
              </>
            ) : (
              <>{nombreDe(seVa)} no tiene insumos y</>
            )}{" "}
            desaparece de la lista. "{nombreDe(seVa)}" se guarda como otro nombre de {nombreDe(queda)}, para que al importar
            el Excel no se vuelva a crear. El historial de Inventario y Pedidos no cambia.
          </div>
          <button className="btn-primary" onClick={() => onUnir(queda, seVa)}>
            Unir en {nombreDe(queda)}
          </button>
        </>
      )}
      <button className="link-btn prov-cancelar" onClick={onClose}>
        Cancelar
      </button>
    </Sheet>
  );
}
