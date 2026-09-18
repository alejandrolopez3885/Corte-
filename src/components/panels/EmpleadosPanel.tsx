import { ArrowLeft, Plus, Trash2, UsersRound } from "lucide-react";
import { Empty } from "../ui";
import type { EmpleadoEntry } from "../../lib/types";

export function EmpleadosPanel({
  onBack,
  onAdd,
  empleados,
  onRemove,
}: {
  onBack: () => void;
  onAdd: () => void;
  empleados: EmpleadoEntry[];
  onRemove: (id: string) => void;
}) {
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
        Lista de tu personal — por ahora solo el nombre. Es independiente del catálogo de meseros (ese es para el corte). Más
        adelante aquí mismo vas a poder armar horarios y nómina para cada quien.
      </p>

      {empleados.length === 0 ? (
        <Empty icon={<UsersRound size={26} strokeWidth={1.3} />} text="Aún no agregas a nadie. Toca + para agregar al primero." />
      ) : (
        <div className="catalog-list">
          {empleados.map((e) => (
            <div key={e.id} className="catalog-row">
              <strong>{e.nombre}</strong>
              <button className="icon-btn" onClick={() => onRemove(e.id)} aria-label={`Quitar a ${e.nombre}`}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
