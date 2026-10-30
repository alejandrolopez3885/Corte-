import { Clock, KeyRound, LogOut, Plus, TrendingDown, TrendingUp, UsersRound } from "lucide-react";
import { Empty } from "../ui";
import { Avatar } from "../Avatar";
import { money, sueldoEnFecha } from "../../lib/dataModel";
import { antiguedad, fechaCorta, mesCorto, resumenSueldo } from "../../lib/sueldo";
import type { AreaEntry, EmpleadoEntry, PuestoEntry } from "../../lib/types";
import { TituloPagina } from "../BarraTitulo";

export function EmpleadosPanel({
  onBack,
  onAdd,
  onEdit,
  empleados,
  tuId,
  fotoTu,
  areas,
  puestos,
}: {
  onBack: () => void;
  onAdd: () => void;
  onEdit: (entry: EmpleadoEntry) => void;
  empleados: EmpleadoEntry[];
  // El dueño, si está en Personal: su fila lleva su foto y "Tú".
  tuId?: string;
  fotoTu?: string;
  areas: AreaEntry[];
  puestos: PuestoEntry[];
}) {
  const puestoById = new Map(puestos.map((p) => [p.id, p]));

  const porArea = new Map<string, EmpleadoEntry[]>();
  const sinPuesto: EmpleadoEntry[] = [];
  const inactivos = empleados.filter((e) => e.inactivo);
  empleados.filter((e) => !e.inactivo).forEach((e) => {
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
  // Los que ya no trabajan aquí, al final (se conserva su historial).
  if (inactivos.length > 0) grupos.push({ key: "inactivos", nombre: "Inactivos", items: inactivos });
  const activos = empleados.filter((e) => !e.inactivo);
  const baseSemanal = activos.reduce((t, e) => t + sueldoEnFecha(e) * 7, 0);
  const conAntiguedad = activos.filter((e) => e.fechaIngreso);

  return (
    <div className="page-section">
      <TituloPagina titulo="Personal" onBack={onBack} backLabel="Equipo" />
      <div className="page-title-row">
        <button className="icon-btn accent" onClick={onAdd} aria-label="Agregar empleado">
          <Plus size={18} />
        </button>
      </div>
      <p className="hint">
        Lista de tu personal, independiente del catálogo de meseros (ese es para el corte), agrupada por área según el
        puesto de cada quien. Toca a alguien para ver y editar sus datos, su sueldo con su historial de aumentos y su acceso a la app.
      </p>

      {activos.length > 0 && (
        <div className="emp-resumen">
          <div>
            <b>{activos.length}</b>
            <small>{activos.length === 1 ? "activo" : "activos"}</small>
          </div>
          <div>
            <b>{money(baseSemanal)}</b>
            <small>sueldos por semana completa</small>
          </div>
          {conAntiguedad.length > 0 && (
            <div>
              <b>{antiguedad([...conAntiguedad].sort((a, b) => a.fechaIngreso!.localeCompare(b.fechaIngreso!))[0].fechaIngreso!)}</b>
              <small>el de más antigüedad</small>
            </div>
          )}
        </div>
      )}

      {empleados.length === 0 ? (
        <Empty icon={<UsersRound size={26} strokeWidth={1.3} />} text="Aún no agregas a nadie. Toca + para agregar al primero." />
      ) : (
        grupos.map((g) => (
          <div className={`insumos-grupo ${g.key === "inactivos" ? "emp-inactivos" : ""}`} key={g.key}>
            <h3 className="insumos-grupo-titulo">
              {g.nombre} <span className="emp-grupo-n">{g.items.length}</span>
            </h3>
            <div className="emp-tarjetas">
              {g.items.map((e) => {
                const puesto = e.puestoId ? puestoById.get(e.puestoId) : undefined;
                const r = resumenSueldo(e);
                return (
                  <button key={e.id} className={`emp-tarjeta ${e.inactivo ? "inactiva" : ""}`} onClick={() => onEdit(e)}>
                    <div className="emp-tarjeta-top">
                      <Avatar nombre={e.nombre} foto={e.id === tuId ? fotoTu : e.foto} tamano={46} />
                      <div className="emp-tarjeta-nombre">
                        <strong>
                          {e.nombre}
                          {e.id === tuId && <em className="etiqueta-tu">Tú</em>}
                        </strong>
                        <span>{puesto ? puesto.nombre : "Sin puesto"}</span>
                      </div>
                      <div className="emp-tarjeta-sueldo">
                        {r.actual > 0 ? (
                          <>
                            <b>{money(r.actual)}</b>
                            <small>/ día</small>
                          </>
                        ) : (
                          <small>sin sueldo</small>
                        )}
                      </div>
                    </div>
                    <div className="emp-chips">
                      {e.inactivo ? (
                        <em className="emp-chip off">
                          <LogOut size={12} /> {e.fechaSalida ? `Salió el ${fechaCorta(e.fechaSalida)}` : "Inactivo"}
                          {e.fechaIngreso && e.fechaSalida ? ` · trabajó ${antiguedad(e.fechaIngreso, e.fechaSalida)}` : ""}
                        </em>
                      ) : (
                        e.fechaIngreso && (
                          <em className="emp-chip">
                            <Clock size={12} /> {antiguedad(e.fechaIngreso)} · desde {mesCorto(e.fechaIngreso)}
                          </em>
                        )
                      )}
                      {!e.inactivo && r.proximo && (
                        <em className="emp-chip prox">
                          {r.proximo.diferencia >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {r.proximo.diferencia >= 0 ? "+" : "−"}
                          {money(Math.abs(r.proximo.diferencia))} desde {fechaCorta(r.proximo.desde)}
                        </em>
                      )}
                      {!e.inactivo && !r.proximo && r.ultimo && (
                        <em className={`emp-chip ${r.ultimo.diferencia >= 0 ? "ok" : "baja"}`}>
                          {r.ultimo.diferencia >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {r.ultimo.diferencia >= 0 ? "+" : "−"}
                          {money(Math.abs(r.ultimo.diferencia))} hace {antiguedad(r.ultimo.desde)}
                        </em>
                      )}
                      {e.staffProfileId && (
                        <em className="emp-chip">
                          <KeyRound size={12} /> Acceso a la app
                        </em>
                      )}
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
