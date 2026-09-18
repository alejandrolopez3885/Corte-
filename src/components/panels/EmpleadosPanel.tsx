import { ArrowLeft, Plus, UsersRound } from "lucide-react";
import { Empty } from "../ui";
import { money } from "../../lib/dataModel";
import type { EmpleadoEntry } from "../../lib/types";

export function EmpleadosPanel({
  onBack,
  onAdd,
  onEdit,
  empleados,
}: {
  onBack: () => void;
  onAdd: () => void;
  onEdit: (entry: EmpleadoEntry) => void;
  empleados: EmpleadoEntry[];
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
        Lista de tu personal, independiente del catálogo de meseros (ese es para el corte). Toca a alguien para editar su
        nombre o sueldo diario.
      </p>

      {empleados.length === 0 ? (
        <Empty icon={<UsersRound size={26} strokeWidth={1.3} />} text="Aún no agregas a nadie. Toca + para agregar al primero." />
      ) : (
        <div className="catalog-list">
          {empleados.map((e) => (
            <button key={e.id} className="catalog-row catalog-row-button" onClick={() => onEdit(e)}>
              <div>
                <strong>{e.nombre}</strong>
                <span>{e.sueldoDiario ? `${money(e.sueldoDiario)} / día` : "Sin sueldo diario capturado"}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
