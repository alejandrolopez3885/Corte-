import { useState } from "react";
import { ChefHat, ClipboardList, Clock, Home, LogOut, Martini, Wallet } from "lucide-react";
import { formatAssignedDate, insumoAreaForPuesto, mostRecentWeekIndex, puedeEditarHorarios } from "../lib/dataModel";
import { HORARIO_AREAS_FIJAS, PERMISOS_DISPONIBLES } from "../lib/types";
import type { AppData, HorarioSemana, PermisoStaff, Profile, StaffAssignment } from "../lib/types";
import { HorariosPanel } from "../components/panels/HorariosPanel";
import { ConteoDiarioPanel } from "../components/panels/ConteoDiarioPanel";
import { NominaPanel } from "../components/panels/NominaPanel";

type StaffView = "menu" | PermisoStaff | "corte";

function ShellHeader({ subtitle, onSignOut }: { subtitle?: string; onSignOut: () => void }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">Cortes</span>
        {subtitle && <span className="brand-month">{subtitle}</span>}
      </div>
      <button className="icon-btn" onClick={onSignOut} aria-label="Cerrar sesión">
        <LogOut size={18} />
      </button>
    </header>
  );
}

// Pantalla para cuentas de equipo dadas de alta desde Personal — solo ve
// las secciones que tiene habilitadas: las de su checklist de permisos
// (Horarios/Conteo diario/Nómina, acotadas a su propia área o persona) y,
// si le asignaron algún día, "Corte" (acotado a esos días). Con una sola
// sección en total entra directo a ella; con dos o más, primero ve un
// menú para elegir.
export default function StaffAccessShell({
  profile,
  data,
  onSaveHorarioSemana,
  onSaveConteoDiario,
  onSignOut,
  assignments,
  onPickCorteDate,
}: {
  profile: Profile;
  data: AppData;
  onSaveHorarioSemana: (monthKey: string, weekIndex: number, semana: HorarioSemana) => void;
  onSaveConteoDiario: (fecha: string, valores: Record<string, number>) => void;
  onSignOut: () => void;
  assignments: StaffAssignment[];
  onPickCorteDate: (date: string) => void;
}) {
  const permisos = profile.permisos || [];
  const tieneCorte = assignments.length > 0;
  const totalSecciones = permisos.length + (tieneCorte ? 1 : 0);
  const [view, setView] = useState<StaffView>(() => {
    if (totalSecciones !== 1) return "menu";
    return permisos.length === 1 ? permisos[0] : "corte";
  });

  const empleado = data.empleados.find((e) => e.id === profile.empleado_id);
  const puesto = empleado?.puestoId ? data.puestos.find((p) => p.id === empleado.puestoId) : undefined;
  const area = puesto ? data.areas.find((a) => a.id === puesto.areaId) : undefined;

  const monthKeys = Object.keys(data.months).sort();
  const mostRecentMonthKey = monthKeys.length > 0 ? monthKeys[monthKeys.length - 1] : null;
  const mostRecentWeekIdx = mostRecentMonthKey ? mostRecentWeekIndex(mostRecentMonthKey, data.months[mostRecentMonthKey]) : 0;

  if (!empleado) {
    return (
      <div className="app-shell">
        <ShellHeader onSignOut={onSignOut} />
        <div className="full-page-msg">
          Tu cuenta todavía no está vinculada a nadie en Personal. Pide al dueño que revise tu acceso.
        </div>
      </div>
    );
  }

  if (totalSecciones === 0) {
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} />
        <div className="full-page-msg">Todavía no tienes ninguna sección habilitada. Pide al dueño que te dé acceso.</div>
      </div>
    );
  }

  // Con una sola sección en total no hay menú al que volver — nunca se
  // muestra la vista "menu" ni un botón de regreso.
  const backToMenu = totalSecciones > 1 ? () => setView("menu") : undefined;

  if (view === "corte" && tieneCorte) {
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} />
        <div className="page-section">
          {backToMenu && (
            <button className="link-btn back-link" onClick={backToMenu}>
              Inicio
            </button>
          )}
          <h2 className="page-title">Corte</h2>
          <p className="hint">Toca el día que vas a capturar:</p>
          <div className="staff-name-grid">
            {assignments.map((a) => (
              <button key={a.id} className="staff-name-btn" onClick={() => onPickCorteDate(a.assigned_date)}>
                {formatAssignedDate(a.assigned_date)}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === "horarios" && permisos.includes("horarios")) {
    const horarioAreaId = area ? HORARIO_AREAS_FIJAS.find((a) => a.nombre.toLowerCase() === area.nombre.toLowerCase())?.id : undefined;
    if (!horarioAreaId) {
      return (
        <div className="app-shell">
          <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} />
          <div className="full-page-msg">
            {area
              ? `Tu área ("${area.nombre}") todavía no tiene horario en la app — por ahora Horarios solo existe para Piso y Cocina.`
              : "Necesitas tener un puesto asignado en Personal para ver Horarios."}
          </div>
        </div>
      );
    }
    const empleadosDeArea = data.empleados.filter((e) => {
      const p = e.puestoId ? data.puestos.find((pp) => pp.id === e.puestoId) : undefined;
      return !!p && p.areaId === puesto?.areaId;
    });
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} />
        <HorariosPanel
          onBack={backToMenu}
          backLabel="Inicio"
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          empleados={empleadosDeArea}
          horarios={data.horarios}
          onSaveSemana={onSaveHorarioSemana}
          soloAreaId={horarioAreaId}
          readOnly={!(puesto && puedeEditarHorarios(puesto.nombre))}
        />
      </div>
    );
  }

  if (view === "conteo_diario" && permisos.includes("conteo_diario")) {
    const insumoArea = puesto ? insumoAreaForPuesto(puesto.nombre) : null;
    if (!insumoArea) {
      return (
        <div className="app-shell">
          <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} />
          <div className="full-page-msg">
            Tu puesto ("{puesto?.nombre}") todavía no tiene Conteo diario en la app — por ahora solo existe para
            puestos de Barra o Cocina.
          </div>
        </div>
      );
    }
    const insumoAreaLabel = insumoArea === "bar" ? "Bar" : "Cocina";
    const insumosDelArea = data.insumos.filter((i) => i.area === insumoArea && i.altaRotacion);
    return (
      <div className="app-shell">
        <ShellHeader subtitle={insumoAreaLabel} onSignOut={onSignOut} />
        <ConteoDiarioPanel
          onBack={backToMenu}
          backLabel="Inicio"
          emptyIcon={insumoArea === "bar" ? <Martini size={26} strokeWidth={1.3} /> : <ChefHat size={26} strokeWidth={1.3} />}
          emptyText={`Aún no hay insumos de ${insumoAreaLabel} marcados como alta rotación. Pide al dueño que los marque desde el Catálogo.`}
          insumos={insumosDelArea}
          proveedores={data.proveedores}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          conteosDiarios={data.conteosDiarios}
          onGuardar={onSaveConteoDiario}
        />
      </div>
    );
  }

  if (view === "nomina" && permisos.includes("nomina")) {
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} />
        <NominaPanel
          onBack={backToMenu}
          backLabel="Inicio"
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          empleados={data.empleados}
          horarios={data.horarios}
          nominaDescuentos={data.nominaDescuentos}
          soloEmpleadoId={empleado.id}
          onGoToHorarios={permisos.includes("horarios") ? () => setView("horarios") : undefined}
        />
      </div>
    );
  }

  const ICONOS: Record<PermisoStaff, typeof Clock> = { horarios: Clock, conteo_diario: ClipboardList, nomina: Wallet };

  return (
    <div className="app-shell">
      <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} />
      <div className="page-section">
        <h2 className="page-title">Inicio</h2>
        <div className="menu-list">
          {tieneCorte && (
            <button className="menu-item" onClick={() => setView("corte")}>
              <span className="menu-item-icon">
                <Home size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Corte</strong>
                <span>Captura el corte de los días que te asignaron</span>
              </span>
            </button>
          )}
          {PERMISOS_DISPONIBLES.filter((p) => permisos.includes(p.value)).map((p) => {
            const Icono = ICONOS[p.value];
            return (
              <button key={p.value} className="menu-item" onClick={() => setView(p.value)}>
                <span className="menu-item-icon">
                  <Icono size={20} />
                </span>
                <span className="menu-item-text">
                  <strong>{p.label}</strong>
                  <span>{p.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
