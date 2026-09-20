import { useState } from "react";
import { ArrowLeft, Package, TriangleAlert } from "lucide-react";
import { Empty, Field, NumInput, Sheet } from "../ui";
import { formatWeekRange, money, resolveWeekStartDate, sumFromText, todayIso } from "../../lib/dataModel";
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
  onEditarProveedores,
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
  onEditarProveedores: () => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [modo, setModo] = useState<Modo>(() => (esHoyJueves() ? "jueves" : "completo"));

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
          Completo
        </button>
        <button type="button" className={modo === "jueves" ? "active" : ""} onClick={() => setModo("jueves")}>
          Jueves
        </button>
      </div>
      <button className="link-btn" onClick={onEditarProveedores}>
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
            ? "Ningún proveedor está marcado para el jueves todavía. Márcalos con \"Editar proveedores del jueves\"."
            : "Aún no tienes insumos en el catálogo de Bar o Cocina."
        }
        onGuardarSemana={onGuardarSemana}
      />
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
  // Se siembra de semana.filas completo (no solo de los grupos visibles
  // del modo actual), para que cambiar entre Completo/Jueves sin cambiar
  // de semana nunca muestre en blanco una cantidad que ya estaba guardada
  // bajo el otro modo.
  const [textos, setTextos] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    Object.entries(semana.filas).forEach(([insumoId, fila]) => {
      if (fila.cantidad !== undefined) init[insumoId] = String(fila.cantidad);
    });
    return init;
  });
  const [locked, setLocked] = useState(() => Object.keys(semana.filas).length > 0);
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false);

  function guardar() {
    const nextFilas: Record<string, InventarioFila> = { ...semana.filas };
    grupos.forEach((g) =>
      g.items.forEach((i) => {
        const t = textos[i.id];
        nextFilas[i.id] = { cantidad: t?.trim() ? sumFromText(t) : undefined };
      })
    );
    onGuardarSemana(monthKey, weekIndex, { ...semana, filas: nextFilas });
    setLocked(true);
  }

  if (grupos.length === 0) {
    return <Empty icon={<Package size={26} strokeWidth={1.3} />} text={emptyText} />;
  }

  return (
    <>
      {locked && (
        <div className="conteo-locked-banner">
          <span>Este inventario ya está guardado y los campos están bloqueados.</span>
          <button className="link-btn" onClick={() => setPidiendoConfirmacion(true)}>
            Editar
          </button>
        </div>
      )}
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
                  onChange={(e) => setTextos((v) => ({ ...v, [i.id]: e.target.value }))}
                  placeholder="0"
                  disabled={locked}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button className="btn-primary" onClick={guardar} disabled={locked}>
        Guardar inventario
      </button>

      {pidiendoConfirmacion && (
        <Sheet title="Editar inventario guardado" onClose={() => setPidiendoConfirmacion(false)}>
          <p className="hint">
            Este inventario ya se guardó. No deberías editarlo salvo que estés seguro de que algún valor
            capturado está mal — cambiarlo afecta tu historial de inventario de esta semana.
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
