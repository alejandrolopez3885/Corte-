import { useState } from "react";
import { ArrowLeft, Package } from "lucide-react";
import { Empty, Field, NumInput, Sheet, Toggle } from "../ui";
import { formatWeekRange, money, resolveWeekStartDate, sumFromText, todayIso } from "../../lib/dataModel";
import type { InsumoEntry, InventarioSemanal, InventarioSemanalMonthData, MonthData, ProveedorCatalogEntry } from "../../lib/types";

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
        <h2 className="page-title">Inventario</h2>
        <Empty icon={<Package size={26} strokeWidth={1.3} />} text="Primero crea un mes en Corte para poder llevar el inventario." />
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
      <h2 className="page-title">Inventario</h2>
      <p className="hint">
        Domingo: cuenta completa de todos los proveedores. Jueves: solo los proveedores marcados abajo.
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
  const [textos, setTextos] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    grupos.forEach((g) =>
      g.items.forEach((i) => {
        const f = semana.filas[i.id];
        init[i.id] = f?.cantidad !== undefined ? String(f.cantidad) : "";
      })
    );
    return init;
  });

  function commitCantidad(insumoId: string, valorTexto: string) {
    setTextos((v) => ({ ...v, [insumoId]: valorTexto }));
    const n = valorTexto.trim() ? sumFromText(valorTexto) : undefined;
    const nextFilas = { ...semana.filas, [insumoId]: { cantidad: n } };
    onGuardarSemana(monthKey, weekIndex, { ...semana, filas: nextFilas });
  }

  if (grupos.length === 0) {
    return <Empty icon={<Package size={26} strokeWidth={1.3} />} text={emptyText} />;
  }

  return (
    <>
      {grupos.map((g) => (
        <div className="insumos-grupo" key={g.key}>
          <h3 className="insumos-grupo-titulo">{g.nombre}</h3>
          <div className="catalog-list">
            {g.items.map((i) => (
              <div key={i.id} className="catalog-row conteo-row">
                <div>
                  <strong>{i.nombre}</strong>
                  <span>
                    {i.unidad}
                    {i.precio ? ` · ${money(i.precio)}` : ""}
                  </span>
                </div>
                <NumInput
                  value={textos[i.id] ?? ""}
                  onChange={(e) => commitCantidad(i.id, e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
