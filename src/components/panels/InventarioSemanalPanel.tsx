import { useState } from "react";
import { ArrowLeft, Package } from "lucide-react";
import { Empty, Field, NumInput, Sheet, SumInput, Toggle } from "../ui";
import { computeInventarioFila, formatWeekRange, money, resolveWeekStartDate, sumFromText, todayIso } from "../../lib/dataModel";
import type { InsumoEntry, InventarioFila, InventarioSemanal, InventarioSemanalMonthData, MonthData, ProveedorCatalogEntry } from "../../lib/types";

type Modo = "completo" | "jueves";

function esHoyJueves(): boolean {
  return new Date(`${todayIso()}T00:00:00`).getDay() === 4;
}

export function InventarioSemanalPanel({
  onBack,
  insumos,
  proveedores,
  months,
  monthKeys,
  initialMonthKey,
  initialWeekIndex,
  inventarioSemanal,
  onGuardarSemana,
  onToggleProveedorJueves,
}: {
  onBack: () => void;
  insumos: InsumoEntry[];
  proveedores: ProveedorCatalogEntry[];
  months: Record<string, MonthData>;
  monthKeys: string[];
  initialMonthKey: string;
  initialWeekIndex: number;
  inventarioSemanal: Record<string, InventarioSemanalMonthData>;
  onGuardarSemana: (monthKey: string, weekIndex: number, inventario: InventarioSemanal) => void;
  onToggleProveedorJueves: (proveedorId: string, incluyeJueves: boolean) => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [modo, setModo] = useState<Modo>(() => (esHoyJueves() ? "jueves" : "completo"));
  const [editandoProveedores, setEditandoProveedores] = useState(false);

  const month = months[monthKey] || null;

  if (monthKeys.length === 0 || !month) {
    return (
      <div className="page-section">
        <button className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={15} /> Negocio
        </button>
        <h2 className="page-title">Pedidos a proveedores</h2>
        <Empty icon={<Package size={26} strokeWidth={1.3} />} text="Primero crea un mes en Corte para poder llevar el inventario semanal." />
      </div>
    );
  }

  const weekStartDate = resolveWeekStartDate(monthKey, weekIndex, month);
  const semana: InventarioSemanal = inventarioSemanal[monthKey]?.weeks?.[weekIndex] ?? { filas: {} };

  const proveedoresDelModo = modo === "completo" ? proveedores : proveedores.filter((p) => p.incluyeJueves);
  const grupos: { key: string; nombre: string; items: InsumoEntry[] }[] = [];
  proveedoresDelModo.forEach((p) => {
    const items = insumos.filter((i) => i.proveedorId === p.id);
    if (items.length > 0) grupos.push({ key: p.id, nombre: p.nombre, items });
  });
  if (modo === "completo") {
    const sinProveedor = insumos.filter((i) => !i.proveedorId);
    if (sinProveedor.length > 0) grupos.push({ key: "sin", nombre: "Sin proveedor", items: sinProveedor });
  }

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Pedidos a proveedores</h2>
      <p className="hint">
        Domingo: cuenta completa de todos los proveedores para decidir el pedido que llega el lunes. Jueves: solo los
        proveedores marcados abajo, para el pedido parcial que llega el viernes.
      </p>

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
          Pedido completo
        </button>
        <button type="button" className={modo === "jueves" ? "active" : ""} onClick={() => setModo("jueves")}>
          Pedido jueves
        </button>
      </div>
      <button className="link-btn" onClick={() => setEditandoProveedores(true)}>
        Editar proveedores del jueves
      </button>

      <InventarioSemanaForm
        key={`${monthKey}-${weekIndex}`}
        monthKey={monthKey}
        weekIndex={weekIndex}
        grupos={grupos}
        semana={semana}
        emptyText={
          modo === "jueves"
            ? "Ningún proveedor está marcado para el pedido del jueves todavía. Márcalos con \"Editar proveedores del jueves\"."
            : "Aún no tienes insumos en el catálogo de Bar o Cocina."
        }
        onGuardarSemana={onGuardarSemana}
      />

      {editandoProveedores && (
        <Sheet title="Proveedores del jueves" onClose={() => setEditandoProveedores(false)}>
          {proveedores.length === 0 ? (
            <p className="hint">Aún no tienes proveedores. Se crean desde el Catálogo de Bar o Cocina al agregar un insumo.</p>
          ) : (
            <div className="horario-emp-list">
              {proveedores.map((p) => (
                <Toggle
                  key={p.id}
                  checked={!!p.incluyeJueves}
                  onChange={(v) => onToggleProveedorJueves(p.id, v)}
                  label={p.nombre}
                />
              ))}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

function InventarioSemanaForm({
  monthKey,
  weekIndex,
  grupos,
  semana,
  emptyText,
  onGuardarSemana,
}: {
  monthKey: string;
  weekIndex: number;
  grupos: { key: string; nombre: string; items: InsumoEntry[] }[];
  semana: InventarioSemanal;
  emptyText: string;
  onGuardarSemana: (monthKey: string, weekIndex: number, inventario: InventarioSemanal) => void;
}) {
  const [textos, setTextos] = useState<Record<string, { inicio: string; compras: string; fin: string }>>(() => {
    const init: Record<string, { inicio: string; compras: string; fin: string }> = {};
    grupos.forEach((g) =>
      g.items.forEach((i) => {
        const f = semana.filas[i.id];
        init[i.id] = {
          inicio: f?.cantidadInicio !== undefined ? String(f.cantidadInicio) : "",
          compras: f?.comprasSemana !== undefined ? String(f.comprasSemana) : "",
          fin: f?.cantidadFin !== undefined ? String(f.cantidadFin) : "",
        };
      })
    );
    return init;
  });
  const [ventaTexto, setVentaTexto] = useState(semana.ventaSemana ? String(semana.ventaSemana) : "");

  function commitCampo(insumoId: string, campo: "inicio" | "compras" | "fin", valorTexto: string) {
    setTextos((v) => ({ ...v, [insumoId]: { ...v[insumoId], [campo]: valorTexto } }));
    const n = valorTexto.trim() ? sumFromText(valorTexto) : undefined;
    const key: keyof InventarioFila = campo === "inicio" ? "cantidadInicio" : campo === "compras" ? "comprasSemana" : "cantidadFin";
    const prevFila = semana.filas[insumoId] || {};
    const nextFilas = { ...semana.filas, [insumoId]: { ...prevFila, [key]: n } };
    onGuardarSemana(monthKey, weekIndex, { ...semana, filas: nextFilas });
  }

  function commitVenta(valorTexto: string) {
    setVentaTexto(valorTexto);
    onGuardarSemana(monthKey, weekIndex, { ...semana, ventaSemana: valorTexto.trim() ? sumFromText(valorTexto) : undefined });
  }

  return (
    <>
      <Field label="Venta total de la semana (opcional, para referencia)">
        <SumInput value={ventaTexto} onChange={commitVenta} placeholder="0.00" />
      </Field>

      {grupos.length === 0 ? (
        <Empty icon={<Package size={26} strokeWidth={1.3} />} text={emptyText} />
      ) : (
        grupos.map((g) => (
          <div className="insumos-grupo" key={g.key}>
            <h3 className="insumos-grupo-titulo">{g.nombre}</h3>
            <div className="catalog-list">
              {g.items.map((i) => {
                const t = textos[i.id] || { inicio: "", compras: "", fin: "" };
                const { consumo, costoConsumo } = computeInventarioFila(semana.filas[i.id], i.precio);
                return (
                  <div key={i.id} className="inventario-fila">
                    <div className="inventario-fila-head">
                      <strong>{i.nombre}</strong>
                      <span>
                        {i.unidad}
                        {i.precio ? ` · ${money(i.precio)}` : ""}
                      </span>
                    </div>
                    <div className="inventario-campos">
                      <label>
                        <span>Inicio (lun)</span>
                        <NumInput value={t.inicio} onChange={(e) => commitCampo(i.id, "inicio", e.target.value)} placeholder="0" />
                      </label>
                      <label>
                        <span>Compras</span>
                        <NumInput value={t.compras} onChange={(e) => commitCampo(i.id, "compras", e.target.value)} placeholder="0" />
                      </label>
                      <label>
                        <span>Fin (dom)</span>
                        <NumInput value={t.fin} onChange={(e) => commitCampo(i.id, "fin", e.target.value)} placeholder="0" />
                      </label>
                    </div>
                    {(t.inicio || t.compras || t.fin) && (
                      <p className="inventario-resumen">
                        Consumo: {consumo} {i.unidad}
                        {i.precio ? ` · ${money(costoConsumo)}` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </>
  );
}
