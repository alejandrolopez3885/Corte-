import { ArrowLeft, Plus, UsersRound } from "lucide-react";
import { Empty } from "../ui";
import { money } from "../../lib/dataModel";
import type { AreaEntry, EmpleadoEntry, PuestoEntry } from "../../lib/types";

export function EmpleadosPanel({
  onBack,
  onAdd,
  onEdit,
  empleados,
  areas,
  puestos,
}: {
  onBack: () => void;
  onAdd: () => void;
  onEdit: (entry: EmpleadoEntry) => void;
  empleados: EmpleadoEntry[];
  areas: AreaEntry[];
  puestos: PuestoEntry[];
}) {
  const puestoById = new Map(puestos.map((p) => [p.id, p]));

  const porArea = new Map<string, EmpleadoEntry[]>();
  const sinPuesto: EmpleadoEntry[] = [];
  empleados.forEach((e) => {
    const puesto = e.puestoId ? puestoById.get(e.puestoId) : undefined;
    if (!puesto) {
      sinPuesto.push(e);
      return;
    }
    if (!porArea.has(puesto.areaId)) porArea.set(puesto.areaId, []);
    porArea.get(puesto.areaId)!.push(e);
  });
  const grupos: { key: string; nombre: string; items: EmpleadoEntry[] }[] = [];
  areas.forEach((a) => {
    const items = porArea.get(a.id);
    if (items && items.length > 0) grupos.push({ key: a.id, nombre: a.nombre, items });
  });
  if (sinPuesto.length > 0) grupos.push({ key: "sin", nombre: "Sin puesto", items: sinPuesto });

  return (
    <div className="page-section">
      <button className="link-btn back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Equipo
      </button>
      <div className="page-title-row">
        <h2 className="page-title">Personal</h2>
        <button className="icon-btn accent" onClick={onAdd} aria-label="Agregar empleado">
          <Plus size={18} />
        </button>
      </div>
      <p className="hint">
        Lista de tu personal, independiente del catálogo de meseros (ese es para el corte), agrupada por área según el
        puesto de cada quien. Toca a alguien para editar su nombre, puesto o sueldo diario.
      </p>

      {empleados.length === 0 ? (
        <Empty icon={<UsersRound size={26} strokeWidth={1.3} />} text="Aún no agregas a nadie. Toca + para agregar al primero." />
      ) : (
        grupos.map((g) => (
          <div className="insumos-grupo" key={g.key}>
            <h3 className="insumos-grupo-titulo">{g.nombre}</h3>
            <div className="catalog-list">
              {g.items.map((e) => {
                const puesto = e.puestoId ? puestoById.get(e.puestoId) : undefined;
                return (
                  <button key={e.id} className="catalog-row catalog-row-button" onClick={() => onEdit(e)}>
                    <div>
                      <strong>{e.nombre}</strong>
                      <span>
                        {puesto ? puesto.nombre : "Sin puesto"}
                        {e.sueldoDiario ? ` · ${money(e.sueldoDiario)} / día` : " · sin sueldo diario"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
