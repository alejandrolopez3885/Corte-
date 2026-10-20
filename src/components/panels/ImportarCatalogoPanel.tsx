import { useMemo, useState } from "react";
import { ArrowLeft, FileSpreadsheet, TriangleAlert } from "lucide-react";
import { money, normalizarNombre } from "../../lib/dataModel";
import { areaSugerida, compararCatalogo, leerHoja, leerPreciosBase, seDidePor, unidadDe } from "../../lib/excelPrecios";
import type { CambioCatalogo } from "../../lib/excelPrecios";
import type { InsumoArea, InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";

// Lo que se manda a guardar: insumos nuevos o actualizados y los nombres
// de proveedores que hay que crear (se crean y ligan en el mismo persist).
export interface ImportacionCatalogo {
  insumos: { existenteId?: string; nombre: string; area: InsumoArea; unidad: string; precio: number; unidadPedido?: string; proveedor: string; pendiente?: string }[];
}

type Filtro = "todos" | "nuevo" | "cambia" | "pendiente";

const AREAS: { value: InsumoArea; label: string }[] = [
  { value: "cocina", label: "Cocina" },
  { value: "bar", label: "Bar" },
  { value: "general", label: "General" },
];

// Negocio > Compras > Importar catálogo: lee la hoja "PRECIOS BASE" del
// Excel del jefe y deja revisar qué cambia antes de guardar nada. Los
// insumos de la app que no vienen en el Excel no se tocan.
export function ImportarCatalogoPanel({
  onBack,
  insumos,
  proveedores,
  onImportar,
}: {
  onBack: () => void;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  onImportar: (imp: ImportacionCatalogo) => void;
}) {
  const [archivo, setArchivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cambios, setCambios] = useState<CambioCatalogo[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  // Área elegida para los nuevos y respuesta a "¿Es el mismo?" (por índice).
  const [areas, setAreas] = useState<Record<number, InsumoArea>>({});
  const [noEsElMismo, setNoEsElMismo] = useState<Record<number, boolean>>({});
  const [importados, setImportados] = useState<number | null>(null);

  async function elegir(file: File | undefined) {
    if (!file) return;
    setArchivo(file.name);
    setError(null);
    setCambios(null);
    setImportados(null);
    setAreas({});
    setNoEsElMismo({});
    try {
      const filas = leerHoja(await file.arrayBuffer(), "PRECIOS BASE");
      if (!filas) {
        setError("No encontré la hoja “PRECIOS BASE” en ese archivo.");
        return;
      }
      const precios = leerPreciosBase(filas);
      if (precios.length === 0) {
        setError("La hoja “PRECIOS BASE” no tiene insumos con precio.");
        return;
      }
      setCambios(compararCatalogo(precios, insumos, proveedores));
    } catch {
      setError("No pude leer ese archivo. Tiene que ser un Excel .xlsx o .xlsm.");
    }
  }

  // Con "No, crear nuevo" un parecido pasa a ser un insumo nuevo.
  const efectivos = useMemo(
    () =>
      (cambios || []).map((c, i) => {
        if (c.parecido && noEsElMismo[i]) return { ...c, tipo: "nuevo" as const, parecido: undefined, diferencias: [], area: areas[i] ?? areaSugerida(c.fila), i };
        return { ...c, area: areas[i] ?? c.area, i };
      }),
    [cambios, areas, noEsElMismo]
  );

  const nuevosProveedores = useMemo(() => {
    const conocidos = new Set(proveedores.map((p) => normalizarNombre(p.nombre)));
    const nombres = new Set<string>();
    efectivos.forEach((c) => {
      const n = c.fila.proveedor.trim();
      if (c.tipo !== "igual" && n && !conocidos.has(normalizarNombre(n))) nombres.add(normalizarNombre(n));
    });
    return nombres.size;
  }, [efectivos, proveedores]);

  const cuenta = {
    nuevo: efectivos.filter((c) => c.tipo === "nuevo").length,
    cambia: efectivos.filter((c) => c.tipo === "cambia").length,
    igual: efectivos.filter((c) => c.tipo === "igual").length,
    pendiente: efectivos.filter((c) => c.pendiente && c.tipo !== "igual").length,
  };
  const porImportar = cuenta.nuevo + cuenta.cambia;

  const visibles = efectivos.filter((c) =>
    filtro === "todos" ? c.tipo !== "igual" : filtro === "pendiente" ? c.pendiente && c.tipo !== "igual" : c.tipo === filtro
  );
  const grupos: { nombre: string; items: typeof visibles }[] = [];
  visibles.forEach((c) => {
    // La sección del Excel ya trae el proveedor ("FRACKSA — CONGELADOS…").
    const nombre = c.fila.seccion || c.fila.proveedor || "Sin proveedor";
    const g = grupos.find((x) => x.nombre === nombre);
    if (g) g.items.push(c);
    else grupos.push({ nombre, items: [c] });
  });

  function importar() {
    const lista: ImportacionCatalogo["insumos"] = efectivos
      .filter((c) => c.tipo !== "igual")
      .map((c) => {
        const existente = c.existente || c.parecido;
        const area = existente?.area ?? c.area;
        return {
          existenteId: existente?.id,
          nombre: existente?.nombre ?? c.fila.nombre,
          area,
          unidad: unidadDe(c.fila.presentacion, area),
          precio: c.fila.precio,
          unidadPedido: seDidePor(c.fila.presentacion),
          proveedor: c.fila.proveedor.trim(),
          pendiente: c.pendiente ? c.fila.nota : undefined,
        };
      });
    onImportar({ insumos: lista });
    setImportados(lista.length);
    setCambios(null);
  }

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Importar catálogo</h2>
      <p className="hint">
        Elige el Excel de inventario de Johnster: se lee la hoja “PRECIOS BASE” y se compara contra tu catálogo. Nada se guarda hasta
        que confirmes.
      </p>

      <label className="importar-drop">
        <input type="file" accept=".xlsx,.xlsm" onChange={(e) => elegir(e.target.files?.[0])} />
        <FileSpreadsheet size={22} />
        <strong>{archivo ? "Elegir otro archivo" : "Elegir archivo de Excel"}</strong>
        <span>.xlsx o .xlsm</span>
      </label>
      {archivo && (
        <div className="importar-archivo">
          <FileSpreadsheet size={16} /> <span>{archivo}</span>
          {cambios && <em>✓ leído</em>}
        </div>
      )}
      {error && <p className="importar-error">{error}</p>}
      {importados !== null && (
        <p className="importar-listo">✓ Se importaron {importados} insumos. Los ves en Control de Bar, Cocina y General.</p>
      )}

      {cambios && (
        <>
          <div className="importar-kpis">
            <div className="good">
              <b>{cuenta.nuevo}</b>
              <span>insumos nuevos</span>
            </div>
            <div className="warn">
              <b>{cuenta.cambia}</b>
              <span>con precio o datos distintos</span>
            </div>
            <div>
              <b>{cuenta.igual}</b>
              <span>iguales (sin cambios)</span>
            </div>
            <div>
              <b>{nuevosProveedores}</b>
              <span>proveedores nuevos</span>
            </div>
          </div>
          {cuenta.pendiente > 0 && (
            <div className="importar-pendientes">
              <TriangleAlert size={16} />
              <div>
                <strong>{cuenta.pendiente} con datos pendientes en el Excel</strong>
                <span>Se importan marcados para que los completes en su insumo.</span>
              </div>
            </div>
          )}

          <div className="actividad-chips">
            {(
              [
                ["todos", `Todos ${porImportar}`],
                ["nuevo", `Nuevos ${cuenta.nuevo}`],
                ["cambia", `Cambian ${cuenta.cambia}`],
                ["pendiente", `Pendientes ${cuenta.pendiente}`],
              ] as [Filtro, string][]
            ).map(([f, txt]) => (
              <button key={f} className={filtro === f ? "on" : ""} onClick={() => setFiltro(f)}>
                {txt}
              </button>
            ))}
          </div>

          {grupos.length === 0 && <p className="hint">Nada en este filtro.</p>}
          {grupos.map((g) => (
            <div className="insumos-grupo" key={g.nombre}>
              <h3 className="insumos-grupo-titulo">{g.nombre}</h3>
              <div className="importar-lista">
                {g.items.map((c) => (
                  <div className="importar-item" key={c.i}>
                    <div className="importar-item-top">
                      <strong>{c.fila.nombre}</strong>
                      {c.parecido ? (
                        <span className="importar-tag warn">¿Es el mismo?</span>
                      ) : c.tipo === "nuevo" ? (
                        <span className="importar-tag good">Nuevo</span>
                      ) : c.tipo === "cambia" ? (
                        <span className="importar-tag warn">Cambia</span>
                      ) : (
                        <span className="importar-tag">Igual</span>
                      )}
                      {c.pendiente && <span className="importar-tag bad">Pendiente</span>}
                    </div>
                    {c.parecido && (
                      <div className="importar-parecido">
                        <span>Parecido a tu “{c.parecido.nombre}”</span>
                        <div className="actividad-chips">
                          <button className={!noEsElMismo[c.i] ? "on" : ""} onClick={() => setNoEsElMismo((m) => ({ ...m, [c.i]: false }))}>
                            Sí, actualizarlo
                          </button>
                          <button className={noEsElMismo[c.i] ? "on" : ""} onClick={() => setNoEsElMismo((m) => ({ ...m, [c.i]: true }))}>
                            No, crear nuevo
                          </button>
                        </div>
                      </div>
                    )}
                    {c.tipo === "nuevo" && (
                      <div className="importar-meta">
                        <span>
                          {seDidePor(c.fila.presentacion) ? (
                            <>
                              Se pide por <b>{seDidePor(c.fila.presentacion)}</b>
                            </>
                          ) : (
                            <b>{unidadDe(c.fila.presentacion, c.area) === "kg" ? "Kg" : "Pieza"}</b>
                          )}{" "}
                          · {money(c.fila.precio)}
                        </span>
                        <select
                          className="importar-area"
                          value={c.area}
                          onChange={(e) => setAreas((a) => ({ ...a, [c.i]: e.target.value as InsumoArea }))}
                        >
                          {AREAS.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {c.tipo === "cambia" &&
                      c.diferencias.map((d) => (
                        <div className="importar-meta" key={d.campo}>
                          <span>
                            {d.campo} <s>{d.antes}</s> → <b className="importar-nuevo">{d.despues}</b>
                          </span>
                        </div>
                      ))}
                    {c.pendiente && <span className="importar-nota">{c.fila.nota}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button className="btn-primary" onClick={importar} disabled={porImportar === 0}>
            {porImportar === 0 ? "Tu catálogo ya está igual al Excel" : `Importar ${porImportar} cambios`}
          </button>
        </>
      )}
    </div>
  );
}
