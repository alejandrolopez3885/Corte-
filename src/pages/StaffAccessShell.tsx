import { useState } from "react";
import { ChefHat, ClipboardList, Clock, LogOut, Martini, Wallet } from "lucide-react";
import { insumoAreaForPuesto, mostRecentWeekIndex } from "../lib/dataModel";
import { HORARIO_AREAS_FIJAS, PERMISOS_DISPONIBLES } from "../lib/types";
import type { AppData, HorarioSemana, PermisoStaff, Profile } from "../lib/types";
import { HorariosPanel } from "../components/panels/HorariosPanel";
import { ConteoDiarioPanel } from "../components/panels/ConteoDiarioPanel";
import { NominaPanel } from "../components/panels/NominaPanel";

type StaffView = "menu" | PermisoStaff;

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
// Personal). Con un solo permiso entra directo a esa sección; con dos o
// más, primero ve un menú para elegir.
export default function StaffAccessShell({
  profile,
  data,
  onSaveHorarioSemana,
  onSaveConteoDiario,
  onSignOut,
}: {
  profile: Profile;
  data: AppData;
  onSaveHorarioSemana: (monthKey: string, weekIndex: number, semana: HorarioSemana) => void;
  onSaveConteoDiario: (fecha: string, valores: Record<string, number>) => void;
  onSignOut: () => void;
}) {
  const permisos = profile.permisos || [];
  const [view, setView] = useState<StaffView>(() => (permisos.length === 1 ? permisos[0] : "menu"));

  const empleado = data.empleados.find((e) => e.id === profile.empleado_id);
  const puesto = empleado?.puestoId ? data.puestos.find((p) => p.id === empleado.puestoId) : undefined;
  const area = puesto ? data.areas.find((a) => a.id === puesto.areaId) : undefined;

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

  if (permisos.length === 0) {
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area.nombre} onSignOut={onSignOut} />
        <div className="full-page-msg">Todavía no tienes ninguna sección habilitada. Pide al dueño que te dé acceso.</div>
      </div>
    );
  }

  // Con un único permiso no hay menú al que volver — nunca se muestra la
  // vista "menu" ni un botón de regreso.
  const backToMenu = permisos.length > 1 ? () => setView("menu") : undefined;

  if (view === "horarios" && permisos.includes("horarios")) {
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
        />
      </div>
    );
  }

  if (view === "conteo_diario" && permisos.includes("conteo_diario")) {
    const insumoArea = puesto ? insumoAreaForPuesto(puesto.nombre) : null;
    if (!insumoArea) {
      return (
        <div className="app-shell">
          <ShellHeader subtitle={area.nombre} onSignOut={onSignOut} />
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
        <ShellHeader subtitle={area.nombre} onSignOut={onSignOut} />
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
      <ShellHeader subtitle={area.nombre} onSignOut={onSignOut} />
      <div className="page-section">
        <h2 className="page-title">Inicio</h2>
        <div className="menu-list">
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
