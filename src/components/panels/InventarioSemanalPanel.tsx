import { useState } from "react";
import { ArrowLeft, Package, TriangleAlert } from "lucide-react";
import { Empty, Field, NumInput, Sheet } from "../ui";
import { dateForDay, formatWeekRange, money, resolveWeekStartDate, sumFromText, todayIso } from "../../lib/dataModel";
import type { InsumoArea, InsumoEntry, InventarioFila, InventarioSemanal, InventarioSemanalMonthData, MonthData, ProveedorCatalogEntry } from "../../lib/types";

type Modo = "completo" | "jueves";
type AreaFiltro = "todas" | InsumoArea;

const AREA_LABEL: Record<InsumoArea, string> = { bar: "Bar", cocina: "Cocina", general: "General" };

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
  conteosDiarios,
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
  conteosDiarios: Record<string, Record<string, number>>;
  onGuardarSemana: (monthKey: string, weekIndex: number, inventario: InventarioSemanal) => void;
  onEditarProveedores: () => void;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [modo, setModo] = useState<Modo>(() => (esHoyJueves() ? "jueves" : "completo"));
  const [areaFiltro, setAreaFiltro] = useState<AreaFiltro>("todas");

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

  // El Conteo diario del insumo de alta rotación manda sobre lo que se
  // vería aquí — se hace más tarde en el día, así que es más real. Completo
  // se cuenta el domingo, Jueves el jueves; se usa la fecha real de cada
  // uno para leer ese día exacto de conteosDiarios.
  const fechaDelModo =
    modo === "completo"
      ? dateForDay(monthKey, weekIndex, month, "Domingo")
      : dateForDay(monthKey, weekIndex, month, "Jueves");
  const conteoDelDia = conteosDiarios[fechaDelModo] || {};

  const insumosDelArea = areaFiltro === "todas" ? insumos : insumos.filter((i) => i.area === areaFiltro);
  const proveedoresDelModo = modo === "completo" ? proveedores : proveedores.filter((p) => p.incluyeJueves);
  const grupos: { key: string; nombre: string; items: InsumoEntry[] }[] = [];
  proveedoresDelModo.forEach((p) => {
    const items = insumosDelArea.filter((i) => i.proveedorId === p.id);
    if (items.length > 0) grupos.push({ key: p.id, nombre: p.nombre, items });
  });
  if (modo === "completo") {
    const sinProveedor = insumosDelArea.filter((i) => !i.proveedorId);
    if (sinProveedor.length > 0) grupos.push({ key: "sin", nombre: "Sin proveedor", items: sinProveedor });
  }

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Negocio
      </button>
      <h2 className="page-title">Inventario</h2>
      <p className="hint">
        Domingo: cuenta completa de todos los proveedores. Jueves: solo los proveedores marcados abajo. Los insumos de
        alta rotación no se capturan aquí — se ven bloqueados porque reflejan directo lo que ya tengas en Conteo diario
        de ese mismo día.
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

      <div className="segmented">
        <button type="button" className={areaFiltro === "todas" ? "active" : ""} onClick={() => setAreaFiltro("todas")}>
          Todas
        </button>
        {(Object.keys(AREA_LABEL) as InsumoArea[]).map((a) => (
          <button key={a} type="button" className={areaFiltro === a ? "active" : ""} onClick={() => setAreaFiltro(a)}>
            {AREA_LABEL[a]}
          </button>
        ))}
      </div>

      <InventarioSemanaForm
        key={`${monthKey}-${weekIndex}-${areaFiltro}`}
        monthKey={monthKey}
        weekIndex={weekIndex}
        grupos={grupos}
        semana={semana}
        conteoDelDia={conteoDelDia}
        emptyText={
          modo === "jueves"
            ? "Ningún proveedor está marcado para el jueves todavía. Márcalos con \"Editar proveedores del jueves\"."
            : areaFiltro === "todas"
              ? "Aún no tienes insumos en el catálogo de Bar o Cocina."
              : `Aún no tienes insumos en el catálogo de ${AREA_LABEL[areaFiltro]}.`
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
  conteoDelDia,
  emptyText,
  onGuardarSemana,
}: {
  monthKey: string;
  weekIndex: number;
  grupos: { key: string; nombre: string; items: InsumoEntry[] }[];
  semana: InventarioSemanal;
  conteoDelDia: Record<string, number>;
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
  // Bloqueado solo si el área/proveedores visibles ahora ya tienen algo
  // guardado — así contar un área nueva de la misma semana no queda
  // bloqueado solo porque otra área ya se guardó antes.
  const [locked, setLocked] = useState(() =>
    grupos.some((g) => g.items.some((i) => i.id in semana.filas))
  );
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false);

  function guardar() {
    const nextFilas: Record<string, InventarioFila> = { ...semana.filas };
    grupos.forEach((g) =>
      g.items.forEach((i) => {
        if (i.altaRotacion) {
          nextFilas[i.id] = { cantidad: conteoDelDia[i.id] };
          return;
        }
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
            {g.items.map((i) => {
              const valorConteoDiario = conteoDelDia[i.id];
              return (
                <div key={i.id} className="catalog-row conteo-row">
                  <div>
                    <strong>{i.nombre}</strong>
                    <span>
                      {i.unidad}
                      {i.precio ? ` · ${money(i.precio)}` : ""}
                    </span>
                    {i.altaRotacion && <span className="pedido-inventario-ref">De Conteo diario</span>}
                  </div>
                  <NumInput
                    value={i.altaRotacion ? (valorConteoDiario !== undefined ? String(valorConteoDiario) : "") : (textos[i.id] ?? "")}
                    onChange={(e) => setTextos((v) => ({ ...v, [i.id]: e.target.value }))}
                    placeholder="0"
                    disabled={locked || !!i.altaRotacion}
                  />
                </div>
              );
            })}
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
