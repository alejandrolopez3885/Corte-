import { LogOut } from "lucide-react";
import { mostRecentWeekIndex } from "../lib/dataModel";
import { HORARIO_AREAS_FIJAS } from "../lib/types";
import type { AppData, HorarioSemana, Profile } from "../lib/types";
import { HorariosPanel } from "../components/panels/HorariosPanel";

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

// Pantalla para cuentas de equipo dadas de alta desde Personal (no las de
// meseros por día asignado) — solo ve las secciones que su permiso
// habilita, y esas siempre acotadas a su propia área (la de su puesto en
// Personal). Hoy solo existe el permiso "horarios"; se agregan más
// secciones aquí conforme se vayan habilitando, sin tocar el resto de la
// app ni el flujo de meseros.
export default function StaffAccessShell({
  profile,
  data,
  onSaveHorarioSemana,
  onSignOut,
}: {
  profile: Profile;
  data: AppData;
  onSaveHorarioSemana: (monthKey: string, weekIndex: number, semana: HorarioSemana) => void;
  onSignOut: () => void;
}) {
  const empleado = data.empleados.find((e) => e.id === profile.empleado_id);
  const puesto = empleado?.puestoId ? data.puestos.find((p) => p.id === empleado.puestoId) : undefined;
  const area = puesto ? data.areas.find((a) => a.id === puesto.areaId) : undefined;
  const permisos = profile.permisos || [];

  const monthKeys = Object.keys(data.months).sort();
  const mostRecentMonthKey = monthKeys.length > 0 ? monthKeys[monthKeys.length - 1] : null;
  const mostRecentWeekIdx = mostRecentMonthKey ? mostRecentWeekIndex(mostRecentMonthKey, data.months[mostRecentMonthKey]) : 0;

  if (!empleado || !area) {
    return (
      <div className="app-shell">
        <ShellHeader onSignOut={onSignOut} />
        <div className="full-page-msg">
          Tu cuenta todavía no está vinculada a un puesto con área en Personal. Pide al dueño que revise tu acceso.
        </div>
      </div>
    );
  }

  if (permisos.includes("horarios")) {
    const horarioAreaId = HORARIO_AREAS_FIJAS.find((a) => a.nombre.toLowerCase() === area.nombre.toLowerCase())?.id;
    if (!horarioAreaId) {
      return (
        <div className="app-shell">
          <ShellHeader subtitle={area.nombre} onSignOut={onSignOut} />
          <div className="full-page-msg">
            Tu área ("{area.nombre}") todavía no tiene horario en la app — por ahora Horarios solo existe para Piso y
            Cocina.
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
        <ShellHeader subtitle={area.nombre} onSignOut={onSignOut} />
        <HorariosPanel
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          empleados={empleadosDeArea}
          horarios={data.horarios}
          onSaveSemana={onSaveHorarioSemana}
          soloAreaId={horarioAreaId}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ShellHeader subtitle={area.nombre} onSignOut={onSignOut} />
      <div className="full-page-msg">Todavía no tienes ninguna sección habilitada. Pide al dueño que te dé acceso.</div>
    </div>
  );
}
