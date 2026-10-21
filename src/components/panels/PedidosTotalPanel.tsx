import { useState } from "react";
import { ArrowLeft, ShoppingCart, TriangleAlert } from "lucide-react";
import { Empty, Field } from "../ui";
import {
  dateForDay,
  formatWeekRange,
  normalizarNombre,
  pidePorOtraUnidad,
  pluralizarUnidad,
  resolveWeekStartDate,
  todayIso,
  unidadConteo,
} from "../../lib/dataModel";
import { DAYS, DAY_SHORT } from "../../lib/types";
import type { ConteoTextoArea, DayName, InsumoEntry, MonthData, ProveedorCatalogEntry } from "../../lib/types";
import type { PedidoCargado } from "../../lib/pedidosCargados";
import { SIN_PROVEEDOR } from "./CargarPedidosPanel";

// Negocio > Pedidos: solo consulta. Suma lo guardado con "Guardar pedido"
// en el Conteo diario (Cocina y Bar, lunes a domingo) y en el Inventario
// del jueves y del domingo de la semana elegida, por proveedor y producto.
// El total se pasa a la unidad en que se cuenta (kg/pz) con la
// equivalencia del catálogo ("1 caja = 10 kg"), para que cuadre con el
// inventario inicial y final.
export function PedidosTotalPanel({
  onBack,
  insumos,
  proveedores,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  pedidosDiarios,
  pedidosInventario,
  pedidosCargados,
}: {
  onBack: () => void;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  pedidosDiarios: Record<ConteoTextoArea, Record<string, Record<string, number>>>;
  pedidosInventario: Record<string, Record<string, number>>;
  pedidosCargados: Record<string, Record<string, PedidoCargado>>;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const month = months[monthKey] || null;

  if (monthKeys.length === 0 || !month) {
    return (
      <div className="page-section">
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> Negocio
        </button>
        <h2 className="page-title">Pedidos</h2>
        <Empty icon={<ShoppingCart size={26} strokeWidth={1.3} />} text="Primero crea un mes en Corte para poder ver los pedidos." />
      </div>
    );
  }

  const hoy = todayIso();
  const fechas = Object.fromEntries(DAYS.map((d) => [d, dateForDay(monthKey, weekIndex, month, d)])) as Record<DayName, string>;
  const porNombre = new Map(insumos.map((i) => [normalizarNombre(i.nombre), i]));
  // Pedidos pegados de WhatsApp: el proveedor que ya tiene su semana cargada
  // se toma de ahí, sin los pedidos sueltos del Conteo diario / Inventario.
  const lunes = resolveWeekStartDate(monthKey, weekIndex, month);
  const cargadosSemana = pedidosCargados[lunes] || {};
  const provCargado = (clave: string) => {
    const prov = porNombre.get(clave)?.proveedorId || SIN_PROVEEDOR;
    return cargadosSemana[prov] !== undefined;
  };

  // Producto -> de dónde salió cada cantidad (en la presentación de pedido).
  const productos = new Map<string, { nombre: string; insumo?: InsumoEntry; fuentes: { etiqueta: string; inv: boolean; cantidad: number }[] }>();
  function sumar(clave: string, etiqueta: string, inv: boolean, cantidad: number, cargado = false) {
    if (!(cantidad > 0)) return;
    if (!cargado && provCargado(clave)) return;
    const insumo = porNombre.get(clave);
    if (!productos.has(clave)) productos.set(clave, { nombre: insumo?.nombre || clave.charAt(0).toUpperCase() + clave.slice(1), insumo, fuentes: [] });
    const fuentes = productos.get(clave)!.fuentes;
    const previa = fuentes.find((f) => f.etiqueta === etiqueta && f.inv === inv);
    if (previa) previa.cantidad += cantidad;
    else fuentes.push({ etiqueta, inv, cantidad });
  }
  DAYS.forEach((d) => {
    (["cocina", "bar"] as ConteoTextoArea[]).forEach((area) => {
      Object.entries(pedidosDiarios[area]?.[fechas[d]] || {}).forEach(([clave, n]) => sumar(clave, DAY_SHORT[d], false, n));
    });
  });
  (["Jueves", "Domingo"] as DayName[]).forEach((d) => {
    Object.entries(pedidosInventario[fechas[d]] || {}).forEach(([clave, n]) => sumar(clave, `Inv. ${DAY_SHORT[d]}`, true, n));
  });

  Object.values(cargadosSemana).forEach((c) =>
    Object.entries(c.cantidades).forEach(([clave, n]) => sumar(clave, "Cargado", false, n, true))
  );

  const grupos = new Map<string, string[]>();
  productos.forEach((p, clave) => {
    const key = p.insumo?.proveedorId && proveedores.some((x) => x.id === p.insumo!.proveedorId) ? p.insumo.proveedorId : "sin";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(clave);
  });
  const orden = proveedores.filter((p) => grupos.has(p.id)).map((p) => ({ key: p.id, nombre: p.nombre }));
  if (grupos.has("sin")) orden.push({ key: "sin", nombre: "Sin proveedor" });

  // Qué ya está guardado en la semana.
  const diaConPedido = (d: DayName) =>
    (["cocina", "bar"] as ConteoTextoArea[]).some((a) => pedidosDiarios[a]?.[fechas[d]] !== undefined);
  const diasSinPedido = DAYS.filter((d) => fechas[d] < hoy && !diaConPedido(d));
  // Proveedores de Cocina (los que pide el jefe de cocina) y si ya tienen
  // su semana cargada.
  const proveedoresConInsumos = proveedores.filter((p) => insumos.some((i) => i.proveedorId === p.id && i.area === "cocina"));
  const sinCargar = proveedoresConInsumos.filter((p) => !cargadosSemana[p.id]);
  const estado = (guardado: boolean, fecha: string) => (guardado ? "ok" : fecha < hoy ? "falta" : "futuro");

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Pedidos</h2>
      <p className="hint">Total de lo pedido en la semana, hasta hoy.</p>

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
      <p className="hint">{formatWeekRange(resolveWeekStartDate(monthKey, weekIndex, month))}</p>

      <div className="pedidos-estado">
        <div className="pedidos-estado-fila">
          <span>Conteo diario</span>
          <span className="pedidos-estado-dias">
            {DAYS.map((d) => (
              <span key={d} className={`pedidos-dia ${estado(diaConPedido(d), fechas[d])}`}>
                {DAY_SHORT[d]}
              </span>
            ))}
          </span>
        </div>
        <div className="pedidos-estado-fila">
          <span>Inventario</span>
          <span className="pedidos-estado-dias">
            {(["Jueves", "Domingo"] as DayName[]).map((d) => (
              <span key={d} className={`pedidos-dia ancho ${estado(pedidosInventario[fechas[d]] !== undefined, fechas[d])}`}>
                {DAY_SHORT[d]}
              </span>
            ))}
          </span>
        </div>
        <div className="pedidos-estado-fila">
          <span>Cargados</span>
          <span className="pedidos-estado-cargados">
            {proveedoresConInsumos.length === 0
              ? "—"
              : `${proveedoresConInsumos.filter((p) => cargadosSemana[p.id]).length} de ${proveedoresConInsumos.length} proveedores`}
          </span>
        </div>
        {sinCargar.length > 0 && Object.keys(cargadosSemana).length > 0 && (
          <span className="pedidos-estado-aviso">
            <TriangleAlert size={13} /> Sin pedido cargado: {sinCargar.map((p) => p.nombre).join(", ")}
          </span>
        )}
        {diasSinPedido.length > 0 && (
          <span className="pedidos-estado-aviso">
            <TriangleAlert size={13} /> Sin pedido guardado en Conteo diario: {diasSinPedido.map((d) => DAY_SHORT[d]).join(", ")}
          </span>
        )}
      </div>

      {orden.length === 0 ? (
        <Empty icon={<ShoppingCart size={26} strokeWidth={1.3} />} text="Todavía no hay pedidos guardados esta semana." />
      ) : (
        orden.map((g) => (
          <div className="insumos-grupo" key={g.key}>
            <h3 className="insumos-grupo-titulo pedidos-grupo-titulo">
              <span>
                {g.nombre}
                {cargadosSemana[g.key === "sin" ? SIN_PROVEEDOR : g.key] && (
                  <small className="pedidos-cargado">
                    ✓ Cargado por {cargadosSemana[g.key === "sin" ? SIN_PROVEEDOR : g.key].por} ·{" "}
                    {new Date(cargadosSemana[g.key === "sin" ? SIN_PROVEEDOR : g.key].en)
                      .toLocaleDateString("es-MX", { weekday: "short", day: "numeric" })
                      .replace(".", "")}
                  </small>
                )}
              </span>
              <span>
                {grupos.get(g.key)!.length} {grupos.get(g.key)!.length === 1 ? "producto" : "productos"}
              </span>
            </h3>
            <div className="catalog-list">
              {grupos.get(g.key)!.map((clave) => (
                <FilaTotal key={clave} {...productos.get(clave)!} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function FilaTotal({
  nombre,
  insumo,
  fuentes,
}: {
  nombre: string;
  insumo?: InsumoEntry;
  fuentes: { etiqueta: string; inv: boolean; cantidad: number }[];
}) {
  const pedido = fuentes.reduce((s, f) => s + f.cantidad, 0);
  const presentacion = insumo ? insumo.unidadPedido || unidadConteo(insumo) : "";
  const convierte = insumo ? pidePorOtraUnidad(insumo) : false;
  const faltaEquivalencia = convierte && !insumo?.equivalenciaPedido;

  let total = fmt(pedido);
  let unidad = pluralizarUnidad(presentacion, pedido);
  let cuenta: string | undefined;
  if (insumo && convierte && insumo.equivalenciaPedido) {
    total = fmt(pedido * insumo.equivalenciaPedido);
    unidad = unidadConteo(insumo);
    cuenta = `${fmt(pedido)} ${pluralizarUnidad(presentacion, pedido)} × ${fmt(insumo.equivalenciaPedido)} ${unidad}`;
  }

  return (
    <div className={`catalog-row pedidos-total-row ${faltaEquivalencia ? "falta-equivalencia" : ""}`}>
      <div>
        <strong>{nombre}</strong>
        <span>
          {fuentes.map((f, i) => (
            <span key={`${f.etiqueta}-${i}`} className={f.inv ? "pedidos-fuente-inv" : undefined}>
              {i > 0 && " · "}
              {f.etiqueta} {fmt(f.cantidad)}
            </span>
          ))}
        </span>
      </div>
      <span className="pedidos-total">
        {total} <small>{unidad}</small>
        {cuenta && <em>{cuenta}</em>}
        {faltaEquivalencia && <em>Falta “cuánto trae 1 {presentacion}”</em>}
        {!insumo && <em>No está en el catálogo</em>}
      </span>
    </div>
  );
}
