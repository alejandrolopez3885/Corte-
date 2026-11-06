import { useState, type ReactNode } from "react";
import { Check, ClipboardList, FolderOpen, Lock, Package, TriangleAlert } from "lucide-react";
import { Empty, Sheet } from "../ui";
import { ErroresSheet, ListaPorProveedor, type ErroresCaptura } from "./ConteoDiarioPanel";
import {
  addDaysIso, dateForDay, formatDayNumber, formatLongDayDate, formatShortDayDate, todayIso, type LineaConteoTexto,
} from "../../lib/dataModel";
import {
  faltantesPorContar, leerNotasInventario, normalizar, NOMBRE_AREA, type ModoInventario, type RenglonInventario,
} from "../../lib/inventarioNotas";
import { InventarioAsistente } from "../modals/InventarioAsistente";
import type { InsumoEntry, MonthData, ProveedorCatalogEntry } from "../../lib/types";
import { TituloPagina } from "../BarraTitulo";

// "Limón · Cocina · Frutas y Verduras · kg" — para distinguir productos que
// se llaman igual.
function etiquetaInsumo(i: InsumoEntry, proveedores: ProveedorCatalogEntry[]): string {
  const prov = proveedores.find((p) => p.id === i.proveedorId)?.nombre || "sin proveedor";
  return `${i.nombre} · ${NOMBRE_AREA[i.area]} · ${prov} · ${i.unidad === "pieza" ? "pz" : i.unidad}`;
}

type Modo = ModoInventario;
type Vista = { t: "inicio" } | { t: "lista" } | { t: "detalle"; fecha: string };

// Inventario: al entrar se pregunta "¿Qué vas a hacer?": contar (asistente
// paso a paso del jueves o domingo que toca) o consultar los ya guardados.
// El domingo espera a que se guarde el jueves (o a que el dueño lo salte).
// El jueves se puede corregir hasta que se guarde el domingo (el dueño,
// siempre).
//
// Inventario completo (domingo) / parcial (jueves) en notas: ya guardado,
// cada renglón se liga con el catálogo para separarlo por proveedor, con su
// recuadro "Pedir" y "Copiar pedido" igual que en el Conteo diario. Se
// guarda por la fecha real del día (el domingo o el jueves de esa semana).
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
  const [vista, setVista] = useState<Vista>({ t: "inicio" });
  const [pidiendoSaltar, setPidiendoSaltar] = useState(false);
  // Desde la alerta de Inicio se abre directo el conteo.
  const [contando, setContando] = useState(!!initialModo);
  const [sinDisponible, setSinDisponible] = useState(false);
  const esDueno = !!onSaltarJueves;

  const monthKey = initialMonthKey;
  const weekIndex = initialWeekIndex;
  const month = months[monthKey] || null;

  if (monthKeys.length === 0 || !month) {
    return (
      <div className="page-section">
        <TituloPagina titulo="Inventario" onBack={onBack} backLabel={backLabel} />
        <Empty icon={<Package size={26} strokeWidth={1.3} />} text="Primero crea un mes en Corte para poder llevar el inventario." />
      </div>
    );
  }

  const hoy = todayIso();
  const fechaJueves = dateForDay(monthKey, weekIndex, month, "Jueves");
  const fechaDomingo = dateForDay(monthKey, weekIndex, month, "Domingo");
  const juevesGuardado = notas[fechaJueves] !== undefined;
  const juevesSaltado = !juevesGuardado && !!juevesSaltados?.[fechaJueves];
  const juevesListo = juevesGuardado || juevesSaltado;
  const domingoGuardado = notas[fechaDomingo] !== undefined;
  const modoSugerido: Modo = initialModo ?? (juevesListo || domingoGuardado ? "completo" : "jueves");

  const dias = [
    {
      modo: "jueves" as const,
      fecha: fechaJueves,
      motivo: juevesGuardado
        ? "Ya se guardó"
        : juevesSaltado
          ? "Se marcó como No se hizo"
          : domingoGuardado
            ? "Ya se guardó el domingo"
            : hoy < fechaJueves
              ? `Se habilita el jueves ${formatDayNumber(fechaJueves)}`
              : "",
    },
    {
      modo: "completo" as const,
      fecha: fechaDomingo,
      motivo: domingoGuardado
        ? "Ya se guardó"
        : !juevesListo
          ? "Se habilita después de guardar el jueves"
          : hoy < fechaDomingo
            ? `Se habilita el domingo ${formatDayNumber(fechaDomingo)}`
            : "",
    },
  ];
  const disponible = dias.find((d) => !d.motivo);
  const motivoContar = domingoGuardado
    ? "Ya se guardó el inventario de esta semana"
    : (juevesListo ? dias[1] : dias[0]).motivo;
  const fechasGuardadas = Object.keys(notas).sort().reverse();

  const modoDeFecha = (f: string): Modo => (new Date(`${f}T00:00:00`).getDay() === 4 ? "jueves" : "completo");
  const nombreDia = (f: string) => {
    const dia = new Date(`${f}T00:00:00`).toLocaleDateString("es-MX", { weekday: "long" });
    return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${formatShortDayDate(f)}`;
  };

  let titulo = "Inventario";
  let onBackVista: (() => void) | undefined = onBack;
  let backLabelVista = backLabel;
  if (vista.t === "lista") {
    titulo = "Inventarios guardados";
    onBackVista = () => setVista({ t: "inicio" });
    backLabelVista = "Inventario";
  } else if (vista.t === "detalle") {
    onBackVista = () => setVista({ t: "lista" });
    backLabelVista = "Inventarios guardados";
  }

  let contenido: ReactNode;
  if (vista.t === "detalle") {
    const f = vista.fecha;
    const m = modoDeFecha(f);
    contenido = (
      <>
        <p className="active-day-date">{formatLongDayDate(f)}</p>
        <NotasForm
          key={f}
          fecha={f}
          modo={m}
          guardado={notas[f] ?? ""}
          insumos={insumos}
          proveedores={proveedores}
          onGuardarNotas={onGuardarNotas}
          pedidoGuardado={pedidos[f]}
          onGuardarPedido={onGuardarPedido}
          onAsignarApodo={onAsignarApodo}
          onUnirInsumos={onUnirInsumos}
          cerrado={m === "jueves" && notas[addDaysIso(f, 3)] !== undefined && !esDueno}
        />
      </>
    );
  } else if (vista.t === "lista") {
    const grupos: { mes: string; fechas: string[] }[] = [];
    fechasGuardadas.forEach((f) => {
      const mesLargo = new Date(`${f}T00:00:00`).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
      const mes = `${mesLargo.charAt(0).toUpperCase()}${mesLargo.slice(1)}`;
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.mes === mes) ultimo.fechas.push(f);
      else grupos.push({ mes, fechas: [f] });
    });
    contenido = (
      <>
        {grupos.map((g) => (
          <div key={g.mes} className="inv-mes">
            <span className="insumos-grupo-titulo">{g.mes}</span>
            <div className="menu-list">
              {g.fechas.map((f) => {
                const renglones = notas[f].split("\n").filter((l) => l.trim()).length;
                return (
                  <button key={f} className="menu-item" onClick={() => setVista({ t: "detalle", fecha: f })}>
                    <span className="menu-item-icon">
                      <Check size={20} />
                    </span>
                    <span className="menu-item-text">
                      <strong>{nombreDia(f)}</strong>
                      <span>
                        {modoDeFecha(f) === "jueves" ? "Parcial" : "Completo"} · {renglones} {renglones === 1 ? "producto" : "productos"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </>
    );
  } else {
    contenido = (
      <>
        <h2 className="ca-pregunta">¿Qué vas a hacer?</h2>
        <div className="menu-list">
          <button
            className="menu-item"
            style={disponible ? undefined : { opacity: 0.6 }}
            aria-disabled={!disponible}
            onClick={() => (disponible ? setContando(true) : setSinDisponible(true))}
          >
            <span className="menu-item-icon">
              {disponible ? <ClipboardList size={20} /> : <Lock size={20} />}
            </span>
            <span className="menu-item-text">
              <strong>Contar inventario</strong>
              <span>
                {disponible
                  ? `${disponible.modo === "jueves" ? "Jueves" : "Domingo"} ${formatDayNumber(disponible.fecha)} · ${disponible.modo === "jueves" ? "parcial" : "completo"}`
                  : motivoContar}
              </span>
            </span>
          </button>
          <button
            className="menu-item"
            style={fechasGuardadas.length > 0 ? undefined : { opacity: 0.6 }}
            aria-disabled={fechasGuardadas.length === 0}
            onClick={() => fechasGuardadas.length > 0 && setVista({ t: "lista" })}
          >
            <span className="menu-item-icon">
              <FolderOpen size={20} />
            </span>
            <span className="menu-item-text">
              <strong>Consultar inventario</strong>
              <span>
                {fechasGuardadas.length === 0
                  ? "Aún no hay inventarios guardados"
                  : `Último: ${nombreDia(fechasGuardadas[0]).toLowerCase()}`}
              </span>
            </span>
          </button>
        </div>
        {!disponible && sinDisponible && <p className="inv-error">{motivoContar}</p>}
        {esDueno && !juevesGuardado && !juevesSaltado && !domingoGuardado && <SaltarJueves onClick={() => setPidiendoSaltar(true)} />}
        {esDueno && juevesSaltado && (
          <button className="link-btn" onClick={() => onSaltarJueves!(fechaJueves, false)}>
            Deshacer: capturar el jueves
          </button>
        )}
        {onEditarProveedores && (
          <button className="link-btn" onClick={onEditarProveedores}>
            Editar proveedores del jueves
          </button>
        )}
      </>
    );
  }

  return (
    <div className="page-section">
      <TituloPagina titulo={titulo} onBack={onBackVista} backLabel={backLabelVista} />
      {contenido}

      {contando && (
        <InventarioAsistente
          modoInicial={modoSugerido}
          insumos={insumos}
          proveedores={proveedores}
          dias={dias}
          onGuardar={(f, texto) => onGuardarNotas(f, texto)}
          onClose={() => setContando(false)}
          renderPedido={(f, m, texto) => (
            <Resultado
              fecha={f}
              modo={m}
              notas={texto}
              insumos={insumos}
              proveedores={proveedores}
              pedidoGuardado={pedidos[f]}
              onGuardarPedido={onGuardarPedido}
              onAsignarApodo={onAsignarApodo}
              onUnirInsumos={onUnirInsumos}
            />
          )}
        />
      )}
      {pidiendoSaltar && (
        <Sheet title="Saltar el jueves" onClose={() => setPidiendoSaltar(false)}>
          <p className="hint">
            El inventario del jueves {formatDayNumber(fechaJueves)} queda como "No se hizo" y se habilita el del domingo. Lo
            puedes deshacer desde esta misma pantalla.
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              onSaltarJueves!(fechaJueves, true);
              setPidiendoSaltar(false);
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
  guardado: string;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  onGuardarNotas: (fecha: string, texto: string) => void;
  pedidoGuardado?: Record<string, number>;
  onGuardarPedido: (fecha: string, pedido: Record<string, number>) => void;
  onAsignarApodo: (insumoId: string, apodo: string) => void;
  onUnirInsumos?: (quedaId: string, otrosIds: string[]) => void;
}) {
  const [texto, setTexto] = useState(guardado);
  const [locked, setLocked] = useState(true);
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
            Guardar cambios del inventario del {modo === "jueves" ? "jueves" : "domingo"}
          </button>
        </>
      )}

      {locked && (
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
