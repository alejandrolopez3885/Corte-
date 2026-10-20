import { useState } from "react";
import { ArrowLeft, Package, TriangleAlert } from "lucide-react";
import { Empty, Field, Sheet } from "../ui";
import { ErroresSheet, ListaPorProveedor, type ErroresCaptura } from "./ConteoDiarioPanel";
import { dateForDay, formatLongDayDate, formatWeekRange, resolveWeekStartDate, todayIso, type LineaConteoTexto } from "../../lib/dataModel";
import { leerNotasInventario, type RenglonInventario } from "../../lib/inventarioNotas";
import type { InsumoEntry, MonthData, ProveedorCatalogEntry } from "../../lib/types";

type Modo = "completo" | "jueves";

function esHoyJueves(): boolean {
  return new Date(`${todayIso()}T00:00:00`).getDay() === 4;
}

// Del catálogo que tocaba contar (todos el domingo; el jueves, solo los de
// proveedores marcados) y no aparece en las notas — sin los de alta
// rotación, que se cuentan aparte en el Conteo diario.
function faltantesPorContar(
  insumos: InsumoEntry[],
  proveedores: ProveedorCatalogEntry[],
  modo: Modo,
  contados: Set<string>
): InsumoEntry[] {
  const proveedoresDelModo = new Set(proveedores.filter((p) => modo === "completo" || p.incluyeJueves).map((p) => p.id));
  return insumos.filter(
    (i) =>
      !i.altaRotacion &&
      !contados.has(i.id) &&
      (modo === "completo" || (i.proveedorId !== undefined && proveedoresDelModo.has(i.proveedorId)))
  );
}

// Inventario completo (domingo) / parcial (jueves) en notas libres: el
// cuadro arranca vacío y quien cuenta escribe lo que va viendo, un producto
// por renglón. Ya guardado, cada renglón se liga con el catálogo para
// separarlo por proveedor, con su recuadro "Pedir" y "Copiar pedido" igual
// que en el Conteo diario. Se guarda por la fecha real del modo (el domingo
// o el jueves de esa semana).
export function InventarioNotasPanel({
  onBack,
  backLabel,
  insumos,
  proveedores,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  notas,
  onGuardarNotas,
  pedidos,
  onGuardarPedido,
  onAsignarApodo,
  onEditarProveedores,
}: {
  onBack?: () => void;
  backLabel: string;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  notas: Record<string, string>;
  onGuardarNotas: (fecha: string, texto: string) => void;
  pedidos: Record<string, Record<string, number>>;
  onGuardarPedido: (fecha: string, pedido: Record<string, number>) => void;
  onAsignarApodo: (insumoId: string, apodo: string) => void;
  onEditarProveedores?: () => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [modo, setModo] = useState<Modo>(() => (esHoyJueves() ? "jueves" : "completo"));

  const month = months[monthKey] || null;

  if (monthKeys.length === 0 || !month) {
    return (
      <div className="page-section">
        {onBack && (
          <button className="link-btn back-link" onClick={onBack}>
            <ArrowLeft size={15} /> {backLabel}
          </button>
        )}
        <h2 className="page-title">Inventario</h2>
        <Empty icon={<Package size={26} strokeWidth={1.3} />} text="Primero crea un mes en Corte para poder llevar el inventario." />
      </div>
    );
  }

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const fecha = dateForDay(monthKey, weekIndex, month, modo === "completo" ? "Domingo" : "Jueves");

  return (
    <div className="page-section">
      {onBack && (
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
      )}
      <h2 className="page-title">Inventario</h2>

      <div className="field-row">
        <Field label="Mes">
          <select
            className="text-input"
            value={monthKey}
            onChange={(e) => {
              setMonthKey(e.target.value);
              setWeekIndex(0);
            }}
          >
            {monthKeys.map((mk) => (
              <option key={mk} value={mk}>
                {months[mk].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Semana">
          <select className="text-input" value={weekIndex} onChange={(e) => setWeekIndex(Number(e.target.value))}>
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                Semana {i + 1}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="hint">{formatWeekRange(weekStartDate)}</p>

      <div className="segmented">
        <button type="button" className={modo === "completo" ? "active" : ""} onClick={() => setModo("completo")}>
          Completo (domingo)
        </button>
        <button type="button" className={modo === "jueves" ? "active" : ""} onClick={() => setModo("jueves")}>
          Jueves
        </button>
      </div>
      {onEditarProveedores && (
        <button className="link-btn" onClick={onEditarProveedores}>
          Editar proveedores del jueves
        </button>
      )}
      <p className="active-day-date">{formatLongDayDate(fecha)}</p>

      <NotasForm
        key={fecha}
        fecha={fecha}
        modo={modo}
        guardado={notas[fecha]}
        insumos={insumos}
        proveedores={proveedores}
        onGuardarNotas={onGuardarNotas}
        pedidoGuardado={pedidos[fecha]}
        onGuardarPedido={onGuardarPedido}
        onAsignarApodo={onAsignarApodo}
      />
    </div>
  );
}

function NotasForm({
  fecha,
  modo,
  guardado,
  insumos,
  proveedores,
  onGuardarNotas,
  pedidoGuardado,
  onGuardarPedido,
  onAsignarApodo,
}: {
  fecha: string;
  modo: Modo;
  guardado?: string;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  onGuardarNotas: (fecha: string, texto: string) => void;
  pedidoGuardado?: Record<string, number>;
  onGuardarPedido: (fecha: string, pedido: Record<string, number>) => void;
  onAsignarApodo: (insumoId: string, apodo: string) => void;
}) {
  const [texto, setTexto] = useState(guardado ?? "");
  const [locked, setLocked] = useState(guardado !== undefined);
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false);
  const [errores, setErrores] = useState<ErroresCaptura | null>(null);
  const [faltantes, setFaltantes] = useState<InsumoEntry[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  // Solo bloquea un renglón con texto pero sin cantidad; lo que no se
  // reconoce en el catálogo se resuelve después de guardar. Si falta por
  // contar algo del catálogo, antes se pregunta si es que no hay.
  function guardar() {
    if (!texto.trim()) return;
    const { renglones, sinCantidad } = leerNotasInventario(texto, insumos);
    if (sinCantidad.length > 0) {
      setErrores({ titulo: "Renglones sin cantidad", faltan: sinCantidad, invalidas: [] });
      return;
    }
    const contados = new Set(renglones.flatMap((r) => (r.insumoId ? [r.insumoId] : [])));
    const faltan = faltantesPorContar(insumos, proveedores, modo, contados);
    if (faltan.length > 0) {
      setFaltantes(faltan);
      setMarcados(new Set(faltan.map((i) => i.id)));
      return;
    }
    guardarTexto(texto);
  }

  function guardarTexto(t: string) {
    setTexto(t);
    onGuardarNotas(fecha, t);
    setLocked(true);
  }

  // Los marcados como "no hay" se agregan al final de las notas en 0, para
  // que salgan en la lista de abajo y se puedan pedir.
  function guardarConCeros() {
    const ceros = (faltantes || []).filter((i) => marcados.has(i.id)).map((i) => `0 ${i.nombre}`);
    setFaltantes(null);
    guardarTexto(ceros.length > 0 ? `${texto.trimEnd()}\n${ceros.join("\n")}` : texto);
  }

  return (
    <>
      {locked && (
        <div className="conteo-locked-banner">
          <span>Inventario guardado y bloqueado.</span>
          <button className="link-btn" onClick={() => setPidiendoConfirmacion(true)}>
            Editar
          </button>
        </div>
      )}
      <textarea
        className="text-input conteo-texto"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={Math.max(12, texto.split("\n").length + 2)}
        placeholder={"Escribe lo que vas contando, un producto por renglón:\n25 vasos litro\n.6 consomé\n1k ajo en polvo"}
        disabled={locked}
      />
      {!locked && (
        <>
          <p className="hint">Un producto por renglón, con la cantidad como lo cuentes.</p>
          <button className="btn-primary" onClick={guardar} disabled={!texto.trim()}>
            Guardar inventario
          </button>
        </>
      )}

      {locked && guardado !== undefined && (
        <Resultado
          fecha={fecha}
          modo={modo}
          notas={guardado}
          insumos={insumos}
          proveedores={proveedores}
          pedidoGuardado={pedidoGuardado}
          onGuardarPedido={onGuardarPedido}
          onAsignarApodo={onAsignarApodo}
        />
      )}

      {errores && <ErroresSheet errores={errores} onClose={() => setErrores(null)} />}

      {faltantes && (
        <FaltanPorContarSheet
          modo={modo}
          faltantes={faltantes}
          proveedores={proveedores}
          marcados={marcados}
          onToggle={(id) =>
            setMarcados((m) => {
              const n = new Set(m);
              if (n.has(id)) n.delete(id);
              else n.add(id);
              return n;
            })
          }
          onGuardar={guardarConCeros}
          onClose={() => setFaltantes(null)}
        />
      )}

      {pidiendoConfirmacion && (
        <Sheet title="Editar inventario guardado" onClose={() => setPidiendoConfirmacion(false)}>
          <p className="hint">
            Este inventario de {formatLongDayDate(fecha)} ya se guardó. No deberías editarlo salvo que estés seguro de
            que algo quedó mal.
          </p>
          <button
            className="btn-warn"
            onClick={() => {
              setLocked(false);
              setPidiendoConfirmacion(false);
            }}
          >
            <TriangleAlert size={16} /> Sí, necesito editarlo
          </button>
          <button className="link-btn" onClick={() => setPidiendoConfirmacion(false)}>
            Cancelar
          </button>
        </Sheet>
      )}
    </>
  );
}

function Resultado({
  fecha,
  modo,
  notas,
  insumos,
  proveedores,
  pedidoGuardado,
  onGuardarPedido,
  onAsignarApodo,
}: {
  fecha: string;
  modo: Modo;
  notas: string;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  pedidoGuardado?: Record<string, number>;
  onGuardarPedido: (fecha: string, pedido: Record<string, number>) => void;
  onAsignarApodo: (insumoId: string, apodo: string) => void;
}) {
  const { renglones } = leerNotasInventario(notas, insumos);
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const noReconocidos = renglones.filter((r) => !r.insumoId);

  // Un renglón por insumo: si se anotó dos veces ("0.4 lemon pepper" y
  // "1k lemon pepper") se muestran juntas las dos cantidades.
  const porInsumo = new Map<string, RenglonInventario[]>();
  renglones.forEach((r) => {
    if (!r.insumoId) return;
    if (!porInsumo.has(r.insumoId)) porInsumo.set(r.insumoId, []);
    porInsumo.get(r.insumoId)!.push(r);
  });
  const lineas: LineaConteoTexto[] = [...porInsumo.entries()].map(([id, rs]) => {
    const insumo = porId.get(id)!;
    const unidadCatalogo = insumo.unidad === "pieza" ? "pz" : insumo.unidad;
    const valor = rs.map((r) => (rs.length > 1 && r.unidad ? `${r.cantidadTexto} ${r.unidad}` : r.cantidadTexto)).join(" + ");
    const presentacion = rs.length > 1 ? undefined : rs[0].unidad || unidadCatalogo;
    return { nombre: insumo.nombre, presentacion, etiqueta: insumo.nombre, valor };
  });

  // Lo que tocaba contar y no aparece en las notas (ni se marcó como "no
  // hay" al guardar) — solo para revisar.
  const noSeContaron = faltantesPorContar(insumos, proveedores, modo, new Set(porInsumo.keys()));

  const ordenados = [...insumos].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <>
      {noReconocidos.length > 0 && (
        <div className="inv-no-reconocidos">
          <strong>
            <TriangleAlert size={15} /> No reconocidos ({noReconocidos.length})
          </strong>
          <span className="hint">Elige qué producto es; se recordará para la próxima vez.</span>
          {noReconocidos.map((r, idx) => (
            <div key={`${idx}-${r.linea}`} className="inv-no-reconocido">
              <code>{r.linea}</code>
              <select
                className="text-input"
                value=""
                onChange={(e) => e.target.value && onAsignarApodo(e.target.value, r.texto)}
              >
                <option value="">{r.candidatos.length > 1 ? "¿Cuál de estos es?" : "¿Qué producto es?"}</option>
                {[...r.candidatos.map((c) => porId.get(c)!), ...ordenados.filter((i) => !r.candidatos.includes(i.id))].map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {insumos.length === 0 && <span className="hint">Primero da de alta los productos en el Catálogo.</span>}
        </div>
      )}

      {lineas.length > 0 && (
        <ListaPorProveedor
          fecha={fecha}
          lineas={lineas}
          insumos={insumos}
          proveedores={proveedores}
          pedidoGuardado={pedidoGuardado}
          onGuardarPedido={onGuardarPedido}
        />
      )}

      {noSeContaron.length > 0 && (
        <details className="inv-no-contados">
          <summary>No se contaron ({noSeContaron.length})</summary>
          <p>{noSeContaron.map((i) => i.nombre).join(", ")}</p>
        </details>
      )}
    </>
  );
}

// Aviso al guardar: lo que tocaba contar y no está en las notas, separado
// por proveedor y todo marcado de inicio. Los marcados se guardan en 0
// ("no hay"); se desmarca lo que sí hay y solo faltó anotar.
function FaltanPorContarSheet({
  modo,
  faltantes,
  proveedores,
  marcados,
  onToggle,
  onGuardar,
  onClose,
}: {
  modo: Modo;
  faltantes: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  marcados: Set<string>;
  onToggle: (id: string) => void;
  onGuardar: () => void;
  onClose: () => void;
}) {
  const grupos = [
    ...proveedores.map((p) => ({ key: p.id, nombre: p.nombre, items: faltantes.filter((i) => i.proveedorId === p.id) })),
    {
      key: "sin",
      nombre: "Sin proveedor",
      items: faltantes.filter((i) => !i.proveedorId || !proveedores.some((p) => p.id === i.proveedorId)),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <Sheet title={`Faltan por contar (${faltantes.length})`} onClose={onClose}>
      <p className="hint">
        Estos productos tocaba contarlos {modo === "completo" ? "el domingo" : "el jueves"} y no están en tus notas. Los
        marcados se guardan como <strong>0 (no hay)</strong> y salen abajo para que puedas pedirlos.
      </p>
      <div className="faltan-lista">
        {grupos.map((g) => (
          <div key={g.key} className="faltan-grupo">
            <span className="insumos-grupo-titulo">{g.nombre}</span>
            {g.items.map((i) => (
              <label key={i.id} className="faltan-item">
                <input type="checkbox" checked={marcados.has(i.id)} onChange={() => onToggle(i.id)} />
                {i.nombre}
              </label>
            ))}
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={onGuardar}>
        {marcados.size > 0 ? "No hay — guardar marcados en 0" : "Guardar sin los que faltan"}
      </button>
      <button className="btn-secundario" onClick={onClose}>
        Volver a contar
      </button>
    </Sheet>
  );
}
