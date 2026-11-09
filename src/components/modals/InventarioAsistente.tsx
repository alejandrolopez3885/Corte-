import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronLeft, TriangleAlert } from "lucide-react";
import { MarcoAsistente, Opcion } from "./asistente";
import { BuscadorInventario, type AccionConteo } from "../BuscadorInventario";
import { formatLongDayDate, unidadConteo } from "../../lib/dataModel";
import {
  faltantesPorContar, leerNotasInventario, normalizar, NOMBRE_AREA, type ModoInventario,
} from "../../lib/inventarioNotas";
import type { InsumoEntry, ProveedorCatalogEntry } from "../../lib/types";

// Inventario paso a paso: ¿qué día?, ¿cómo vas a contar? (por proveedor o
// sin orden), un paso por proveedor, lo que faltó, resumen y pedido. Al
// terminar guarda el mismo texto de notas de siempre ("2.5 Limón"), así que
// Pedidos, Consumo e Inicio no cambian. Lo capturado se guarda como borrador
// en este dispositivo mientras no se guarde el inventario.

export interface DiaInventario {
  modo: ModoInventario;
  fecha: string;
  // Por qué no se puede contar todavía ("" = disponible).
  motivo: string;
}

type Forma = "proveedor" | "libre";
interface Grupo {
  key: string;
  nombre: string;
  items: InsumoEntry[];
}
type Paso =
  | { t: "dia" }
  | { t: "forma" }
  | { t: "prov"; g: Grupo }
  | { t: "libre" }
  | { t: "faltan" }
  | { t: "resumen" }
  | { t: "pedido" };

interface Borrador {
  forma: Forma;
  valores: Record<string, string>;
  libre: string;
}

const claveBorrador = (fecha: string) => `inventario-borrador-${fecha}`;
function leerBorrador(fecha: string): Borrador | null {
  try {
    const raw = localStorage.getItem(claveBorrador(fecha));
    return raw ? (JSON.parse(raw) as Borrador) : null;
  } catch {
    return null;
  }
}
const CANTIDAD = /^\d*[.,]?\d+$/;
const pasoId = (p: Paso) => (p.t === "prov" ? `prov-${p.g.key}` : p.t);

export function InventarioAsistente({
  dias,
  modoInicial,
  insumos,
  proveedores,
  onGuardar,
  onClose,
  renderPedido,
}: {
  dias: DiaInventario[];
  modoInicial: ModoInventario;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  onGuardar: (fecha: string, texto: string, modo: ModoInventario) => void;
  onClose: () => void;
  renderPedido: (fecha: string, modo: ModoInventario, texto: string) => ReactNode;
}) {
  const disponibleInicial = dias.find((d) => d.modo === modoInicial && !d.motivo) || dias.find((d) => !d.motivo);
  const modoArranque = disponibleInicial?.modo ?? modoInicial;
  const [borradorInicial] = useState(() => leerBorrador(dias.find((d) => d.modo === modoArranque)!.fecha));
  const [modo, setModo] = useState<ModoInventario>(modoArranque);
  const [forma, setForma] = useState<Forma>(borradorInicial?.forma ?? "proveedor");
  const [valores, setValores] = useState<Record<string, string>>(borradorInicial?.valores ?? {});
  const [libre, setLibre] = useState(borradorInicial?.libre ?? "");
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set());
  const [clave, setClave] = useState("dia");
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState<string | null>(null);
  const [retomado, setRetomado] = useState(!!borradorInicial);

  const dia = dias.find((d) => d.modo === modo)!;
  const fecha = dia.fecha;

  // Al elegir el día se retoma su borrador, si hay.
  function elegirDia(m: ModoInventario) {
    setModo(m);
    const b = leerBorrador(dias.find((d) => d.modo === m)!.fecha);
    setRetomado(!!b);
    setForma(b?.forma ?? "proveedor");
    setValores(b?.valores ?? {});
    setLibre(b?.libre ?? "");
    setDesmarcados(new Set());
    setError("");
  }
  useEffect(() => {
    if (guardado !== null) return;
    const hay = Object.values(valores).some((v) => v !== "") || libre.trim() !== "";
    try {
      if (hay) localStorage.setItem(claveBorrador(fecha), JSON.stringify({ forma, valores, libre } satisfies Borrador));
    } catch {
      // Sin espacio o modo privado: se sigue sin borrador.
    }
  }, [fecha, forma, valores, libre, guardado]);

  const grupos = useMemo<Grupo[]>(() => {
    const base = insumos.filter((i) => !i.altaRotacion).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const delModo = proveedores.filter((p) => modo === "completo" || p.incluyeJueves);
    const g: Grupo[] = delModo.map((p) => ({ key: p.id, nombre: p.nombre, items: base.filter((i) => i.proveedorId === p.id) }));
    if (modo === "completo") {
      g.push({ key: "sin", nombre: "Sin proveedor", items: base.filter((i) => !i.proveedorId || !proveedores.some((p) => p.id === i.proveedorId)) });
    }
    return g.filter((x) => x.items.length > 0);
  }, [insumos, proveedores, modo]);

  const repetido = (i: InsumoEntry) => insumos.some((x) => x.id !== i.id && normalizar(x.nombre) === normalizar(i.nombre));
  const renglon = (cantidad: string, i: InsumoEntry) => `${cantidad.replace(",", ".")} ${i.nombre}${repetido(i) ? ` (${NOMBRE_AREA[i.area]})` : ""}`;

  const textoBase = useMemo(() => {
    if (forma === "libre") return libre.trim();
    return grupos
      .flatMap((g) => g.items.filter((i) => (valores[i.id] ?? "") !== "").map((i) => renglon(valores[i.id], i)))
      .join("\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forma, libre, grupos, valores, insumos]);

  const faltan = useMemo(() => {
    const { renglones } = leerNotasInventario(textoBase, insumos);
    return faltantesPorContar(insumos, proveedores, modo, new Set(renglones.flatMap((r) => (r.insumoId ? [r.insumoId] : []))));
  }, [textoBase, insumos, proveedores, modo]);

  // Los que faltan se guardan en 0 salvo los que se desmarcan.
  const textoFinal = useMemo(() => {
    const ceros = faltan.filter((i) => !desmarcados.has(i.id)).map((i) => renglon("0", i));
    return [textoBase, ...ceros].filter(Boolean).join("\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoBase, faltan, desmarcados, insumos]);

  const pasos: Paso[] = [
    { t: "dia" },
    { t: "forma" },
    ...(forma === "proveedor" ? grupos.map((g) => ({ t: "prov", g }) as Paso) : [{ t: "libre" } as Paso]),
    ...(faltan.length > 0 ? [{ t: "faltan" } as Paso] : []),
    { t: "resumen" },
    ...(guardado !== null ? [{ t: "pedido" } as Paso] : []),
  ];
  const idx = Math.max(0, pasos.findIndex((p) => pasoId(p) === clave));
  const paso = pasos[idx];
  const ir = (i: number) => {
    setError("");
    setClave(pasoId(pasos[Math.min(Math.max(i, 0), pasos.length - 1)]));
  };

  // Buscador (las dos formas de contar): los productos que tocan este día.
  const productosDelDia = useMemo(() => grupos.flatMap((g) => g.items), [grupos]);
  const nombreGrupo = useMemo(() => new Map(grupos.flatMap((g) => g.items.map((i) => [i.id, g.nombre] as const))), [grupos]);
  const detalleProducto = (i: InsumoEntry) => `${nombreGrupo.get(i.id) || "Sin proveedor"}${repetido(i) ? ` · ${NOMBRE_AREA[i.area]}` : ""}`;
  const fmtCantidad = (n: number) => String(Math.round(n * 1000) / 1000);
  const idDeLinea = (l: string) => leerNotasInventario(l, insumos).renglones[0]?.insumoId;
  function contadoDe(i: InsumoEntry): number | null {
    if (forma === "proveedor") {
      const v = (valores[i.id] ?? "").trim();
      return v !== "" && CANTIDAD.test(v) ? Number(v.replace(",", ".")) : null;
    }
    const rs = leerNotasInventario(libre, insumos).renglones.filter((r) => r.insumoId === i.id);
    return rs.length ? rs.reduce((t, r) => t + r.cantidad, 0) : null;
  }
  function guardarDesdeBuscador(i: InsumoEntry, cantidad: number, accion: AccionConteo) {
    setError("");
    const antes = contadoDe(i);
    const total = accion === "sumar" && antes !== null ? antes + cantidad : cantidad;
    if (forma === "proveedor") {
      setValores((v) => ({ ...v, [i.id]: fmtCantidad(total) }));
      return;
    }
    // Sin orden: el renglón del producto queda al final con el total (los
    // que ya tenía se quitan al sumar o corregir).
    setLibre((t) => {
      const lineas = t.split(/\r?\n/).filter((l) => l.trim() !== "" && (accion === "nuevo" || idDeLinea(l) !== i.id));
      return [...lineas, renglon(fmtCantidad(total), i)].join("\n");
    });
  }
  const buscador = <BuscadorInventario productos={productosDelDia} contado={contadoDe} detalle={detalleProducto} onGuardar={guardarDesdeBuscador} />;
  // Sin orden: lo contado sale de las notas (el renglón más nuevo arriba).
  const lecturaLibre = useMemo(() => leerNotasInventario(libre, insumos), [libre, insumos]);
  const contadosLibre = useMemo(() => {
    const vistos = new Set<string>();
    return [...lecturaLibre.renglones]
      .reverse()
      .flatMap((r) => {
        const i = r.insumoId ? insumos.find((x) => x.id === r.insumoId) : undefined;
        if (!i || vistos.has(i.id)) return [];
        vistos.add(i.id);
        return [{ i, cantidad: contadoDe(i) ?? r.cantidad }];
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturaLibre, insumos]);
  const sueltosLibre = [...lecturaLibre.renglones.filter((r) => !r.insumoId).map((r) => r.linea), ...lecturaLibre.sinCantidad];
  const quitarLinea = (pred: (l: string) => boolean) =>
    setLibre((t) =>
      t
        .split(/\r?\n/)
        .filter((l) => l.trim() !== "" && !pred(l))
        .join("\n")
    );

  const contadosDe = (g: Grupo) => g.items.filter((i) => (valores[i.id] ?? "") !== "").length;

  function siguiente() {
    if (paso.t === "dia" && dia.motivo) return setError(dia.motivo);
    if (paso.t === "prov") {
      const mala = paso.g.items.find((i) => (valores[i.id] ?? "") !== "" && !CANTIDAD.test(valores[i.id].trim()));
      if (mala) return setError(`Revisa la cantidad de ${mala.nombre}: solo números.`);
    }
    if (paso.t === "libre") {
      if (!libre.trim()) return setError("Cuenta al menos un producto.");
      const { sinCantidad } = leerNotasInventario(libre, insumos);
      if (sinCantidad.length > 0) return setError(`Quita los renglones sin cantidad: ${sinCantidad.slice(0, 3).join(", ")}${sinCantidad.length > 3 ? "…" : ""}`);
    }
    if (paso.t === "resumen") {
      if (!textoFinal.trim()) return setError("Cuenta al menos un producto.");
      onGuardar(fecha, textoFinal, modo);
      try {
        localStorage.removeItem(claveBorrador(fecha));
      } catch {
        // nada que limpiar
      }
      setGuardado(textoFinal);
      setClave("pedido");
      return;
    }
    ir(idx + 1);
  }

  const nombreModo = modo === "jueves" ? "jueves" : "domingo";
  const lecturaFinal = useMemo(() => leerNotasInventario(textoFinal, insumos), [textoFinal, insumos]);
  const contadosTotal = lecturaFinal.renglones.length;
  const enCero = lecturaFinal.renglones.filter((r) => r.cantidad === 0).length;
  // Productos que, al guardarse como texto, se ligarían a otro del catálogo
  // (su nombre es apodo o nombre de otro).
  const confundibles = useMemo(() => {
    if (forma !== "proveedor") return [];
    return grupos
      .flatMap((g) => g.items)
      .filter((i) => (valores[i.id] ?? "") !== "" && leerNotasInventario(renglon(valores[i.id], i), insumos).renglones[0]?.insumoId !== i.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forma, grupos, valores, insumos]);

  let avance = "";
  if (paso.t === "dia") avance = "Pregunta 1 de 2";
  else if (paso.t === "forma") avance = "Pregunta 2 de 2";
  else if (paso.t === "prov") avance = `Proveedor ${grupos.findIndex((g) => g.key === paso.g.key) + 1} de ${grupos.length} · ${paso.g.nombre}`;
  else if (paso.t === "libre") avance = "Sin orden";
  else if (paso.t === "faltan") avance = `Faltantes · ${faltan.length} sin contar`;
  else if (paso.t === "resumen") avance = "Resumen";
  else avance = "Pedido";
  const porcentaje = Math.round(((idx + 1) / pasos.length) * 100);

  const botonAtras = (
    <button type="button" className="ca-boton secundario" onClick={() => ir(idx - 1)}>
      <ChevronLeft size={18} /> Atrás
    </button>
  );
  const botonSi = (texto: string) => (
    <button type="button" className="ca-boton" onClick={siguiente}>
      {texto}
    </button>
  );
  let pie: ReactNode;
  if (paso.t === "dia") pie = botonSi("Siguiente");
  else if (paso.t === "pedido")
    pie = (
      <button type="button" className="ca-boton" onClick={onClose}>
        Listo
      </button>
    );
  else
    pie = (
      <>
        {botonAtras}
        {botonSi(
          paso.t === "forma"
            ? "Empezar a contar"
            : paso.t === "prov"
              ? pasos[idx + 1]?.t === "prov"
                ? "Siguiente proveedor"
                : "Terminar de contar"
              : paso.t === "libre"
                ? "Revisar y guardar"
                : paso.t === "resumen"
                  ? `Guardar inventario del ${nombreModo}`
                  : "Siguiente"
        )}
      </>
    );

  return (
    <MarcoAsistente titulo="Inventario" avance={avance} porcentaje={porcentaje} clavePaso={clave} onClose={onClose} pie={pie}>
      {paso.t === "dia" && (
        <>
          <h2 className="ca-pregunta">¿Qué día estás contando?</h2>
          <p className="ca-ayuda">{retomado ? "Tienes un borrador de este día: se retomó donde lo dejaste." : "Elige el inventario que vas a hacer."}</p>
          <div className="ca-opciones">
            {dias.map((d) => (
              <button
                key={d.modo}
                type="button"
                className={`ca-opcion ${modo === d.modo ? "elegida" : ""}`}
                style={d.motivo ? { opacity: 0.6 } : undefined}
                aria-disabled={!!d.motivo}
                onClick={() => (d.motivo ? setError(d.motivo) : elegirDia(d.modo))}
              >
                <span>
                  {formatLongDayDate(d.fecha)}
                  <small className={d.motivo ? undefined : "ca-sub"}>
                    {d.motivo || (d.modo === "jueves" ? "Parcial · solo proveedores del jueves" : "Completo · todos los proveedores")}
                  </small>
                </span>
                {modo === d.modo && <Check size={20} className="ca-check" />}
              </button>
            ))}
          </div>
          {error && <p className="inv-error" role="alert">{error}</p>}
        </>
      )}

      {paso.t === "forma" && (
        <>
          <h2 className="ca-pregunta">¿Cómo vas a contar?</h2>
          <p className="ca-ayuda">{formatLongDayDate(fecha)}. Puedes cambiarlo antes de guardar.</p>
          <div className="ca-opciones">
            <Opcion elegida={forma === "proveedor"} onClick={() => setForma("proveedor")}>
              Por proveedor
              <small className="ca-sub">Un proveedor a la vez, cada producto en su renglón</small>
            </Opcion>
            <Opcion elegida={forma === "libre"} onClick={() => setForma("libre")}>
              Sin ningún orden
              <small className="ca-sub">Buscas cada producto que vas viendo y pones la cantidad</small>
            </Opcion>
          </div>
        </>
      )}

      {paso.t === "prov" && (
        <>
          {buscador}
          <h2 className="ca-pregunta">{paso.g.nombre}</h2>
          <p className="ca-ayuda">
            {paso.g.items.length} productos · {contadosDe(paso.g)} contados
          </p>
          {paso.g.items.map((i) => (
            <div key={i.id} className="ca-campo inv-prod">
              <span>
                {i.nombre}
                {repetido(i) && <small className="inv-prod-area"> · {NOMBRE_AREA[i.area]}</small>}
              </span>
              <div className="inv-prod-fila">
                <input
                  className="num-input ca-grande"
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={`Cantidad de ${i.nombre}`}
                  value={valores[i.id] ?? ""}
                  onChange={(e) => {
                    setError("");
                    setValores((v) => ({ ...v, [i.id]: e.target.value }));
                  }}
                />
                <b className="inv-prod-unidad">{unidadConteo(i)}</b>
                <button
                  type="button"
                  className={`inv-nohay ${valores[i.id] === "0" ? "activo" : ""}`}
                  onClick={() => setValores((v) => ({ ...v, [i.id]: v[i.id] === "0" ? "" : "0" }))}
                >
                  No hay
                </button>
              </div>
            </div>
          ))}
          {error && <p className="inv-error" role="alert">{error}</p>}
        </>
      )}

      {paso.t === "libre" && (
        <>
          <h2 className="ca-pregunta">Cuenta lo que vas viendo</h2>
          <p className="ca-ayuda">Busca cada producto y pon la cantidad con el teclado. Toca uno de la lista para cambiarlo.</p>
          <BuscadorInventario
            productos={productosDelDia}
            contado={contadoDe}
            detalle={detalleProducto}
            onGuardar={guardarDesdeBuscador}
            contados={contadosLibre}
            onQuitar={(i) => quitarLinea((l) => idDeLinea(l) === i.id)}
            sueltos={sueltosLibre}
            onQuitarSuelto={(linea) => quitarLinea((l) => l.trim() === linea)}
          />
          {error && <p className="inv-error" role="alert">{error}</p>}
        </>
      )}

      {paso.t === "faltan" && (
        <>
          <h2 className="ca-pregunta">Faltó contar esto</h2>
          <p className="ca-ayuda">Los marcados se guardan como 0 (no hay). Desmarca los que sí hay y regresa a contarlos.</p>
          <div className="faltan-lista">
            {[
              ...proveedores.map((p) => ({ key: p.id, nombre: p.nombre, items: faltan.filter((i) => i.proveedorId === p.id) })),
              { key: "sin", nombre: "Sin proveedor", items: faltan.filter((i) => !i.proveedorId || !proveedores.some((p) => p.id === i.proveedorId)) },
            ]
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <div key={g.key} className="faltan-grupo">
                  <span className="insumos-grupo-titulo">{g.nombre}</span>
                  {g.items.map((i) => (
                    <label key={i.id} className="faltan-item">
                      <input
                        type="checkbox"
                        checked={!desmarcados.has(i.id)}
                        onChange={() =>
                          setDesmarcados((s) => {
                            const n = new Set(s);
                            if (n.has(i.id)) n.delete(i.id);
                            else n.add(i.id);
                            return n;
                          })
                        }
                      />
                      {i.nombre}
                      {repetido(i) && <small className="inv-prod-area"> · {NOMBRE_AREA[i.area]}</small>}
                    </label>
                  ))}
                </div>
              ))}
          </div>
        </>
      )}

      {paso.t === "resumen" && (
        <>
          <h2 className="ca-pregunta">Revisa y guarda</h2>
          <p className="ca-ayuda">
            {formatLongDayDate(fecha)} · {contadosTotal} contados · {enCero} en 0
          </p>
          <div className="ca-opciones">
            {forma === "proveedor" ? (
              grupos.map((g) => {
                const n = g.items.filter((i) => (valores[i.id] ?? "") !== "" || (!desmarcados.has(i.id) && faltan.some((f) => f.id === i.id))).length;
                const falta = g.items.length - n;
                return (
                  <button key={g.key} type="button" className="ca-opcion inv-res" onClick={() => ir(pasos.findIndex((p) => p.t === "prov" && p.g.key === g.key))}>
                    <span>
                      {g.nombre}
                      <small className={falta > 0 ? undefined : "ca-sub"}>
                        {n} de {g.items.length} productos{falta > 0 ? ` · faltan ${falta}` : ""}
                      </small>
                    </span>
                    <span className={`inv-res-cambiar ${falta > 0 ? "falta" : ""}`}>
                      {falta > 0 ? <TriangleAlert size={18} /> : <Check size={18} />} Cambiar
                    </span>
                  </button>
                );
              })
            ) : (
              <button type="button" className="ca-opcion inv-res" onClick={() => ir(pasos.findIndex((p) => p.t === "libre"))}>
                <span>
                  Notas
                  <small className="ca-sub">{contadosTotal} renglones</small>
                </span>
                <span className="inv-res-cambiar">
                  <Check size={18} /> Cambiar
                </span>
              </button>
            )}
          </div>
          {confundibles.length > 0 && (
            <p className="inv-error" role="alert">
              <TriangleAlert size={15} style={{ verticalAlign: "-2px" }} /> Se llaman igual que otro producto del catálogo y podrían contarse en el equivocado:{" "}
              {confundibles.map((i) => i.nombre).join(", ")}. Avísale al dueño para corregir el catálogo.
            </p>
          )}
          {error && <p className="inv-error" role="alert">{error}</p>}
        </>
      )}

      {paso.t === "pedido" && guardado !== null && (
        <>
          <h2 className="ca-pregunta">Inventario guardado</h2>
          <p className="ca-ayuda">Ahora escribe lo que vas a pedir a cada proveedor.</p>
          {renderPedido(fecha, modo, guardado)}
        </>
      )}
    </MarcoAsistente>
  );
}
