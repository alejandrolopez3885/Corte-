import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, Lock, Package, TriangleAlert } from "lucide-react";
import { Empty, Field, Sheet } from "../ui";
import { ErroresSheet, ListaPorProveedor, type ErroresCaptura } from "./ConteoDiarioPanel";
import {
  dateForDay, formatDayNumber, formatLongDayDate, formatWeekRange, resolveWeekStartDate, todayIso, type LineaConteoTexto,
} from "../../lib/dataModel";
import { leerNotasInventario, normalizar, type RenglonInventario } from "../../lib/inventarioNotas";
import type { InsumoArea, InsumoEntry, MonthData, ProveedorCatalogEntry } from "../../lib/types";

const NOMBRE_AREA: Record<InsumoArea, string> = { bar: "Bar", cocina: "Cocina", general: "General" };

// "Limón · Cocina · Frutas y Verduras · kg" — para distinguir productos que
// se llaman igual.
function etiquetaInsumo(i: InsumoEntry, proveedores: ProveedorCatalogEntry[]): string {
  const prov = proveedores.find((p) => p.id === i.proveedorId)?.nombre || "sin proveedor";
  return `${i.nombre} · ${NOMBRE_AREA[i.area]} · ${prov} · ${i.unidad === "pieza" ? "pz" : i.unidad}`;
}

type Modo = "completo" | "jueves";

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

// Inventario por pasos: primero el jueves (parcial) y después el domingo
// (completo). Cada uno se captura desde su día; el domingo además espera a
// que se guarde el jueves (o a que el dueño lo salte). El jueves se puede
// corregir hasta que se guarde el domingo (el dueño, siempre).
//
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
  initialModo,
  juevesSaltados,
  onSaltarJueves,
  onUnirInsumos,
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
  // Desde Inicio se abre en el modo de la alerta.
  initialModo?: Modo;
  // Jueves que el dueño marcó como "No se hizo" (fecha -> true).
  juevesSaltados?: Record<string, boolean>;
  // Solo el dueño: saltar (o deshacer) el jueves de una semana.
  onSaltarJueves?: (fecha: string, saltado: boolean) => void;
  // Solo el dueño: unir productos repetidos del catálogo.
  onUnirInsumos?: (quedaId: string, otrosIds: string[]) => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  // null = el paso que toca (jueves si no está listo, si no el domingo).
  const [modoElegido, setModoElegido] = useState<Modo | null>(initialModo ?? null);
  const [pidiendoSaltar, setPidiendoSaltar] = useState(false);
  const esDueno = !!onSaltarJueves;

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
  const hoy = todayIso();
  const fechaJueves = dateForDay(monthKey, weekIndex, month, "Jueves");
  const fechaDomingo = dateForDay(monthKey, weekIndex, month, "Domingo");
  const juevesGuardado = notas[fechaJueves] !== undefined;
  const juevesSaltado = !juevesGuardado && !!juevesSaltados?.[fechaJueves];
  const juevesListo = juevesGuardado || juevesSaltado;
  const domingoGuardado = notas[fechaDomingo] !== undefined;
  const modo: Modo = modoElegido ?? (juevesListo || domingoGuardado ? "completo" : "jueves");
  const fecha = modo === "completo" ? fechaDomingo : fechaJueves;
  const cambiarSemana = (mk: string, wi: number) => {
    setMonthKey(mk);
    setWeekIndex(wi);
    setModoElegido(null);
  };

  const estadoJueves = juevesGuardado ? "Guardado" : juevesSaltado ? "No se hizo" : hoy < fechaJueves ? "Desde el jueves" : "Sin guardar";
  const domingoBloqueado = !domingoGuardado && !juevesListo;
  const estadoDomingo = domingoGuardado ? "Guardado" : domingoBloqueado ? "Después del jueves" : hoy < fechaDomingo ? "Desde el domingo" : "Sin guardar";

  let contenido: ReactNode;
  if (modo === "jueves" && juevesSaltado) {
    contenido = (
      <div className="inv-espera">
        <strong>No se hizo el inventario de este jueves</strong>
        <span>Ya se puede capturar el del domingo.</span>
        {esDueno && (
          <button className="link-btn" onClick={() => onSaltarJueves!(fechaJueves, false)}>
            Deshacer: capturar el jueves
          </button>
        )}
      </div>
    );
  } else if (modo === "jueves" && !juevesGuardado && hoy < fechaJueves) {
    contenido = (
      <>
        <div className="inv-espera">
          <strong>
            <Lock size={15} /> Se habilita el jueves {formatDayNumber(fechaJueves)}
          </strong>
          <span>El inventario del jueves se captura desde ese día.</span>
        </div>
        {esDueno && <SaltarJueves onClick={() => setPidiendoSaltar(true)} />}
      </>
    );
  } else if (modo === "completo" && domingoBloqueado) {
    contenido = (
      <div className="inv-espera">
        <strong>
          <Lock size={15} /> Primero guarda el inventario del jueves
        </strong>
        <span>El del domingo se habilita en cuanto se guarde el del jueves {formatDayNumber(fechaJueves)}.</span>
        <button className="link-btn" onClick={() => setModoElegido("jueves")}>
          Ir al jueves
        </button>
      </div>
    );
  } else if (modo === "completo" && !domingoGuardado && hoy < fechaDomingo) {
    contenido = (
      <div className="inv-espera">
        <strong>
          <Lock size={15} /> Se habilita el domingo {formatDayNumber(fechaDomingo)}
        </strong>
        <span>
          El inventario completo se captura desde ese día.{juevesGuardado && " Mientras, puedes corregir el del jueves."}
        </span>
        {juevesGuardado && (
          <button className="link-btn" onClick={() => setModoElegido("jueves")}>
            Ver / editar el inventario del jueves
          </button>
        )}
      </div>
    );
  } else {
    contenido = (
      <>
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
          onUnirInsumos={onUnirInsumos}
          cerrado={modo === "jueves" && domingoGuardado && !esDueno}
        />
        {modo === "jueves" && !juevesGuardado && esDueno && <SaltarJueves onClick={() => setPidiendoSaltar(true)} />}
      </>
    );
  }

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
          <select className="text-input" value={monthKey} onChange={(e) => cambiarSemana(e.target.value, 0)}>
            {monthKeys.map((mk) => (
              <option key={mk} value={mk}>
                {months[mk].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Semana">
          <select className="text-input" value={weekIndex} onChange={(e) => cambiarSemana(monthKey, Number(e.target.value))}>
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                Semana {i + 1}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="hint">{formatWeekRange(weekStartDate)}</p>

      <div className="inv-pasos">
        <Paso
          numero={1}
          titulo={`Jueves ${formatDayNumber(fechaJueves)}`}
          estado={estadoJueves}
          activo={modo === "jueves"}
          hecho={juevesListo}
          onClick={() => setModoElegido("jueves")}
        />
        <Paso
          numero={2}
          titulo={`Domingo ${formatDayNumber(fechaDomingo)}`}
          estado={estadoDomingo}
          activo={modo === "completo"}
          hecho={domingoGuardado}
          bloqueado={domingoBloqueado}
          onClick={() => setModoElegido("completo")}
        />
      </div>
      {onEditarProveedores && (
        <button className="link-btn" onClick={onEditarProveedores}>
          Editar proveedores del jueves
        </button>
      )}
      <p className="active-day-date">{formatLongDayDate(fecha)}</p>

      {contenido}

      {pidiendoSaltar && (
        <Sheet title="Saltar el jueves" onClose={() => setPidiendoSaltar(false)}>
          <p className="hint">
            El inventario del jueves {formatDayNumber(fechaJueves)} queda como "No se hizo" y se habilita el del domingo. Lo
            puedes deshacer desde el mismo paso del jueves.
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              onSaltarJueves!(fechaJueves, true);
              setPidiendoSaltar(false);
              setModoElegido(null);
            }}
          >
            Sí, saltar el jueves
          </button>
          <button className="link-btn" onClick={() => setPidiendoSaltar(false)}>
            Cancelar
          </button>
        </Sheet>
      )}
    </div>
  );
}

function Paso({
  numero,
  titulo,
  estado,
  activo,
  hecho,
  bloqueado,
  onClick,
}: {
  numero: number;
  titulo: string;
  estado: string;
  activo: boolean;
  hecho: boolean;
  bloqueado?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`inv-paso ${activo ? "activo" : ""} ${hecho ? "hecho" : ""} ${bloqueado ? "bloqueado" : ""}`} onClick={onClick}>
      <strong>
        <span className="inv-paso-num">{hecho ? <Check size={12} /> : bloqueado ? <Lock size={11} /> : numero}</span>
        {titulo}
      </strong>
      <small>{estado}</small>
    </button>
  );
}

function SaltarJueves({ onClick }: { onClick: () => void }) {
  return (
    <>
      <button className="inv-saltar" onClick={onClick}>
        Saltar el jueves de esta semana
      </button>
      <p className="hint inv-saltar-hint">Solo tú ves este botón. El jueves queda como "No se hizo" y se habilita el domingo.</p>
    </>
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
  onUnirInsumos,
  cerrado,
}: {
  fecha: string;
  modo: Modo;
  // Jueves ya cerrado para el personal (se guardó el domingo).
  cerrado?: boolean;
  guardado?: string;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  onGuardarNotas: (fecha: string, texto: string) => void;
  pedidoGuardado?: Record<string, number>;
  onGuardarPedido: (fecha: string, pedido: Record<string, number>) => void;
  onAsignarApodo: (insumoId: string, apodo: string) => void;
  onUnirInsumos?: (quedaId: string, otrosIds: string[]) => void;
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
    // Si otro producto se llama igual, va con su área ("0 Limón (Bar)") para
    // que se sepa cuál es.
    const repetido = (i: InsumoEntry) => insumos.some((x) => x.id !== i.id && normalizar(x.nombre) === normalizar(i.nombre));
    const ceros = (faltantes || [])
      .filter((i) => marcados.has(i.id))
      .map((i) => `0 ${i.nombre}${repetido(i) ? ` (${NOMBRE_AREA[i.area]})` : ""}`);
    setFaltantes(null);
    guardarTexto(ceros.length > 0 ? `${texto.trimEnd()}\n${ceros.join("\n")}` : texto);
  }

  return (
    <>
      {locked && (
        <div className="conteo-locked-banner">
          <span>{cerrado ? "Cerrado: ya se guardó el inventario del domingo." : "Inventario guardado y bloqueado."}</span>
          {!cerrado && (
            <button className="link-btn" onClick={() => setPidiendoConfirmacion(true)}>
              Editar
            </button>
          )}
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
            Guardar inventario del {modo === "jueves" ? "jueves" : "domingo"}
          </button>
          {modo === "jueves" && guardado === undefined && <p className="hint inv-saltar-hint">Al guardarlo se habilita el domingo.</p>}
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
          onUnirInsumos={onUnirInsumos}
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
  onUnirInsumos,
}: {
  fecha: string;
  modo: Modo;
  notas: string;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  pedidoGuardado?: Record<string, number>;
  onGuardarPedido: (fecha: string, pedido: Record<string, number>) => void;
  onAsignarApodo: (insumoId: string, apodo: string) => void;
  onUnirInsumos?: (quedaId: string, otrosIds: string[]) => void;
}) {
  const [uniendo, setUniendo] = useState<InsumoEntry[] | null>(null);
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
  // Productos que se llaman igual entre los candidatos de un renglón no
  // reconocido: son la razón de que no se reconozca.
  const repetidos: InsumoEntry[][] = [];
  noReconocidos.forEach((r) => {
    const porNombre = new Map<string, InsumoEntry[]>();
    r.candidatos.forEach((id) => {
      const i = porId.get(id);
      if (!i) return;
      const k = normalizar(i.nombre);
      porNombre.set(k, [...(porNombre.get(k) || []), i]);
    });
    porNombre.forEach((g) => {
      const clave = g.map((i) => i.id).sort().join("-");
      if (g.length > 1 && !repetidos.some((x) => x.map((i) => i.id).sort().join("-") === clave)) repetidos.push(g);
    });
  });

  return (
    <>
      {noReconocidos.length > 0 && (
        <div className="inv-no-reconocidos">
          <strong>
            <TriangleAlert size={15} /> No reconocidos ({noReconocidos.length})
          </strong>
          <span className="hint">Elige qué producto es; se recordará para la próxima vez.</span>
          {repetidos.map((grupo) => (
            <div key={grupo.map((i) => i.id).join("-")} className="inv-repetido">
              <div className="inv-repetido-fila">
                <span>
                  <strong>
                    "{grupo[0].nombre}" está {grupo.length} veces
                  </strong>{" "}
                  en el catálogo, por eso no sé cuál es.
                </span>
                {onUnirInsumos && (
                  <button className="prov-par-btn" onClick={() => setUniendo(grupo)}>
                    Unir
                  </button>
                )}
              </div>
              <span className="hint">
                {onUnirInsumos
                  ? "Si son el mismo producto, únelos. Si son distintos (ej. uno de Bar y otro de Cocina), elige abajo cuál es: se recordará."
                  : "Elige abajo cuál es: se recordará. Si son el mismo producto, avísale al dueño para que los una."}
              </span>
            </div>
          ))}
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
                    {etiquetaInsumo(i, proveedores)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {insumos.length === 0 && <span className="hint">Primero da de alta los productos en el Catálogo.</span>}
        </div>
      )}

      {uniendo && onUnirInsumos && (
        <UnirInsumosSheet
          grupo={uniendo}
          proveedores={proveedores}
          onUnir={(queda) => {
            onUnirInsumos(queda, uniendo.filter((i) => i.id !== queda).map((i) => i.id));
            setUniendo(null);
          }}
          onClose={() => setUniendo(null)}
        />
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

// Unir productos repetidos: se elige cuál se queda (de inicio, el más
// completo: con proveedor y precio).
function UnirInsumosSheet({
  grupo,
  proveedores,
  onUnir,
  onClose,
}: {
  grupo: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  onUnir: (quedaId: string) => void;
  onClose: () => void;
}) {
  const completo = (i: InsumoEntry) => (i.proveedorId ? 2 : 0) + (i.precio ? 1 : 0) + (i.equivalenciaPedido ? 1 : 0);
  const [queda, setQueda] = useState(() => [...grupo].sort((a, b) => completo(b) - completo(a))[0].id);
  const elegido = grupo.find((i) => i.id === queda)!;
  const pierdeAltaRotacion = grupo.some((i) => i.id !== queda && i.altaRotacion && i.area !== elegido.area);
  const otros = grupo.length - 1;
  return (
    <Sheet title={`Unir "${grupo[0].nombre}"`} onClose={onClose}>
      <p className="hint">¿Cuál se queda?</p>
      {grupo.map((i) => {
        const [nombre, ...resto] = etiquetaInsumo(i, proveedores).split(" · ");
        return (
          <label key={i.id} className={`prov-opcion ${queda === i.id ? "sel" : ""}`}>
            <input type="radio" checked={queda === i.id} onChange={() => setQueda(i.id)} />
            <span>
              {nombre}
              <small className="inv-opcion-detalle">
                {resto.join(" · ")}
                {i.precio ? ` · precio $${i.precio.toFixed(2)}` : ""}
              </small>
            </span>
          </label>
        );
      })}
      <div className="prov-resultado">
        {otros === 1 ? "El otro se borra" : `Los otros ${otros} se borran`} del catálogo y sus nombres y apodos pasan al que
        se queda. El historial de Inventario y Pedidos no cambia.
        {pierdeAltaRotacion && (
          <>
            {" "}
            <strong>Ojo:</strong> uno de los que se borran es de alta rotación en otra área: deja de salir en su Conteo
            diario.
          </>
        )}
      </div>
      <button className="btn-primary" onClick={() => onUnir(queda)}>
        Unir en {elegido.nombre} ({NOMBRE_AREA[elegido.area]})
      </button>
      <button className="link-btn prov-cancelar" onClick={onClose}>
        Cancelar
      </button>
    </Sheet>
  );
}
