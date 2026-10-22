import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, ChefHat, ClipboardList, Clock, Coins, Home, LogOut, Martini, MessageCircle, Package, ShoppingCart, Wallet } from "lucide-react";
import { formatAssignedDate, insumoAreaForPuesto, plantillaConteo, mostRecentWeekIndex, puedeEditarHorarios } from "../lib/dataModel";
import { HORARIO_AREAS_FIJAS, PERMISOS_DISPONIBLES } from "../lib/types";
import type { AppData, ConteoTextoArea, HorarioSemana, PermisoStaff, Profile, StaffAssignment } from "../lib/types";
import { HorariosPanel } from "../components/panels/HorariosPanel";
import { ConteoDiarioPanel } from "../components/panels/ConteoDiarioPanel";
import { useRegistrarVista } from "../lib/bitacora";
import { InventarioNotasPanel } from "../components/panels/InventarioNotasPanel";
import { NominaPanel } from "../components/panels/NominaPanel";
import { PropinasPanel } from "../components/panels/PropinasPanel";
import { RecetarioPanel } from "../components/panels/RecetarioPanel";
import { PreguntasSheet } from "../components/PreguntasSheet";
import { contextoEquipo } from "../lib/preguntasEquipo";
import { Avatar } from "../components/Avatar";
import { PerfilPanel } from "../components/panels/PerfilPanel";
import { supabase } from "../lib/supabaseClient";
import { CargarPedidosPanel } from "../components/panels/CargarPedidosPanel";

type StaffView = "menu" | PermisoStaff | "corte" | "perfil";

function ShellHeader({ subtitle, onSignOut, perfil }: { subtitle?: string; onSignOut: () => void; perfil?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">Cortes</span>
        {subtitle && <span className="brand-month">{subtitle}</span>}
      </div>
      <div className="topbar-actions">
        {perfil}
        <button className="icon-btn" onClick={onSignOut} aria-label="Cerrar sesión">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

// Pantalla para cuentas de equipo dadas de alta desde Personal — solo ve
// las secciones que tiene habilitadas: las de su checklist de permisos
// (Horarios/Conteo diario/Inventario/Nómina/Propinas, acotadas a su propia área o persona) y,
// si le asignaron algún día, "Corte" (acotado a esos días). Con una sola
// sección en total entra directo a ella; con dos o más, primero ve un
// menú para elegir.
export default function StaffAccessShell({
  profile,
  data,
  onSaveHorarioSemana,
  onSaveConteoTexto,
  onSavePedidoDiario,
  onSaveInventarioNotas,
  onSavePedidoInventario,
  onAsignarApodo,
  onGuardarPedidosCargados,
  onSignOut,
  assignments,
  onPickCorteDate,
  vistaInicial,
  onGuardarPerfil,
}: {
  profile: Profile;
  data: AppData;
  onSaveHorarioSemana: (monthKey: string, weekIndex: number, semana: HorarioSemana) => void;
  onSaveConteoTexto: (area: ConteoTextoArea, fecha: string, texto: string) => void;
  onSavePedidoDiario: (area: ConteoTextoArea, fecha: string, pedido: Record<string, number>) => void;
  onSaveInventarioNotas: (fecha: string, texto: string) => void;
  onSavePedidoInventario: (fecha: string, pedido: Record<string, number>) => void;
  onAsignarApodo: (insumoId: string, apodo: string) => void;
  onGuardarPedidosCargados: (lunes: string, porProveedor: Record<string, Record<string, number>>) => void;
  onSignOut: () => void;
  assignments: StaffAssignment[];
  onPickCorteDate: (date: string) => void;
  // Sección en la que entra (al regresar del corte desde Pregúntale a Cortes).
  vistaInicial?: PermisoStaff | "perfil" | null;
  onGuardarPerfil: (empleadoId: string, cambios: { foto?: string; descripcion?: string }) => void;
}) {
  const permisos = profile.permisos || [];
  const tieneCorte = assignments.length > 0;
  const totalSecciones = permisos.length + (tieneCorte ? 1 : 0);
  const [view, setView] = useState<StaffView>(() => {
    if (vistaInicial === "perfil" || (vistaInicial && permisos.includes(vistaInicial))) return vistaInicial;
    if (totalSecciones !== 1) return "menu";
    return permisos.length === 1 ? permisos[0] : "corte";
  });
  const [preguntasAbierto, setPreguntasAbierto] = useState(false);

  // Cuántas veces entra a cada sección, en su propia cuenta: con eso se
  // acomodan arriba sus preguntas en Pregúntale a Cortes.
  useEffect(() => {
    if (view === "menu" || view === "perfil") return;
    supabase.auth.getUser().then(({ data: u }) => {
      const uso = (u.user?.user_metadata?.seccionesUso || {}) as Record<string, number>;
      supabase.auth.updateUser({ data: { seccionesUso: { ...uso, [view]: (uso[view] || 0) + 1 } } });
    });
  }, [view]);

  // Pantalla abierta, para Actividad (el corte lo registra CortesApp).
  const etiquetaPermiso = (v: StaffView) => PERMISOS_DISPONIBLES.find((p) => p.value === v)?.label;
  useRegistrarVista(profile, view === "menu" ? "Inicio (equipo)" : view === "corte" ? null : etiquetaPermiso(view) || view);

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

  // Mi perfil: su foto arriba, en todas sus pantallas.
  const perfilBtn = (
    <button type="button" className="avatar-btn" onClick={() => setView("perfil")} aria-label="Mi perfil">
      <Avatar nombre={empleado.nombre} foto={empleado.foto} tamano={36} />
    </button>
  );
  if (view === "perfil") {
    const volver = () => setView(totalSecciones === 1 ? (permisos[0] ?? "corte") : "menu");
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} />
        <PerfilPanel
          nombre={empleado.nombre}
          foto={empleado.foto}
          descripcion={empleado.descripcion}
          puesto={puesto?.nombre}
          area={area?.nombre}
          secciones={[...(tieneCorte ? ["Corte"] : []), ...PERMISOS_DISPONIBLES.filter((p) => permisos.includes(p.value)).map((p) => p.label)]}
          onGuardar={(cambios) => onGuardarPerfil(empleado.id, cambios)}
          onBack={volver}
        />
      </div>
    );
  }

  if (totalSecciones === 0) {
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} perfil={perfilBtn} />
        <div className="full-page-msg">Todavía no tienes ninguna sección habilitada. Pide al dueño que te dé acceso.</div>
      </div>
    );
  }

  // Pregúntale a Cortes: el botón flotante en todas sus pantallas.
  const contexto = contextoEquipo(profile, data, assignments);
  const preguntas = (
    <>
      <button type="button" className="preguntas-fab sin-barra" onClick={() => setPreguntasAbierto(true)} aria-label="Pregúntale a Cortes">
        <MessageCircle size={24} />
      </button>
      {preguntasAbierto && (
        <PreguntasSheet
          data={data}
          profile={profile}
          contexto={contexto}
          onClose={() => setPreguntasAbierto(false)}
          onIr={(destino) => {
            setPreguntasAbierto(false);
            if (destino.tipo === "dia") onPickCorteDate(destino.fecha);
            else if (destino.tipo === "seccion" && permisos.includes(destino.seccion)) setView(destino.seccion);
          }}
        />
      )}
    </>
  );

  // Con una sola sección en total no hay menú al que volver — nunca se
  // muestra la vista "menu" ni un botón de regreso.
  const backToMenu = totalSecciones > 1 ? () => setView("menu") : undefined;

  if (view === "corte" && tieneCorte) {
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} perfil={perfilBtn} />
        {preguntas}
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
          <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} perfil={perfilBtn} />
          {preguntas}
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
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} perfil={perfilBtn} />
        {preguntas}
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
          <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} perfil={perfilBtn} />
          {preguntas}
          <div className="full-page-msg">
            Tu puesto ("{puesto?.nombre}") todavía no tiene Conteo diario en la app — por ahora solo existe para
            puestos de Barra o Cocina.
          </div>
        </div>
      );
    }
    const insumoAreaLabel = insumoArea === "bar" ? "Bar" : "Cocina";
    return (
      <div className="app-shell">
        <ShellHeader subtitle={insumoAreaLabel} onSignOut={onSignOut} perfil={perfilBtn} />
        {preguntas}
        <ConteoDiarioPanel
          onBack={backToMenu}
          backLabel="Inicio"
          emptyIcon={insumoArea === "bar" ? <Martini size={26} strokeWidth={1.3} /> : <ChefHat size={26} strokeWidth={1.3} />}
          emptyText={`Aún no hay insumos de ${insumoAreaLabel} marcados como alta rotación. Pide al dueño que los marque desde el Catálogo.`}
          plantilla={plantillaConteo(insumoArea)}
          insumos={data.insumos.filter((i) => i.area === insumoArea)}
          proveedores={data.proveedores}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          textos={data.conteosDiariosTexto[insumoArea]}
          onGuardar={(fecha, texto) => onSaveConteoTexto(insumoArea, fecha, texto)}
          pedidos={data.pedidosDiarios[insumoArea]}
          onGuardarPedido={(fecha, pedido) => onSavePedidoDiario(insumoArea, fecha, pedido)}
          conPedido={insumoArea !== "bar"}
        />
      </div>
    );
  }

  if (view === "inventario" && permisos.includes("inventario")) {
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} perfil={perfilBtn} />
        {preguntas}
        <InventarioNotasPanel
          onBack={backToMenu}
          backLabel="Inicio"
          insumos={data.insumos}
          proveedores={data.proveedores}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          notas={data.inventariosNotas}
          onGuardarNotas={onSaveInventarioNotas}
          pedidos={data.pedidosInventario}
          onGuardarPedido={onSavePedidoInventario}
          onAsignarApodo={onAsignarApodo}
          juevesSaltados={data.inventarioJuevesSaltado}
        />
      </div>
    );
  }

  if (view === "nomina" && permisos.includes("nomina")) {
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} perfil={perfilBtn} />
        {preguntas}
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

  if (view === "propinas" && permisos.includes("propinas")) {
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} perfil={perfilBtn} />
        {preguntas}
        <PropinasPanel
          onBack={backToMenu}
          backLabel="Inicio"
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
        />
      </div>
    );
  }

  // Recetario: solo consulta. Cocina (cocinero, jefe de cocina…) ve solo las
  // recetas de Cocina y Barra solo las de Bar; otros puestos ven las dos.
  if (view === "recetario" && permisos.includes("recetario")) {
    const recetaArea = insumoAreaForPuesto(puesto?.nombre || "") ?? insumoAreaForPuesto(area?.nombre || "");
    const recetas = (data.recetas || []).filter((r) => !recetaArea || r.area === recetaArea);
    const titulo = recetaArea === "cocina" ? "Recetario de Cocina" : recetaArea === "bar" ? "Recetario de Bar" : "Recetario";
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} perfil={perfilBtn} />
        {preguntas}
        <RecetarioPanel onBack={backToMenu} backLabel="Inicio" titulo={titulo} recetas={recetas} />
      </div>
    );
  }

  if (view === "pedidos" && permisos.includes("pedidos")) {
    return (
      <div className="app-shell">
        <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} perfil={perfilBtn} />
        {preguntas}
        <CargarPedidosPanel
          onBack={backToMenu}
          backLabel="Inicio"
          insumos={data.insumos}
          proveedores={data.proveedores}
          cargados={data.pedidosCargados || {}}
          onGuardar={onGuardarPedidosCargados}
          onAsignarApodo={onAsignarApodo}
        />
      </div>
    );
  }

  const ICONOS: Record<PermisoStaff, typeof Clock> = {
    horarios: Clock, conteo_diario: ClipboardList, inventario: Package, pedidos: ShoppingCart, nomina: Wallet, propinas: Coins, recetario: BookOpen,
  };

  return (
    <div className="app-shell">
      <ShellHeader subtitle={area?.nombre} onSignOut={onSignOut} perfil={perfilBtn} />
      {preguntas}
      <div className="page-section">
        <h2 className="page-title">Hola, {empleado.nombre.split(" ")[0]}</h2>
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
          <button className="menu-item" onClick={() => setView("perfil")}>
            <span className="menu-item-icon avatar-icon">
              <Avatar nombre={empleado.nombre} foto={empleado.foto} tamano={40} />
            </span>
            <span className="menu-item-text">
              <strong>Mi perfil</strong>
              <span>Tu foto, tu puesto y tu descripción</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
