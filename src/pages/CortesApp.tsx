import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Settings2, Users, Receipt, ArrowLeftRight, CircleDot, Circle, Pencil,
  Smartphone, BarChart3, LogOut, Truck, Trash2, Home, Store, LayoutDashboard, Contact, Clock, Wallet, ChartLine, Martini, ChefHat, BookOpen, MessageCircle, Trophy, QrCode, Award,
  ShoppingCart, Handshake, Boxes, Package, Coins, History, Lock, FileUp,
} from "lucide-react";
import { useAuth } from "../lib/auth.tsx";
import { useAppData } from "../lib/useAppData";
import { historialNombres } from "../lib/gastosBusqueda";
import {
  addDaysIso, buildMonth, dateForDay, formatAssignedDate, formatDayNumber, formatLongDayDate, formatWeekRange,
  mondayOnOrBefore, money, mostRecentDayInWeek, mostRecentWeekIndex, resolveAssignmentLocation, resolveWeekStartDate,
  normalizarNombre, round2, sumFromText, todayIso, uid, recalcularAcumulados, turnosActivos, acumuladosDelDia, quienesAbren, efectivoDelDia, empleadoDelDueno,
} from "../lib/dataModel";
import { removeAssignmentByStaffAndDate, upsertAssignment, useStaffAssignments } from "../lib/staffAssignments";
import { DAYS, DAY_SHORT } from "../lib/types";
import type { AppData, AreaEntry, ConfigNotificaciones, ConteoTextoArea, CreditoProveedores, DayData, DayName, EmpleadoEntry, Gasto, GastoCategoria, HorarioSemana, InsumoEntry, MeseroCatalogEntry, MeseroCut, NominaDescuentosSemana, PermisoStaff, Profile, ProveedorCatalogEntry, PuestoEntry, Receta, Transferencia, WeekData } from "../lib/types";
import { Empty, Field, NumInput, Sheet } from "../components/ui";
import { MonthModal } from "../components/modals/MonthModal";
import { MeseroModal, type MeseroFormValues } from "../components/modals/MeseroModal";
import { AperturaModal, type AperturaValues } from "../components/modals/AperturaModal";
import { GastoModal, type GastoFormValues } from "../components/modals/GastoModal";
import { TransferModal, type TransferFormValues } from "../components/modals/TransferModal";
import { CreditoProveedoresModal } from "../components/modals/CreditoProveedoresModal";
import { CatalogModal } from "../components/modals/CatalogModal";
import { ProveedoresModal } from "../components/modals/ProveedoresModal";
import { AppsModal } from "../components/modals/AppsModal";
import { GuardarCorteModal } from "../components/modals/GuardarCorteModal";
import { InicioPanel } from "../components/panels/InicioPanel";
import { ubicarFechas, type Destino } from "../lib/inicio";
import { WeekSummaryModal } from "../components/modals/WeekSummaryModal";
import { GastosSummaryModal } from "../components/modals/GastosSummaryModal";
import { DeleteMonthModal } from "../components/modals/DeleteMonthModal";
import { AsignarDiaModal } from "../components/modals/AsignarDiaModal";
import { EmpleadoModal } from "../components/modals/EmpleadoModal";
import { DashboardPanel } from "../components/panels/DashboardPanel";
import { EmpleadosPanel } from "../components/panels/EmpleadosPanel";
import { HorariosPanel } from "../components/panels/HorariosPanel";
import { NominaPanel } from "../components/panels/NominaPanel";
import { PropinasPanel } from "../components/panels/PropinasPanel";
import { TendenciasPanel } from "../components/panels/TendenciasPanel";
import { ControlBarPanel } from "../components/panels/ControlBarPanel";
import { ControlCocinaPanel } from "../components/panels/ControlCocinaPanel";
import { RecetarioPanel } from "../components/panels/RecetarioPanel";
import { InsumosPanel } from "../components/panels/InsumosPanel";
import { InventarioNotasPanel } from "../components/panels/InventarioNotasPanel";
import { PedidosTotalPanel } from "../components/panels/PedidosTotalPanel";
import { ImportarCatalogoPanel, type ImportacionCatalogo } from "../components/panels/ImportarCatalogoPanel";
import { ActividadPanel, HistorialDiaSheet } from "../components/panels/ActividadPanel";
import { contarBitacoraDelDia, useRegistrarVista } from "../lib/bitacora";
import StaffAccessShell from "./StaffAccessShell";
import { NovedadesAlEntrar } from "../components/NovedadesAlEntrar";
import { PreguntasSheet } from "../components/PreguntasSheet";
import { RankingPanel } from "../components/panels/RankingPanel";
import { PuntosPanel } from "../components/panels/PuntosPanel";
import { SoloLecturaBarra, SoloLecturaGuard } from "../components/SoloLectura";
import { Bienvenida, OpinionInvitado, Recorrido, buscarEn, type PasoRecorrido } from "../components/Recorrido";
import { AccesoInvitados } from "../components/AccesoInvitados";
import { NotificacionesDueno } from "../components/NotificacionesDueno";
import { cargarSemanasPasadas, cerrarSemana, sincronizarCuentasMeseros } from "../lib/puntos";
import { MiRankingDueno, meseroDelDueno } from "../components/MiRankingDueno";
import { EncuestasPanel } from "../components/panels/EncuestasPanel";
import { marcarDispositivoPersonal } from "../lib/encuestas";
import { RanuraTitulo, TituloPagina } from "../components/BarraTitulo";
import { Avatar } from "../components/Avatar";
import { PerfilPanel } from "../components/panels/PerfilPanel";
import { contextoEquipo } from "../lib/preguntasEquipo";
import { useDatosPagoEquipo, type DatosPago } from "../lib/datosPago";

type ModalState =
  | { type: "month" }
  | { type: "mesero"; editing?: MeseroCut }
  | { type: "gasto"; editing?: Gasto }
  | { type: "transfer"; editing?: Transferencia }
  | { type: "apps" }
  | { type: "guardarCorte" }
  | { type: "apertura" }
  | { type: "dejarEfectivo" }
  | { type: "quitarApertura" }
  | { type: "reabrirCorte" }
  | { type: "weekSummary" }
  | { type: "gastosSummary" }
  | { type: "creditoProveedores" }
  | { type: "catalog" }
  | { type: "proveedores" }
  | { type: "asignarDia" }
  | { type: "empleado"; editing?: EmpleadoEntry }
  | { type: "deleteMonth"; monthKey: string }
  | null;

type EquipoView = "menu" | "personal" | "horarios" | "nomina" | "propinas" | "ranking" | "encuestas" | "puntos";

type NegocioView =
  | "menu" | "tendencias" | "bitacora" | "controlBar" | "controlCocina" | "controlGeneral" | "inventario" | "pedidos"
  | "recetarioBar" | "recetarioCocina" | "importarCatalogo";

type OwnerTab = "inicio" | "corte" | "equipo" | "negocio" | "dashboard" | "perfil";

export default function CortesApp({ profile }: { profile: Profile }) {
  const { signOut } = useAuth();

  // Acceso de invitado: ve todo como el dueño, en solo lectura. El dueño
  // también puede probar esa vista ("Probar el recorrido").
  const esInvitado = !!profile.invitado_hasta;
  const [ahoraInicio] = useState(() => Date.now());
  const invitadoVencido = esInvitado && new Date(profile.invitado_hasta as string).getTime() < ahoraInicio;
  const [pruebaInvitado, setPruebaInvitado] = useState(false);
  const soloLectura = esInvitado || pruebaInvitado;
  const isOwner = profile.role === "owner" || esInvitado;
  // De quién es el negocio (para leer su Actividad, Inicio, etc.).
  const duenoId = esInvitado ? (profile.owner_id as string) : profile.id;
  const [recorrido, setRecorrido] = useState<"bienvenida" | "pasos" | "opinion" | null>(esInvitado ? "bienvenida" : null);
  const { data, status, saveState, persist } = useAppData(profile, soloLectura);
  // Nombres de todos los gastos capturados, para autocompletar el concepto.
  const historialGastos = useMemo(() => (data ? historialNombres(data) : []), [data]);

  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [activeDay, setActiveDay] = useState<DayName>("Lunes");
  const [activeTab, setActiveTab] = useState<OwnerTab>("inicio");
  // A dónde llevó un "Ver ›" de Inicio: semana y vista con la que abre la
  // pantalla destino (se limpia al cambiar de pestaña).
  const [desdeInicio, setDesdeInicio] = useState<{ mk?: string; wi?: number; modo?: "completo" | "jueves"; conteo?: boolean } | null>(null);
  const [equipoView, setEquipoView] = useState<EquipoView>("menu");
  const [negocioView, setNegocioView] = useState<NegocioView>("menu");
  const [preguntasAbierto, setPreguntasAbierto] = useState(false);
  // Personal: la sección a la que regresa desde "Pregúntale a Cortes".
  const [staffVista, setStaffVista] = useState<PermisoStaff | "perfil" | "ranking" | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedAssignedDate, setSelectedAssignedDate] = useState<string | null>(null);

  const ownerInitialized = useRef(false);
  const locatedForDate = useRef<string | null>(null);
  const { assignments, status: assignmentsStatus } = useStaffAssignments(isOwner ? null : profile.id);
  // Capa 3 de las encuestas: en este celular entró alguien del equipo, así
  // que una encuesta contestada desde aquí no cuenta.
  useEffect(() => marcarDispositivoPersonal(), []);

  // Qué cuenta de equipo es qué mesero, para que cada quien vea sus puntos.
  const llaveCuentas = isOwner && data ? JSON.stringify([data.empleados.map((e) => [e.id, e.nombre, e.usuarioSistemaId]), data.meseros.map((m) => m.id)]) : null;
  useEffect(() => {
    if (llaveCuentas && data && !soloLectura) sincronizarCuentasMeseros(data, profile.id);
  }, [llaveCuentas, profile.id, soloLectura]);

  // Carga inicial de Monedas Anubis (una sola vez): cierra las semanas
  // pasadas desde la primera con cortes. Solo avisa la novedad.
  const cargandoMonedas = useRef(false);
  const datosActuales = useRef(data);
  useEffect(() => {
    datosActuales.current = data;
  }, [data]);
  useEffect(() => {
    if (!data || profile.role !== "owner" || soloLectura || data.monedasCargaInicial || cargandoMonedas.current) return;
    cargandoMonedas.current = true;
    cargarSemanasPasadas(data, todayIso()).then((n) => {
      if (n === null) {
        cargandoMonedas.current = false;
        return;
      }
      const actual = datosActuales.current;
      if (actual) persist({ ...actual, monedasCargaInicial: new Date().toISOString() });
    });
  }, [data, profile.role, soloLectura, persist]);
  // Datos para el pago de nómina de todo el equipo (solo dueño).
  const { porPerfil: datosPago, estado: estadoDatosPago } = useDatosPagoEquipo(isOwner ? duenoId : null);
  const pagoDeEmpleado = (empleadoId: string): DatosPago | "sin-datos" | null => {
    const perfilId = data?.empleados.find((e) => e.id === empleadoId)?.staffProfileId;
    if (!perfilId || estadoDatosPago !== "listo") return null;
    return datosPago.get(perfilId) || "sin-datos";
  };

  // Qué pantalla tiene abierta (para Negocio > Análisis > Actividad). Las
  // cuentas de equipo fuera del corte las registra StaffAccessShell.
  const NOMBRE_EQUIPO: Record<EquipoView, string> = { menu: "Equipo", personal: "Personal", horarios: "Horarios", nomina: "Nómina", propinas: "Propinas", ranking: "Ranking", encuestas: "Encuestas", puntos: "Monedas y logros" };
  const NOMBRE_NEGOCIO: Record<NegocioView, string> = {
    menu: "Negocio", tendencias: "Tendencias", bitacora: "Actividad", controlBar: "Control de Bar", controlCocina: "Control de Cocina",
    controlGeneral: "Control General", inventario: "Inventario", pedidos: "Pedidos",
    recetarioBar: "Recetario de Bar", recetarioCocina: "Recetario de Cocina", importarCatalogo: "Importar catálogo",
  };
  const NOMBRE_MODAL: Partial<Record<string, string>> = {
    gastosSummary: "Control de gastos en efectivo", creditoProveedores: "Control de gastos en transferencia",
    weekSummary: "Resumen semanal", proveedores: "Proveedores",
  };
  const pantalla = !isOwner
    ? selectedAssignedDate
      ? "Corte"
      : null
    : (modal && NOMBRE_MODAL[modal.type]) ||
      (activeTab === "inicio" ? "Inicio" : activeTab === "corte" ? "Corte" : activeTab === "dashboard" ? "Dashboard" : activeTab === "perfil" ? "Mi perfil" : activeTab === "equipo" ? NOMBRE_EQUIPO[equipoView] : NOMBRE_NEGOCIO[negocioView]);
  useRegistrarVista(profile, pantalla);

  // "Historial de este día" (solo el dueño): cuántos cambios tiene registrados
  // el día abierto del corte. Se vuelve a contar poco después de cada
  // guardado, cuando la bitácora ya lo anotó.
  const [historialDia, setHistorialDia] = useState<string | null>(null);
  const [cambiosDelDia, setCambiosDelDia] = useState(0);
  const fechaDiaActivo =
    isOwner && data && activeMonth && data.months[activeMonth] ? dateForDay(activeMonth, activeWeek, data.months[activeMonth], activeDay) : null;
  useEffect(() => {
    if (!fechaDiaActivo) return;
    let cancelado = false;
    const t = setTimeout(() => {
      contarBitacoraDelDia(duenoId, fechaDiaActivo).then((n) => {
        if (!cancelado) setCambiosDelDia(n);
      });
    }, 1500);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [fechaDiaActivo, data, duenoId]);

  // Dueño: al cargar, ubica el mes/semana/día más reciente.
  useEffect(() => {
    if (!data || !isOwner || ownerInitialized.current) return;
    const monthKeys = Object.keys(data.months).sort();
    const last = monthKeys[monthKeys.length - 1];
    if (last) {
      setActiveMonth(last);
      const wi = mostRecentWeekIndex(last, data.months[last]);
      setActiveWeek(wi);
      setActiveDay(mostRecentDayInWeek(last, wi, data.months[last]));
    }
    ownerInitialized.current = true;
  }, [data, isOwner]);

  // Staff: cuando elige un día de su lista, lo ubica en mes/semana/día.
  // La semana usa la que el dueño eligió al asignar (las pestañas "Semana N"
  // del corte son manuales, no siempre coinciden con un cálculo por fecha).
  useEffect(() => {
    if (!data || isOwner || !selectedAssignedDate) return;
    if (locatedForDate.current === selectedAssignedDate) return;
    locatedForDate.current = selectedAssignedDate;
    const assignment = assignments?.find((a) => a.assigned_date === selectedAssignedDate);
    const loc = resolveAssignmentLocation(selectedAssignedDate, assignment?.week_index);
    setActiveMonth(loc.monthKey);
    setActiveWeek(loc.weekIndex);
    setActiveDay(loc.dayName);
    if (!data.months[loc.monthKey]) {
      const next = structuredClone(data);
      // Ancla la semana 1 del mes nuevo a partir de esta fecha real y la
      // semana que ya se eligió, para que las fechas mostradas coincidan
      // con la asignación (no con el default por día-del-mes).
      const mondayOfAssignedWeek = addDaysIso(selectedAssignedDate, -DAYS.indexOf(loc.dayName));
      const week1Start = addDaysIso(mondayOfAssignedWeek, -loc.weekIndex * 7);
      next.months[loc.monthKey] = buildMonth(loc.monthKey, week1Start);
      persist(next);
    }
  }, [data, isOwner, selectedAssignedDate, assignments, persist]);

  if (status === "loading" || !data) {
    return (
      <div className="app-shell">
        <div className="loading">Cargando tus cortes…</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="app-shell">
        <div className="full-page-msg">No se pudieron cargar los datos. Intenta recargar la página.</div>
      </div>
    );
  }

  if (!isOwner) {
    // Cuenta de equipo dada de alta desde Personal: tiene su propia
    // pantalla, acotada a las secciones que su checklist de permisos
    // habilita (Horarios/Conteo diario/Inventario/Nómina/Propinas) y, si le asignaron algún
    // día, "Corte" — acotado a esos días nada más.
    if (assignmentsStatus === "loading" || assignments === null) {
      return (
        <div className="app-shell">
          <div className="loading">Cargando tu información…</div>
        </div>
      );
    }
    const stillValid = selectedAssignedDate && assignments.some((a) => a.assigned_date === selectedAssignedDate);
    if (selectedAssignedDate && !stillValid) {
      return (
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <img className="brand-logo" src="/favicon.svg" alt="Cortes" />
              <RanuraTitulo />
            </div>
            <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </header>
          <div className="full-page-msg">Ya no tienes acceso a este día. Si fue un error, pide al encargado que te lo asigne de nuevo.</div>
          <div style={{ padding: "0 20px" }}>
            <button className="btn-primary" onClick={() => setSelectedAssignedDate(null)}>
              Volver
            </button>
          </div>
        </div>
      );
    }
    if (!selectedAssignedDate) {
      const tieneCorte = assignmentsStatus !== "error" && assignments.length > 0;
      return (
        <>
          <NovedadesAlEntrar profile={profile} data={data} tieneCorte={tieneCorte} />
          <StaffAccessShell
          profile={profile}
          data={data}
          onSaveHorarioSemana={saveHorarioSemana}
          onSaveConteoTexto={guardarConteoTexto}
          onSavePedidoDiario={guardarPedidoDiario}
          onSaveInventarioNotas={guardarInventarioNotas}
          onSavePedidoInventario={guardarPedidoInventario}
          onAsignarApodo={asignarApodoInsumo}
          onGuardarPedidosCargados={guardarPedidosCargados}
          onSignOut={signOut}
          assignments={assignmentsStatus === "error" ? [] : assignments}
          onPickCorteDate={(date) => setSelectedAssignedDate(date)}
          vistaInicial={staffVista}
          onGuardarPerfil={guardarPerfilEmpleado}
          />
        </>
      );
    }
  }

  const monthKeys = Object.keys(data.months).sort();
  // Cuenta de equipo: su persona en Personal (para su foto arriba).
  const miEmpleado = !isOwner && profile.empleado_id ? data.empleados.find((e) => e.id === profile.empleado_id) : undefined;
  // El dueño en Personal (si alguien se llama igual que en su perfil): su puesto.
  const empDueno = isOwner ? empleadoDelDueno(data) : undefined;
  const puestoDueno = empDueno?.puestoId ? data.puestos.find((p) => p.id === empDueno.puestoId) : undefined;
  const month = activeMonth ? data.months[activeMonth] : null;
  const day: DayData | null = month ? month.weeks[activeWeek].days[activeDay] : null;
  // Ya con "Guardar corte", el personal solo lo puede ver.
  const corteBloqueado = !isOwner && !!day?.corteGuardado;
  const week = month ? month.weeks[activeWeek] : null;
  const weekStartDate = activeMonth && month ? resolveWeekStartDate(activeMonth, activeWeek, month) : null;
  const activeDayDate = activeMonth && month ? dateForDay(activeMonth, activeWeek, month, activeDay) : null;
  // Medio turno y "Para llevar" acumulado: solo en cortes desde el 21/10/2026.
  const turnosDelDia = turnosActivos(activeDayDate);
  // Lo guardado con "Guardar medio turno" ya no lo puede cambiar el personal.
  function bloqueadoMedioTurno(id?: string) {
    return !isOwner && !!id && !!day?.apertura?.ids.includes(id);
  }
  // Quién abre hoy según el horario (X = abre, Z = dobla).
  const abrenHoy =
    turnosDelDia && activeMonth ? quienesAbren(data.horarios[activeMonth]?.weeks?.[activeWeek], activeDay) : [];

  // Mes/semana más reciente del negocio, sin depender de qué esté viendo
  // el dueño en la pestaña Corte — para que Negocio y Dashboard siempre
  // arranquen en la semana más relevante, aunque se hayan abierto directo.
  const mostRecentMonthKey = monthKeys.length > 0 ? monthKeys[monthKeys.length - 1] : null;
  const mostRecentWeekIdx = mostRecentMonthKey ? mostRecentWeekIndex(mostRecentMonthKey, data.months[mostRecentMonthKey]) : 0;

  // Ir a una pestaña siempre regresa al inicio de esa sección — así tocar
  // "Equipo" de nuevo mientras ya estás en Nómina/Horarios/Personal es un
  // segundo camino para volver al menú de Equipo, no se queda atorado ahí.
  function goToTab(tab: OwnerTab) {
    setActiveTab(tab);
    setEquipoView("menu");
    setNegocioView("menu");
    setDesdeInicio(null);
  }

  // "Ver ›" de una alerta de Inicio: abre la pantalla donde se resuelve.
  function irDesdeInicio(destino: Destino) {
    if (!data) return;
    const ubicar = (fecha: string) => ubicarFechas(data).get(fecha);
    goToTab("inicio");
    switch (destino.tipo) {
      case "dia":
      case "semana": {
        const u = ubicar(destino.fecha);
        if (!u) return;
        setActiveMonth(u.mk);
        setActiveWeek(u.wi);
        setActiveDay(u.dia);
        setActiveTab("corte");
        if (destino.tipo === "semana") setModal({ type: "weekSummary" });
        return;
      }
      case "gastos":
        setModal({ type: "gastosSummary" });
        return;
      case "conteo":
        setDesdeInicio({ conteo: true });
        setActiveTab("negocio");
        setNegocioView(destino.area === "cocina" ? "controlCocina" : "controlBar");
        return;
      case "inventario": {
        const u = ubicar(destino.fecha);
        setDesdeInicio({ mk: u?.mk, wi: u?.wi, modo: destino.modo });
        setActiveTab("negocio");
        setNegocioView("inventario");
        return;
      }
      case "horarios":
      case "nomina": {
        const u = ubicar(destino.fecha);
        setDesdeInicio({ mk: u?.mk, wi: u?.wi });
        setActiveTab("equipo");
        setEquipoView(destino.tipo);
        return;
      }
      case "tendencias":
        setActiveTab("negocio");
        setNegocioView("tendencias");
        return;
      case "actividad":
        setActiveTab("negocio");
        setNegocioView("bitacora");
        return;
    }
  }

  function updateDay(mutator: (d: DayData, next: AppData) => void) {
    if (!data || !activeMonth) return;
    const next = structuredClone(data);
    const d = next.months[activeMonth].weeks[activeWeek].days[activeDay];
    // Corte ya guardado: el personal ya no lo puede cambiar (el dueño sí).
    if (!isOwner && d.corteGuardado) return;
    mutator(d, next);
    // Registro permanente de quién realmente capturó este corte — se
    // estampa en cualquier cambio que haga una cuenta de equipo (no el
    // dueño), y no se borra al reasignar o quitarle el acceso a esa
    // persona, para que quede como historial.
    if (!isOwner) {
      d.hechoPor = { empleadoId: profile.empleado_id || undefined, nombre: profile.display_name || "Alguien del equipo" };
    }
    persist(next);
  }

  function updateWeek(mutator: (w: WeekData) => void) {
    if (!data || !activeMonth) return;
    const next = structuredClone(data);
    const w = next.months[activeMonth].weeks[activeWeek];
    mutator(w);
    persist(next);
  }

  // Asignar/quitar el día que se está viendo a alguien de Personal —
  // le da acceso real (fila en staff_assignments) y deja el registro en
  // el propio corte diario (asignadoA), para historial aunque después se
  // le quite el acceso.
  async function assignDay(empleado: EmpleadoEntry) {
    if (!data || !activeMonth || !empleado.staffProfileId) return;
    const staffProfileId = empleado.staffProfileId;
    const fecha = dateForDay(activeMonth, activeWeek, data.months[activeMonth], activeDay);
    const previo = data.months[activeMonth].weeks[activeWeek].days[activeDay].asignadoA;
    if (previo && previo.staffId !== staffProfileId) {
      await removeAssignmentByStaffAndDate(previo.staffId, fecha);
    }
    await upsertAssignment(staffProfileId, fecha, activeWeek);
    updateDay((d) => {
      d.asignadoA = { empleadoId: empleado.id, staffId: staffProfileId, nombre: empleado.nombre };
    });
  }

  async function unassignDay() {
    if (!data || !activeMonth) return;
    const asignadoA = data.months[activeMonth].weeks[activeWeek].days[activeDay].asignadoA;
    if (!asignadoA) return;
    const fecha = dateForDay(activeMonth, activeWeek, data.months[activeMonth], activeDay);
    await removeAssignmentByStaffAndDate(asignadoA.staffId, fecha);
    updateDay((d) => {
      d.asignadoA = undefined;
    });
  }

  function saveEfectivoReal(rawValue: string) {
    updateWeek((w) => {
      w.efectivoReal = sumFromText(rawValue);
    });
  }

  // dateStr es la fecha corregida de la semana que se está viendo
  // (activeWeek) — se traduce a la fecha ancla de la Semana 1, para que
  // todo el mes se recorra junto y las semanas no se desalineen entre sí.
  function saveWeekStartDate(dateStr: string) {
    if (!data || !activeMonth) return;
    const next = structuredClone(data);
    next.months[activeMonth].week1StartDate = addDaysIso(dateStr, -activeWeek * 7);
    persist(next);
  }

  function addMonth(monthKey: string) {
    if (!data) return;
    if (data.months[monthKey]) {
      setActiveMonth(monthKey);
      const wi = mostRecentWeekIndex(monthKey, data.months[monthKey]);
      setActiveWeek(wi);
      setActiveDay(mostRecentDayInWeek(monthKey, wi, data.months[monthKey]));
      setModal(null);
      return;
    }
    const next = structuredClone(data);
    // Si el mes que agregas es el mes real de hoy, ancla la semana 1 a la
    // semana real de hoy — es más confiable que asumir que empezaste el
    // día 1 del mes, sobre todo si arrancas a mitad de mes.
    const today = todayIso();
    const week1Start = today.slice(0, 7) === monthKey ? mondayOnOrBefore(today) : undefined;
    next.months[monthKey] = buildMonth(monthKey, week1Start);
    persist(next);
    setActiveMonth(monthKey);
    const wi = mostRecentWeekIndex(monthKey, next.months[monthKey]);
    setActiveWeek(wi);
    setActiveDay(mostRecentDayInWeek(monthKey, wi, next.months[monthKey]));
    setModal(null);
  }

  function deleteMonth(monthKey: string) {
    if (!data) return;
    const next = structuredClone(data);
    delete next.months[monthKey];
    persist(next);
    if (activeMonth === monthKey) {
      const remaining = Object.keys(next.months).sort();
      const newActive = remaining[remaining.length - 1] || null;
      setActiveMonth(newActive);
      if (newActive) {
        const wi = mostRecentWeekIndex(newActive, next.months[newActive]);
        setActiveWeek(wi);
        setActiveDay(mostRecentDayInWeek(newActive, wi, next.months[newActive]));
      } else {
        setActiveWeek(0);
        setActiveDay("Lunes");
      }
    }
    setModal(null);
  }

  function upsertMesero(entry: MeseroCatalogEntry) {
    if (!data) return;
    const next = structuredClone(data);
    const idx = next.meseros.findIndex((m) => m.id === entry.id);
    if (idx >= 0) next.meseros[idx] = entry;
    else next.meseros.push(entry);
    persist(next);
  }

  function removeMeseroFromCatalog(id: string) {
    if (!data) return;
    const next = structuredClone(data);
    next.meseros = next.meseros.filter((m) => m.id !== id);
    persist(next);
  }

  // Lista de personal (Equipo) — separada del catálogo de meseros, que es
  // solo para el corte. Si se crea un puesto (y, dentro de eso, un área)
  // nuevos desde el propio modal, van en el mismo structuredClone(data) +
  // persist que el empleado — misma razón que insumo+proveedor: una sola
  // escritura atómica, para no perder nada por partir de datos viejos.
  function upsertEmpleado(entry: EmpleadoEntry, nuevaArea?: AreaEntry, nuevoPuesto?: PuestoEntry) {
    if (!data) return;
    const next = structuredClone(data);
    if (nuevaArea) next.areas.push(nuevaArea);
    if (nuevoPuesto) next.puestos.push(nuevoPuesto);
    const idx = next.empleados.findIndex((e) => e.id === entry.id);
    // Lo que el modal no edita (foto, descripción, usuario del sistema) se
    // conserva.
    if (idx >= 0) next.empleados[idx] = { ...next.empleados[idx], ...entry };
    else next.empleados.push(entry);
    persist(next);
  }

  // Mi perfil del dueño: nombre, foto y descripción.
  function guardarPerfilDueno(cambios: { foto?: string; descripcion?: string; nombre?: string }) {
    if (!data) return;
    const next = structuredClone(data);
    next.perfilDueno = {
      nombre: cambios.nombre || undefined,
      foto: cambios.foto || undefined,
      descripcion: cambios.descripcion?.trim() || undefined,
    };
    persist(next);
  }

  // Mi perfil: cada quien cambia solo su foto y su descripción.
  function guardarPerfilEmpleado(empleadoId: string, cambios: { foto?: string; descripcion?: string }) {
    if (!data) return;
    const next = structuredClone(data);
    const emp = next.empleados.find((e) => e.id === empleadoId);
    if (!emp) return;
    emp.foto = cambios.foto || undefined;
    emp.descripcion = cambios.descripcion?.trim() || undefined;
    persist(next);
  }

  function removeEmpleado(id: string) {
    if (!data) return;
    const next = structuredClone(data);
    next.empleados = next.empleados.filter((e) => e.id !== id);
    persist(next);
    setModal(null);
  }

  // Catálogo de insumos de Bar/Cocina (Negocio > Control de Bar/Cocina) y
  // el catálogo de proveedores que comparten — este último no tenía
  // ninguna pantalla propia todavía, así que un insumo nuevo puede crear
  // un proveedor al vuelo desde su mismo modal. Los dos van en el mismo
  // structuredClone(data) + persist, para que crear el proveedor y
  // guardar el insumo sea una sola escritura atómica (si fueran dos
  // llamadas separadas, la segunda partiría de un `data` desactualizado y
  // borraría el proveedor que acababa de crear la primera).
  function upsertInsumo(entry: InsumoEntry, nuevoProveedor?: ProveedorCatalogEntry) {
    if (!data) return;
    const next = structuredClone(data);
    if (nuevoProveedor) next.proveedores.push(nuevoProveedor);
    const idx = next.insumos.findIndex((i) => i.id === entry.id);
    if (idx >= 0) next.insumos[idx] = entry;
    else next.insumos.push(entry);
    persist(next);
  }

  // Negocio > Compras > Importar catálogo: crea los proveedores que falten
  // (por nombre) y agrega/actualiza los insumos en un solo persist. De los
  // existentes solo cambia precio, presentación, unidad y proveedor — su
  // área, equivalencia, apodos y alta rotación se quedan.
  function importarCatalogo(imp: ImportacionCatalogo) {
    if (!data) return;
    const next = structuredClone(data);
    const proveedorDe = (nombre: string) => {
      if (!nombre) return undefined;
      const clave = normalizarNombre(nombre);
      let p = next.proveedores.find((x) => [x.nombre, ...(x.apodos || [])].some((n) => normalizarNombre(n) === clave));
      if (!p) {
        p = { id: uid(), nombre };
        next.proveedores.push(p);
      }
      return p.id;
    };
    imp.insumos.forEach((f) => {
      const existente = f.existenteId ? next.insumos.find((i) => i.id === f.existenteId) : undefined;
      const proveedorId = proveedorDe(f.proveedor);
      if (existente) {
        existente.precio = f.precio;
        existente.unidad = f.unidad;
        existente.unidadPedido = f.unidadPedido;
        if (!f.unidadPedido) delete existente.equivalenciaPedido;
        existente.proveedorId = proveedorId;
        if (f.pendiente) existente.pendiente = f.pendiente;
      } else {
        next.insumos.push({
          id: uid(),
          area: f.area,
          nombre: f.nombre,
          unidad: f.unidad,
          precio: f.precio,
          proveedorId,
          unidadPedido: f.unidadPedido,
          ...(f.pendiente ? { pendiente: f.pendiente } : {}),
        });
      }
    });
    persist(next);
  }

  function removeInsumo(id: string) {
    if (!data) return;
    const next = structuredClone(data);
    next.insumos = next.insumos.filter((i) => i.id !== id);
    persist(next);
  }

  function guardarMetaSemanal(meta: number | undefined) {
    if (!data) return;
    const next = structuredClone(data);
    if (meta && meta > 0) next.metaSemanal = meta;
    else delete next.metaSemanal;
    persist(next);
  }

  function guardarInventarioNotas(fecha: string, texto: string) {
    if (!data) return;
    const next = structuredClone(data);
    next.inventariosNotas[fecha] = texto;
    persist(next);
  }

  // Une productos repetidos del catálogo en el que se queda: los nombres y
  // apodos de los otros pasan a ser apodos suyos (así las notas viejas se
  // siguen leyendo), toma lo que le falte (precio, proveedor, presentación)
  // y las capturas viejas por insumo (conteo diario e inventario/pedido
  // semanal) se pasan a él. El historial en texto no cambia.
  function unirInsumos(quedaId: string, otrosIds: string[]) {
    if (!data) return;
    const next = structuredClone(data);
    const queda = next.insumos.find((i) => i.id === quedaId);
    const otros = next.insumos.filter((i) => otrosIds.includes(i.id) && i.id !== quedaId);
    if (!queda || otros.length === 0) return;
    const nombres = [...(queda.apodos || []), ...otros.flatMap((o) => [o.nombre, ...(o.apodos || [])])];
    const apodos = nombres.filter(
      (a, i) => normalizarNombre(a) !== normalizarNombre(queda.nombre) && nombres.findIndex((b) => normalizarNombre(b) === normalizarNombre(a)) === i
    );
    if (apodos.length > 0) queda.apodos = apodos;
    otros.forEach((o) => {
      if (queda.precio === undefined && o.precio !== undefined) queda.precio = o.precio;
      if (!queda.proveedorId && o.proveedorId) queda.proveedorId = o.proveedorId;
      if (!queda.unidadPedido && o.unidadPedido) {
        queda.unidadPedido = o.unidadPedido;
        if (o.equivalenciaPedido) queda.equivalenciaPedido = o.equivalenciaPedido;
      }
      if (o.altaRotacion && o.area === queda.area) queda.altaRotacion = true;
    });
    const mover = (filas: Record<string, unknown> | undefined) => {
      if (!filas) return;
      otros.forEach((o) => {
        if (filas[o.id] !== undefined && filas[quedaId] === undefined) filas[quedaId] = filas[o.id];
        delete filas[o.id];
      });
    };
    Object.values(next.conteosDiarios || {}).forEach(mover);
    Object.values(next.inventarioSemanal || {}).forEach((m) => m.weeks.forEach((w) => mover(w?.filas)));
    Object.values(next.pedidosSemanal || {}).forEach((m) => m.weeks.forEach((w) => mover(w?.filas)));
    next.insumos = next.insumos.filter((i) => !otros.some((o) => o.id === i.id));
    persist(next);
  }

  function saltarJuevesInventario(fecha: string, saltado: boolean) {
    if (!data) return;
    const next = structuredClone(data);
    const saltados = { ...(next.inventarioJuevesSaltado || {}) };
    if (saltado) saltados[fecha] = true;
    else delete saltados[fecha];
    next.inventarioJuevesSaltado = saltados;
    persist(next);
  }

  function guardarPedidoInventario(fecha: string, pedido: Record<string, number>) {
    if (!data) return;
    const next = structuredClone(data);
    next.pedidosInventario[fecha] = pedido;
    persist(next);
  }

  // Liga un renglón no reconocido de las notas del Inventario con su insumo,
  // guardando lo escrito como apodo para reconocerlo solo la próxima vez.
  function asignarApodoInsumo(insumoId: string, apodo: string) {
    if (!data) return;
    const next = structuredClone(data);
    const insumo = next.insumos.find((i) => i.id === insumoId);
    if (!insumo) return;
    const actuales = insumo.apodos || [];
    if (!actuales.some((a) => a.toLowerCase() === apodo.toLowerCase())) insumo.apodos = [...actuales, apodo];
    persist(next);
  }

  // Pedidos pegados de WhatsApp (permiso "Pedidos"): por semana y
  // proveedor; lo de un proveedor que se vuelve a pegar se reemplaza.
  function guardarPedidosCargados(lunes: string, porProveedor: Record<string, Record<string, number>>) {
    if (!data) return;
    const next = structuredClone(data);
    const semana = { ...(next.pedidosCargados?.[lunes] || {}) };
    const en = new Date().toISOString();
    const por = profile.display_name || (isOwner ? "Dueño" : "Equipo");
    Object.entries(porProveedor).forEach(([provId, cantidades]) => {
      semana[provId] = { cantidades, por, en };
    });
    next.pedidosCargados = { ...(next.pedidosCargados || {}), [lunes]: semana };
    persist(next);
  }

  function guardarPedidoDiario(area: ConteoTextoArea, fecha: string, pedido: Record<string, number>) {
    if (!data) return;
    const next = structuredClone(data);
    next.pedidosDiarios[area][fecha] = pedido;
    persist(next);
  }

  // Recetario (Negocio > Bar/Cocina > Recetario).
  function saveReceta(receta: Receta) {
    if (!data) return;
    const next = structuredClone(data);
    const lista = next.recetas || [];
    const i = lista.findIndex((r) => r.id === receta.id);
    if (i >= 0) lista[i] = receta;
    else lista.push(receta);
    next.recetas = lista;
    persist(next);
  }

  // "Cargar varias": varias recetas de un jalón (las que ya existían por
  // nombre llegan con su mismo id y se reemplazan).
  function saveRecetas(recetas: Receta[]) {
    if (!data || recetas.length === 0) return;
    const next = structuredClone(data);
    const lista = next.recetas || [];
    recetas.forEach((receta) => {
      const i = lista.findIndex((r) => r.id === receta.id);
      if (i >= 0) lista[i] = receta;
      else lista.push(receta);
    });
    next.recetas = lista;
    persist(next);
  }

  function removeReceta(id: string) {
    if (!data) return;
    const next = structuredClone(data);
    next.recetas = (next.recetas || []).filter((r) => r.id !== id);
    persist(next);
  }

  function guardarConteoTexto(area: ConteoTextoArea, fecha: string, texto: string) {
    if (!data) return;
    const next = structuredClone(data);
    next.conteosDiariosTexto[area][fecha] = texto;
    // Para avisarle al dueño cuando quedó guardado (ver notificacionesLogica).
    next.conteosEditados = {
      ...next.conteosEditados,
      [area]: { ...next.conteosEditados?.[area], [fecha]: { en: new Date().toISOString(), por: profile.display_name || (isOwner ? "Dueño" : "Equipo") } },
    };
    persist(next);
  }

  function guardarConfigNotificaciones(config: ConfigNotificaciones) {
    if (!data) return;
    const next = structuredClone(data);
    next.notificaciones = config;
    persist(next);
  }

  function saveMeseroCut(form: MeseroFormValues, editingId?: string) {
    if (bloqueadoMedioTurno(editingId)) return;
    updateDay((d) => {
      const venta = parseFloat(form.venta) || 0;
      const tarjetas = sumFromText(form.tarjetas);
      const transferencia = sumFromText(form.transferMonto);
      const propina =
        form.propinaTipo === "p3"
          ? round2(venta * 0.03)
          : form.propinaTipo === "p2"
            ? round2(venta * 0.02)
            : form.propinaTipo === "manual"
              ? parseFloat(form.manualPropina) || 0
              : 0;
      const existingGastosSum = editingId
        ? d.gastos.filter((g) => g.meseroCutId === editingId).reduce((s, g) => s + g.total, 0)
        : 0;
      const newGastosSum = (form.gastos || []).reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
      const gastosTotal = round2(existingGastosSum + newGastosSum);
      const total = round2(venta - tarjetas - transferencia + propina - gastosTotal);
      const entry: MeseroCut = {
        id: editingId || uid(),
        meseroId: form.meseroId,
        nombre: form.nombre,
        venta, tarjetas, transferencia, propinaTipo: form.propinaTipo, propina, gastosTotal, total,
        ...(form.tarjetasDesglose ? { tarjetasDesglose: form.tarjetasDesglose } : {}),
        ...(transferencia > 0 && form.transferDesglose ? { transferenciaDesglose: form.transferDesglose } : {}),
        ...(form.lecturaSistema !== undefined ? { lecturaSistema: form.lecturaSistema, ...(form.cobro ? { cobro: form.cobro } : {}) } : {}),
      };
      if (editingId) {
        const i = d.meseros.findIndex((m) => m.id === editingId);
        d.meseros[i] = entry;
        d.transferencias = d.transferencias.filter((t) => t.meseroCutId !== editingId);
      } else {
        d.meseros.push(entry);
      }
      (form.gastos || []).forEach((g) => {
        d.gastos.push({
          id: uid(),
          concepto: g.concepto,
          total: parseFloat(g.monto) || 0,
          estado: "pendiente",
          origen: "mesero",
          meseroNombre: form.nombre,
          meseroCutId: entry.id,
        });
      });
      if (transferencia > 0) {
        d.transferencias.push({
          id: uid(),
          persona: form.nombre,
          total: transferencia,
          origen: "mesero",
          meseroCutId: entry.id,
          ...(form.transferDesglose ? { desglose: form.transferDesglose } : {}),
        });
      }
      // "Para llevar": la venta de cada corte es lectura − corte anterior.
      recalcularAcumulados(d);
    });
    setModal(null);
  }

  function deleteMeseroCut(id: string) {
    if (bloqueadoMedioTurno(id)) return;
    updateDay((d) => {
      d.meseros = d.meseros.filter((m) => m.id !== id);
      d.transferencias = d.transferencias.filter((t) => t.meseroCutId !== id);
      recalcularAcumulados(d);
    });
    setModal(null);
  }

  function saveGasto(form: GastoFormValues, editingId?: string) {
    if (bloqueadoMedioTurno(editingId)) return;
    updateDay((d) => {
      // empleadoId/meseroId solo aplican a las categorías que representan
      // dinero dado/gastado en alguien específico — si la categoría cambió
      // a otra cosa, se limpian solos.
      const ligableAEmpleado = form.categoria === "nomina" || form.categoria === "comida_empleado";
      const ligableAMesero = form.categoria === "cancelaciones";
      const entry: Gasto = {
        id: editingId || uid(),
        concepto: form.concepto,
        total: parseFloat(form.total) || 0,
        estado: form.estado,
        origen: "manual",
        categoria: form.categoria || undefined,
        empleadoId: ligableAEmpleado ? form.empleadoId || undefined : undefined,
        meseroId: ligableAMesero ? form.meseroId || undefined : undefined,
      };
      if (editingId) {
        const i = d.gastos.findIndex((g) => g.id === editingId);
        d.gastos[i] = { ...d.gastos[i], ...entry };
      } else d.gastos.push(entry);
    });
    setModal(null);
  }

  function toggleGastoEstado(id: string) {
    if (bloqueadoMedioTurno(id)) return;
    updateDay((d) => {
      const g = d.gastos.find((x) => x.id === id);
      if (g) g.estado = g.estado === "pendiente" ? "ingresado" : "pendiente";
    });
  }

  // Estas dos toman monthKey/weekIndex explícitos (en vez de usar
  // updateWeek, que depende de la semana activa en la pestaña Corte)
  // porque "Control de gastos en efectivo" ahora también se abre desde
  // Negocio, con su propio selector de mes/semana.
  function toggleGastoEstadoInWeek(monthKey: string, weekIndex: number, dayName: DayName, id: string) {
    if (!data) return;
    const next = structuredClone(data);
    const g = next.months[monthKey].weeks[weekIndex].days[dayName].gastos.find((x) => x.id === id);
    if (g) g.estado = g.estado === "pendiente" ? "ingresado" : "pendiente";
    persist(next);
  }

  function setGastoCategoriaInWeek(monthKey: string, weekIndex: number, dayName: DayName, id: string, categoria: GastoCategoria | "") {
    if (!data) return;
    const next = structuredClone(data);
    const g = next.months[monthKey].weeks[weekIndex].days[dayName].gastos.find((x) => x.id === id);
    if (g) g.categoria = categoria || undefined;
    persist(next);
  }

  // Mover un gasto de un día a otro dentro de la misma semana, desde
  // "Control de gastos en efectivo". El registro (id, categoría, estado)
  // se conserva — solo cambia de día. Si estaba ligado al corte de un
  // mesero (se le restó ese gasto), se desliga y el total de ese mesero
  // en el día de origen se recalcula sumando de vuelta el monto, para que
  // el corte diario no quede desacomodado.
  function moverGastoEnSemana(monthKey: string, weekIndex: number, fromDay: DayName, toDay: DayName, id: string) {
    if (!data || fromDay === toDay) return;
    const next = structuredClone(data);
    const week = next.months[monthKey].weeks[weekIndex];
    const origenDia = week.days[fromDay];
    const idx = origenDia.gastos.findIndex((g) => g.id === id);
    if (idx < 0) return;
    const [gasto] = origenDia.gastos.splice(idx, 1);
    if (gasto.meseroCutId) {
      const cut = origenDia.meseros.find((m) => m.id === gasto.meseroCutId);
      if (cut) {
        cut.gastosTotal = round2(cut.gastosTotal - gasto.total);
        cut.total = round2(cut.total + gasto.total);
      }
      gasto.meseroCutId = undefined;
      gasto.meseroNombre = undefined;
      gasto.origen = "manual";
    }
    week.days[toDay].gastos.push(gasto);
    persist(next);
  }

  // Editar concepto/monto de un gasto desde "Control de gastos en
  // efectivo" — se refleja solo en el corte diario, porque es el mismo
  // registro (mismo id) en la misma estructura de datos. Si el gasto
  // estaba ligado al corte de un mesero, el cambio en el monto se
  // traslada a ese corte (gastosTotal/total), para que no quede
  // desacomodado.
  function editarGastoEnSemana(monthKey: string, weekIndex: number, dayName: DayName, id: string, concepto: string, total: number) {
    if (!data) return;
    const next = structuredClone(data);
    const dia = next.months[monthKey].weeks[weekIndex].days[dayName];
    const g = dia.gastos.find((x) => x.id === id);
    if (!g) return;
    const nuevoTotal = round2(total);
    const delta = round2(nuevoTotal - g.total);
    g.concepto = concepto;
    g.total = nuevoTotal;
    if (g.meseroCutId && delta !== 0) {
      const cut = dia.meseros.find((m) => m.id === g.meseroCutId);
      if (cut) {
        cut.gastosTotal = round2(cut.gastosTotal + delta);
        cut.total = round2(cut.total - delta);
      }
    }
    persist(next);
  }

  // Agregar un gasto desde la búsqueda de "Control de gastos en
  // efectivo", cuando el ticket no está capturado en ningún día.
  function agregarGastoEnSemana(monthKey: string, weekIndex: number, dayName: DayName, form: GastoFormValues) {
    if (!data) return;
    const next = structuredClone(data);
    const ligableAEmpleado = form.categoria === "nomina" || form.categoria === "comida_empleado";
    const ligableAMesero = form.categoria === "cancelaciones";
    next.months[monthKey].weeks[weekIndex].days[dayName].gastos.push({
      id: uid(),
      concepto: form.concepto,
      total: parseFloat(form.total) || 0,
      estado: form.estado,
      origen: "manual",
      categoria: form.categoria || undefined,
      empleadoId: ligableAEmpleado ? form.empleadoId || undefined : undefined,
      meseroId: ligableAMesero ? form.meseroId || undefined : undefined,
    });
    persist(next);
  }

  function deleteGasto(id: string) {
    if (bloqueadoMedioTurno(id)) return;
    updateDay((d) => {
      d.gastos = d.gastos.filter((g) => g.id !== id);
    });
    setModal(null);
  }

  function saveTransfer(form: TransferFormValues, editingId?: string) {
    if (bloqueadoMedioTurno(editingId)) return;
    updateDay((d) => {
      const entry = {
        id: editingId || uid(),
        persona: form.persona,
        total: parseFloat(form.total) || 0,
        ...(form.desglose ? { desglose: form.desglose } : {}),
      };
      if (editingId) {
        const i = d.transferencias.findIndex((t) => t.id === editingId);
        d.transferencias[i] = entry;
      } else d.transferencias.push(entry);
    });
    setModal(null);
  }

  function deleteTransfer(id: string) {
    if (bloqueadoMedioTurno(id)) return;
    updateDay((d) => {
      d.transferencias = d.transferencias.filter((t) => t.id !== id);
    });
    setModal(null);
  }

  // Control (solo informativo) de gastos que los proveedores dan a crédito,
  // pagados después por transferencia — vive por semana, igual que
  // efectivoReal, pero no afecta ningún total de caja del corte.
  // nuevoMontoFijo: si se cambió el monto fijo semanal de Gastos fijos,
  // aplica desde esta semana en adelante (reemplaza cambios posteriores).
  function saveCreditoProveedores(monthKey: string, weekIndex: number, values: CreditoProveedores, nuevoMontoFijo?: number) {
    if (!data) return;
    const next = structuredClone(data);
    next.months[monthKey].weeks[weekIndex].creditoProveedores = values;
    if (nuevoMontoFijo !== undefined) {
      const desde = resolveWeekStartDate(monthKey, weekIndex, next.months[monthKey]);
      next.montosFijosSemanales = [
        ...(next.montosFijosSemanales || []).filter((m) => m.desde < desde),
        { desde, monto: round2(nuevoMontoFijo) },
      ];
    }
    persist(next);
  }

  // Horario de una semana — usa las mismas semanas (mes/índice) que Corte,
  // pero vive aparte porque no afecta ningún total de caja.
  function saveHorarioSemana(monthKey: string, weekIndex: number, semana: HorarioSemana) {
    if (!data) return;
    const next = structuredClone(data);
    if (!next.horarios[monthKey]) next.horarios[monthKey] = { weeks: [null, null, null, null] };
    next.horarios[monthKey].weeks[weekIndex] = semana;
    persist(next);
  }

  // Descuentos (tardanzas, adelantos, comida) y extras (finiquitos, bonos)
  // de nómina de una semana — mismas semanas que Horarios; no afectan el
  // total bruto que usa el Dashboard, solo el neto que se ve en la propia
  // página de Nómina.
  function saveNominaDescuentos(monthKey: string, weekIndex: number, semana: NominaDescuentosSemana) {
    if (!data) return;
    const next = structuredClone(data);
    if (!next.nominaDescuentos[monthKey]) next.nominaDescuentos[monthKey] = { weeks: [null, null, null, null] };
    next.nominaDescuentos[monthKey].weeks[weekIndex] = semana;
    persist(next);
  }

  // Etiqueta Pendiente/Pagada de Nómina — la toca el dueño para marcar a
  // quién ya le pagó esa semana (y otra vez para regresarlo a pendiente).
  // Se guarda en las mismas "confirmaciones" donde antes cada empleado
  // confirmaba "Recibí mi nómina correcta", así que esas cuentan como
  // pagadas.
  function togglePagoNomina(monthKey: string, weekIndex: number, empleadoId: string, nombre: string, monto: number) {
    if (!data) return;
    const next = structuredClone(data);
    if (!next.nominaDescuentos[monthKey]) next.nominaDescuentos[monthKey] = { weeks: [null, null, null, null] };
    const semana = next.nominaDescuentos[monthKey].weeks[weekIndex] || { descuentos: [], extras: [] };
    const yaPagado = (semana.confirmaciones || []).some((c) => c.empleadoId === empleadoId);
    const confirmaciones = (semana.confirmaciones || []).filter((c) => c.empleadoId !== empleadoId);
    if (!yaPagado) confirmaciones.push({ empleadoId, nombre, confirmadoEn: new Date().toISOString(), monto });
    next.nominaDescuentos[monthKey].weeks[weekIndex] = { ...semana, confirmaciones };
    persist(next);
  }

  function toggleProveedorJueves(proveedorId: string, incluyeJueves: boolean) {
    if (!data) return;
    const next = structuredClone(data);
    const p = next.proveedores.find((x) => x.id === proveedorId);
    if (p) p.incluyeJueves = incluyeJueves;
    persist(next);
  }

  function addProveedor(entry: ProveedorCatalogEntry) {
    if (!data) return;
    const next = structuredClone(data);
    next.proveedores.push(entry);
    persist(next);
  }

  // Un proveedor con insumos asignados no se puede eliminar — Inventario y
  // el Catálogo dependen de esa referencia, y cada semana ya guardada de
  // Inventario se queda ligada a ese proveedor como historial.
  function removeProveedor(id: string) {
    if (!data) return;
    if (data.insumos.some((i) => i.proveedorId === id)) return;
    const next = structuredClone(data);
    next.proveedores = next.proveedores.filter((p) => p.id !== id);
    persist(next);
  }

  // Une un proveedor repetido (seVa) con el que se queda: sus insumos (y
  // facturas) pasan al que se queda, su nombre queda como apodo para que
  // Importar catálogo no lo vuelva a crear, y si alguno se contaba los
  // jueves, el que se queda también.
  function unirProveedores(quedaId: string, seVaId: string) {
    if (!data || quedaId === seVaId) return;
    const next = structuredClone(data);
    const queda = next.proveedores.find((p) => p.id === quedaId);
    const seVa = next.proveedores.find((p) => p.id === seVaId);
    if (!queda || !seVa) return;
    next.insumos.forEach((i) => {
      if (i.proveedorId === seVaId) i.proveedorId = quedaId;
    });
    next.facturas.forEach((f) => {
      if (f.proveedorId === seVaId) f.proveedorId = quedaId;
    });
    const apodos = [...(queda.apodos || []), seVa.nombre, ...(seVa.apodos || [])];
    queda.apodos = apodos.filter((a, i) => normalizarNombre(a) !== normalizarNombre(queda.nombre) && apodos.findIndex((b) => normalizarNombre(b) === normalizarNombre(a)) === i);
    if (seVa.incluyeJueves) queda.incluyeJueves = true;
    next.proveedores = next.proveedores.filter((p) => p.id !== seVaId);
    persist(next);
  }

  function guardarCorte() {
    updateDay((d) => {
      d.corteGuardado = { fecha: new Date().toISOString(), nombre: profile.display_name || (isOwner ? "Dueño" : "Alguien del equipo") };
    });
    setModal(null);
    // El corte del domingo cierra la semana: ganador, puntos y logros.
    if (isOwner && !soloLectura && data && activeDay === "Domingo" && activeDayDate) {
      cerrarSemana(data, addDaysIso(activeDayDate, -6)).then((r) => !r.ok && console.error("No se cerró la semana:", r.error));
    }
  }

  // "Corte de apertura": crea los cortes (sin propina) del usuario de para
  // llevar y del de quien abrió, con sus gastos y transferencias, anota las
  // apps hasta ese momento y bloquea todo eso para el personal.
  function guardarApertura(v: AperturaValues) {
    updateDay((d, next) => {
      const ids: string[] = [];
      v.bloques.forEach((b) => {
        const gastosTotal = round2(b.gastos.reduce((s, g) => s + g.monto, 0));
        const cut: MeseroCut = {
          id: uid(),
          meseroId: b.meseroId,
          nombre: b.nombre,
          venta: b.venta,
          tarjetas: b.tarjetas,
          transferencia: b.transferencia,
          propinaTipo: "none",
          propina: 0,
          gastosTotal,
          total: round2(b.venta - b.tarjetas - b.transferencia - gastosTotal),
          lecturaSistema: b.venta,
          apertura: true,
          ...(b.tarjetasDesglose ? { tarjetasDesglose: b.tarjetasDesglose } : {}),
          ...(b.transferencia > 0 && b.transferDesglose ? { transferenciaDesglose: b.transferDesglose } : {}),
        };
        d.meseros.push(cut);
        ids.push(cut.id);
        b.gastos.forEach((g) => {
          const id = uid();
          d.gastos.push({ id, concepto: g.concepto, total: g.monto, estado: "pendiente", origen: "mesero", meseroNombre: b.nombre, meseroCutId: cut.id });
          ids.push(id);
        });
        if (b.transferencia > 0) {
          const id = uid();
          d.transferencias.push({
            id, persona: b.nombre, total: b.transferencia, origen: "mesero", meseroCutId: cut.id,
            ...(b.transferDesglose ? { desglose: b.transferDesglose } : {}),
          });
          ids.push(id);
        }
      });
      // Apps: el total del día empieza con lo de la apertura.
      if ((d.ventaApps || 0) < v.ventaApps) d.ventaApps = v.ventaApps;
      d.apertura = {
        fecha: new Date().toISOString(),
        nombre: profile.display_name || (isOwner ? "Dueño" : "Alguien del equipo"),
        ...(v.abrio ? { abrio: v.abrio } : {}),
        ventaApps: v.ventaApps,
        ids,
      };
      recalcularAcumulados(d);
      // Se recuerda el usuario del sistema de quien abrió.
      const emp = next.empleados.find((e) => e.id === v.abrio?.empleadoId);
      if (emp && v.usuarioSistemaId) emp.usuarioSistemaId = v.usuarioSistemaId;
    });
    setModal(null);
  }

  function guardarEfectivoDejado(monto: number, nota: string) {
    updateDay((d) => {
      if (monto > 0) d.efectivoDejado = { monto: round2(monto), ...(nota.trim() ? { nota: nota.trim() } : {}) };
      else delete d.efectivoDejado;
    });
    setModal(null);
  }

  function quitarApertura() {
    updateDay((d) => {
      delete d.apertura;
    });
    setModal(null);
  }

  function reabrirCorte() {
    updateDay((d) => {
      delete d.corteGuardado;
    });
    setModal(null);
  }

  function saveVentaApps(rawValue: string, desglose?: number[]) {
    updateDay((d) => {
      d.ventaApps = sumFromText(rawValue);
      if (desglose) d.ventaAppsDesglose = desglose;
      else delete d.ventaAppsDesglose;
    });
    setModal(null);
  }

  const totals = day
    ? (() => {
        const ventaMeseros = day.meseros.reduce((s, m) => s + m.venta, 0);
        const ventaApps = day.ventaApps || 0;
        const tarjetas = day.meseros.reduce((s, m) => s + m.tarjetas, 0);
        const transferencias = day.transferencias.reduce((s, t) => s + t.total, 0);
        const gastos = day.gastos.reduce((s, g) => s + g.total, 0);
        return {
          ventaLocal: round2(ventaMeseros),
          ventaApps: round2(ventaApps),
          ventaTotal: round2(ventaMeseros + ventaApps),
          tarjetas,
          transferencias,
          gastos,
          propina: day.meseros.reduce((s, m) => s + m.propina, 0),
          efectivo: round2(ventaMeseros - tarjetas - transferencias - gastos),
        };
      })()
    : null;

  // Efectivo a entregar (desde el 21/10/2026), ver efectivoDelDia.
  const efectivoDia =
    day && totals && turnosDelDia && activeDayDate ? efectivoDelDia(data.months, activeDayDate, day, totals.efectivo) : null;

  if (invitadoVencido) {
    return (
      <div className="app-shell">
        <div className="full-page-msg">
          Tu acceso de invitado ya venció. Pídele al dueño que te lo renueve si quieres volver a verlo.
          <button className="btn-secundario" onClick={signOut}>
            Salir
          </button>
        </div>
      </div>
    );
  }

  // Recorrido guiado del acceso de invitado: cada paso abre la pantalla real.
  const irTab = (tab: OwnerTab) => () => {
    setModal(null);
    goToTab(tab);
  };
  const irEquipo = (v: EquipoView) => () => {
    setModal(null);
    setActiveTab("equipo");
    setEquipoView(v);
  };
  const irNegocio = (v: NegocioView) => () => {
    setModal(null);
    setActiveTab("negocio");
    setNegocioView(v);
  };
  const pasosRecorrido: PasoRecorrido[] = [
    {
      titulo: "🏠 Inicio: lo que necesita atención hoy",
      texto: "Al abrir la app sale la venta de la semana contra la anterior y solo los pendientes que ya tocan: cortes sin guardar, inventarios, nómina por pagar.",
      valor: "en 10 segundos sabes cómo va el negocio y qué falta.",
      ir: irTab("inicio"),
      buscar: () => buscarEn(".ini-venta, .ini-resumen, .ini-grupo"),
    },
    {
      titulo: "🧾 Corte del día y efectivo",
      texto: "Cada mesero captura su venta, tarjetas, transferencias y gastos. La app calcula sola el efectivo a entregar y \"Guardar corte\" lo bloquea para que nadie lo cambie.",
      valor: "cuadre exacto del efectivo y menos faltantes.",
      ir: irTab("corte"),
      buscar: () => buscarEn(".efectivo-fila.total")?.parentElement || buscarEn(".page-section"),
    },
    {
      titulo: "💸 Gastos en efectivo y transferencias",
      texto: "Cada gasto queda con su categoría, si está pagado o pendiente, a qué proveedor y si fue a crédito, por semana.",
      valor: "sabes a dónde se va cada peso.",
      ir: irTab("negocio"),
      buscar: () => buscarEn(".menu-item", "Control de gastos en efectivo"),
    },
    {
      titulo: "📊 Dashboard: el reporte al momento",
      texto: "La utilidad de la semana hasta hoy: venta, nómina, gastos fijos y operativos, con \"Copiar avance\" para mandarlo por WhatsApp.",
      valor: "el reporte que antes tomaba horas, en un toque.",
      ir: irTab("dashboard"),
      buscar: () => buscarEn(".page-section > *:nth-child(2)"),
    },
    {
      titulo: "📈 Tendencias y diagnósticos",
      texto: "Proyecta cómo cerrará la semana y avisa solo de lo raro: un gasto alto, un día sin corte, la nómina arriba de 16% de la venta.",
      valor: "te avisa antes de que sea un problema.",
      ir: irNegocio("tendencias"),
      buscar: () => buscarEn(".tend-card"),
    },
    {
      titulo: "🗓️ Horarios → nómina automática",
      texto: "Se arma el horario de la semana y la nómina sale sola: dobles, festivos y descansos pagados, con su % sobre la venta.",
      valor: "cero errores de pago y la nómina bajo control.",
      ir: irEquipo("nomina"),
      buscar: () => buscarEn(".page-section > *:nth-child(3)"),
    },
    {
      titulo: "💬 Pregúntale a Cortes",
      texto: "Se le pregunta como a una persona: \"¿venta promedio de los viernes?\", \"¿cuánto se pagó de nómina?\". El personal también, pero solo de lo suyo.",
      valor: "respuestas al instante sin buscar en reportes.",
      ir: irTab("inicio"),
      buscar: () => buscarEn(".preguntas-fab"),
    },
    {
      titulo: "🏆 Ranking de meseros",
      texto: "Cada semana se califica a los meseros por venta por día trabajado y se restan las cancelaciones. El ganador y sus logros los ve todo el equipo, y juntan Monedas Anubis canjeables.",
      valor: "competencia sana: más venta por mesa y menos cancelaciones.",
      ir: irEquipo("ranking"),
      buscar: () => buscarEn(".ranking-lista, .page-section > *:nth-child(2)"),
    },
    {
      titulo: "⭐ Encuestas con QR",
      texto: "El mesero muestra un QR y el cliente califica en 30 segundos, sin descargar nada. Tiene 5 candados contra trampas y se sigue cada paso.",
      valor: "el servicio se mide con la voz del cliente, mesero por mesero.",
      ir: irEquipo("encuestas"),
      buscar: () => buscarEn(".encuestas-pestanas"),
    },
    {
      titulo: "📦 Inventario, pedidos y recetarios",
      texto: "Conteo diario por área, inventario semanal, lo que hay que pedir y las recetas de cocina y bar.",
      valor: "menos merma y pedidos a tiempo.",
      ir: irTab("negocio"),
      buscar: () => buscarEn(".menu-item", "Inventario"),
    },
    {
      titulo: "🔒 Seguridad y Actividad",
      texto: "Cada quien ve solo lo que le toca y todo queda registrado: quién hizo qué cambio y cuándo.",
      valor: "control y confianza en los números.",
      ir: irNegocio("bitacora"),
      buscar: () => buscarEn(".page-section > *:nth-child(3)"),
    },
  ];

  return (
    <div className={`app-shell ${isOwner ? "with-bottom-nav" : ""}`}>
      {isOwner && !soloLectura && <NovedadesAlEntrar profile={profile} data={data} tieneCorte={false} />}
      {soloLectura && <SoloLecturaGuard />}
      {soloLectura && recorrido === "bienvenida" && (
        <Bienvenida data={data} onEmpezar={() => setRecorrido("pasos")} onExplorar={() => setRecorrido(null)} />
      )}
      {soloLectura && recorrido === "pasos" && (
        <Recorrido pasos={pasosRecorrido} onFin={() => setRecorrido("opinion")} onSalir={() => setRecorrido(null)} />
      )}
      {soloLectura && recorrido === "opinion" && <OpinionInvitado profile={profile} prueba={pruebaInvitado} onCerrar={() => setRecorrido(null)} />}
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/favicon.svg" alt="Cortes" />
          <RanuraTitulo />
        </div>
        <div className="topbar-actions">
          {saveState === "error" && <span className="save-badge error">No se guardó</span>}
          {saveState === "saving" && <span className="save-badge">Guardando…</span>}
          {isOwner && (
            <button type="button" className="avatar-btn" aria-label="Mi perfil" onClick={() => goToTab("perfil")}>
              <Avatar nombre={data.perfilDueno?.nombre || profile.display_name || "Tú"} foto={data.perfilDueno?.foto} tamano={36} />
            </button>
          )}
          {!isOwner && miEmpleado && (
            <button
              type="button"
              className="avatar-btn"
              aria-label="Mi perfil"
              onClick={() => {
                setStaffVista("perfil");
                setSelectedAssignedDate(null);
              }}
            >
              <Avatar nombre={miEmpleado.nombre} foto={miEmpleado.foto} tamano={36} />
            </button>
          )}
          <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      {soloLectura && (
        <SoloLecturaBarra
          prueba={pruebaInvitado}
          onRecorrido={() => setRecorrido("bienvenida")}
          onSalir={() => {
            setPruebaInvitado(false);
            setRecorrido(null);
            goToTab("equipo");
            setEquipoView("personal");
          }}
        />
      )}

      {isOwner && activeTab === "equipo" && equipoView === "menu" && (
        <div className="page-section">
          <TituloPagina titulo="Equipo" />
          <div className="menu-list">
            <button className="menu-item" onClick={() => setEquipoView("personal")}>
              <span className="menu-item-icon">
                <Contact size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Personal</strong>
                <span>Lista de tu personal</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setModal({ type: "catalog" })}>
              <span className="menu-item-icon">
                <Settings2 size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Meseros</strong>
                <span>Catálogo de meseros para el corte</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setEquipoView("horarios")}>
              <span className="menu-item-icon">
                <Clock size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Horarios</strong>
                <span>Arma el horario semanal de tu personal</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setEquipoView("nomina")}>
              <span className="menu-item-icon">
                <Wallet size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Nómina</strong>
                <span>Calculada sola a partir de Horarios</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setEquipoView("propinas")}>
              <span className="menu-item-icon">
                <Coins size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Propinas</strong>
                <span>Consulta las propinas de cada día de la semana</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setEquipoView("ranking")}>
              <span className="menu-item-icon">
                <Trophy size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Ranking</strong>
                <span>Ranking de meseros por venta y cancelaciones (el personal de Piso lo ve sin montos)</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setEquipoView("puntos")}>
              <span className="menu-item-icon">
                <Award size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Monedas y logros</strong>
                <span>Ganador de cada semana, las Monedas Anubis que junta cada quien y sus logros</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setEquipoView("encuestas")}>
              <span className="menu-item-icon">
                <QrCode size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Encuestas</strong>
                <span>Lo que califican los clientes a cada mesero, con comentarios y las sospechosas</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {isOwner && activeTab === "equipo" && equipoView === "personal" && (
        <EmpleadosPanel
          empleados={data.empleados}
          tuId={empleadoDelDueno(data)?.id}
          fotoTu={data.perfilDueno?.foto}
          areas={data.areas}
          puestos={data.puestos}
          onAdd={() => setModal({ type: "empleado" })}
          onEdit={(entry) => setModal({ type: "empleado", editing: entry })}
          onBack={() => setEquipoView("menu")}
        />
      )}
      {isOwner && activeTab === "equipo" && equipoView === "personal" && !soloLectura && (
        <AccesoInvitados
          ownerId={profile.id}
          onProbar={() => {
            setPruebaInvitado(true);
            goToTab("inicio");
            setRecorrido("bienvenida");
          }}
        />
      )}

      {isOwner && activeTab === "equipo" && equipoView === "horarios" && (
        <HorariosPanel
          onBack={() => setEquipoView("menu")}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={desdeInicio?.mk ?? (mostRecentMonthKey as string)}
          initialWeekIndex={desdeInicio?.wi ?? mostRecentWeekIdx}
          empleados={data.empleados}
          horarios={data.horarios}
          onSaveSemana={saveHorarioSemana}
        />
      )}

      {isOwner && activeTab === "equipo" && equipoView === "nomina" && (
        <NominaPanel
          onBack={() => setEquipoView("menu")}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={desdeInicio?.mk ?? (mostRecentMonthKey as string)}
          initialWeekIndex={desdeInicio?.wi ?? mostRecentWeekIdx}
          empleados={data.empleados}
          horarios={data.horarios}
          nominaDescuentos={data.nominaDescuentos}
          onSaveDescuentos={saveNominaDescuentos}
          onGoToHorarios={() => setEquipoView("horarios")}
          onTogglePagado={togglePagoNomina}
          pagoDe={pagoDeEmpleado}
          avisoPago={estadoDatosPago === "sin-tabla" ? "Para ver a dónde pagarle a cada quien, activa los datos de pago: corre supabase/migration_009_datos_pago.sql en Supabase." : undefined}
        />
      )}

      {isOwner && activeTab === "equipo" && equipoView === "encuestas" && (
        <EncuestasPanel
          data={data}
          perfilId={profile.id}
          nombreDueno={(data.perfilDueno?.nombre || profile.display_name || "").split(" ")[0]}
          onBack={() => setEquipoView("menu")}
        />
      )}

      {isOwner && activeTab === "equipo" && equipoView === "puntos" && (
        <PuntosPanel data={data} ownerId={duenoId} onBack={() => setEquipoView("menu")} />
      )}

      {isOwner && activeTab === "equipo" && equipoView === "ranking" && (
        <RankingPanel data={data} modo="dueno" onBack={() => setEquipoView("menu")} backLabel="Equipo" />
      )}

      {isOwner && activeTab === "equipo" && equipoView === "propinas" && (
        <PropinasPanel
          onBack={() => setEquipoView("menu")}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
        />
      )}

      {isOwner && activeTab === "negocio" && negocioView === "menu" && (
        <div className="page-section">
          <TituloPagina titulo="Negocio" />
          <div className="menu-list">
            <button className="menu-item" onClick={() => setModal({ type: "proveedores" })}>
              <span className="menu-item-icon">
                <Handshake size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Proveedores</strong>
                <span>Catálogo de proveedores de Bar y Cocina</span>
              </span>
            </button>
          </div>

          <h3 className="menu-subtitle">Control de gastos</h3>
          <div className="menu-list">
            <button
              className="menu-item"
              disabled={monthKeys.length === 0}
              onClick={() => setModal({ type: "gastosSummary" })}
            >
              <span className="menu-item-icon">
                <Receipt size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Control de gastos en efectivo</strong>
                <span>
                  {monthKeys.length === 0
                    ? "Agrega un mes desde Corte para empezar a usar esto"
                    : "Gastos de la semana capturados en el corte"}
                </span>
              </span>
            </button>
            <button
              className="menu-item"
              disabled={monthKeys.length === 0}
              onClick={() => setModal({ type: "creditoProveedores" })}
            >
              <span className="menu-item-icon">
                <Truck size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Control de gastos en transferencia</strong>
                <span>
                  {monthKeys.length === 0
                    ? "Agrega un mes desde Corte para empezar a usar esto"
                    : "Gastos a crédito pagados por transferencia"}
                </span>
              </span>
            </button>
          </div>

          <h3 className="menu-subtitle">Análisis</h3>
          <div className="menu-list">
            <button className="menu-item" onClick={() => setNegocioView("tendencias")}>
              <span className="menu-item-icon">
                <ChartLine size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Tendencias</strong>
                <span>Comparativo semanal y proyección de venta</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setNegocioView("bitacora")}>
              <span className="menu-item-icon">
                <History size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Actividad</strong>
                <span>Quién usa la app, qué cambió y cuándo — alertas y uso por persona</span>
              </span>
            </button>
          </div>

          <h3 className="menu-subtitle">Compras</h3>
          <div className="menu-list">
            <button className="menu-item" onClick={() => setNegocioView("inventario")}>
              <span className="menu-item-icon">
                <Package size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Inventario</strong>
                <span>Insumos de Bar y Cocina, agrupados por proveedor</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setNegocioView("pedidos")}>
              <span className="menu-item-icon">
                <ShoppingCart size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Pedidos</strong>
                <span>Cuánto pedirle a cada proveedor, con el inventario como referencia</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setNegocioView("importarCatalogo")}>
              <span className="menu-item-icon">
                <FileUp size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Importar catálogo</strong>
                <span>Desde el Excel de precios base de Johnster</span>
              </span>
            </button>
          </div>

          <h3 className="menu-subtitle">Bar</h3>
          <div className="menu-list">
            <button className="menu-item" onClick={() => setNegocioView("controlBar")}>
              <span className="menu-item-icon">
                <Martini size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Control de Bar</strong>
                <span>Catálogo y conteo diario de insumos</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setNegocioView("recetarioBar")}>
              <span className="menu-item-icon">
                <BookOpen size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Recetario de Bar</strong>
                <span>Recetas de bebidas: medidas, vaso y preparación</span>
              </span>
            </button>
          </div>

          <h3 className="menu-subtitle">Cocina</h3>
          <div className="menu-list">
            <button className="menu-item" onClick={() => setNegocioView("controlCocina")}>
              <span className="menu-item-icon">
                <ChefHat size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Control de Cocina</strong>
                <span>Catálogo y conteo diario de insumos</span>
              </span>
            </button>
            <button className="menu-item" onClick={() => setNegocioView("recetarioCocina")}>
              <span className="menu-item-icon">
                <BookOpen size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Recetario de Cocina</strong>
                <span>Recetas de platillos: porciones, utensilios y preparación</span>
              </span>
            </button>
          </div>

          <h3 className="menu-subtitle">General</h3>
          <div className="menu-list">
            <button className="menu-item" onClick={() => setNegocioView("controlGeneral")}>
              <span className="menu-item-icon">
                <Boxes size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Control General</strong>
                <span>Desechables, limpieza y otros insumos que no son de Bar ni Cocina</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {isOwner && activeTab === "negocio" && negocioView === "tendencias" && (
        <TendenciasPanel
          onBack={() => setNegocioView("menu")}
          months={data.months}
          horarios={data.horarios}
          empleados={data.empleados}
          meseros={data.meseros}
          montosFijos={data.montosFijosSemanales}
          meta={data.metaSemanal}
          onGuardarMeta={guardarMetaSemanal}
        />
      )}

      {isOwner && activeTab === "negocio" && negocioView === "bitacora" && (
        <ActividadPanel onBack={() => setNegocioView("menu")} ownerId={duenoId} />
      )}

      {isOwner && activeTab === "negocio" && negocioView === "controlBar" && (
        <ControlBarPanel
          onBack={() => setNegocioView("menu")}
          insumos={data.insumos}
          proveedores={data.proveedores}
          onSaveInsumo={upsertInsumo}
          onRemoveInsumo={removeInsumo}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          conteosTexto={data.conteosDiariosTexto}
          onGuardarConteo={guardarConteoTexto}
          pedidosDiarios={data.pedidosDiarios}
          onGuardarPedido={guardarPedidoDiario}
          initialView={desdeInicio?.conteo ? "conteo" : "menu"}
        />
      )}

      {isOwner && activeTab === "negocio" && (negocioView === "recetarioBar" || negocioView === "recetarioCocina") && (
        <RecetarioPanel
          key={negocioView}
          onBack={() => setNegocioView("menu")}
          backLabel="Negocio"
          titulo={negocioView === "recetarioBar" ? "Recetario de Bar" : "Recetario de Cocina"}
          area={negocioView === "recetarioBar" ? "bar" : "cocina"}
          recetas={(data.recetas || []).filter((r) => r.area === (negocioView === "recetarioBar" ? "bar" : "cocina"))}
          onSave={saveReceta}
          onRemove={removeReceta}
          onSaveVarias={saveRecetas}
        />
      )}

      {isOwner && activeTab === "negocio" && negocioView === "controlCocina" && (
        <ControlCocinaPanel
          onBack={() => setNegocioView("menu")}
          insumos={data.insumos}
          proveedores={data.proveedores}
          onSaveInsumo={upsertInsumo}
          onRemoveInsumo={removeInsumo}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          conteosTexto={data.conteosDiariosTexto}
          onGuardarConteo={guardarConteoTexto}
          pedidosDiarios={data.pedidosDiarios}
          onGuardarPedido={guardarPedidoDiario}
          initialView={desdeInicio?.conteo ? "conteo" : "menu"}
        />
      )}

      {isOwner && activeTab === "negocio" && negocioView === "controlGeneral" && (
        <InsumosPanel
          onBack={() => setNegocioView("menu")}
          backLabel="Negocio"
          area="general"
          title="Control General"
          emptyIcon={<Boxes size={26} strokeWidth={1.3} />}
          emptyText="Aún no agregas insumos generales. Aquí van desechables, limpieza y lo que no sea de Bar ni Cocina."
          insumos={data.insumos.filter((i) => i.area === "general")}
          proveedores={data.proveedores}
          onSaveInsumo={upsertInsumo}
          onRemoveInsumo={removeInsumo}
        />
      )}

      {isOwner && activeTab === "negocio" && negocioView === "inventario" && (
        <InventarioNotasPanel
          onBack={() => setNegocioView("menu")}
          backLabel="Negocio"
          insumos={data.insumos}
          proveedores={data.proveedores}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={desdeInicio?.mk ?? (mostRecentMonthKey as string)}
          initialWeekIndex={desdeInicio?.wi ?? mostRecentWeekIdx}
          initialModo={desdeInicio?.modo}
          juevesSaltados={data.inventarioJuevesSaltado}
          onSaltarJueves={saltarJuevesInventario}
          onUnirInsumos={unirInsumos}
          notas={data.inventariosNotas}
          onGuardarNotas={guardarInventarioNotas}
          pedidos={data.pedidosInventario}
          onGuardarPedido={guardarPedidoInventario}
          onAsignarApodo={asignarApodoInsumo}
          onEditarProveedores={() => setModal({ type: "proveedores" })}
        />
      )}

      {isOwner && activeTab === "negocio" && negocioView === "importarCatalogo" && (
        <ImportarCatalogoPanel
          onBack={() => setNegocioView("menu")}
          insumos={data.insumos}
          proveedores={data.proveedores}
          onImportar={importarCatalogo}
        />
      )}

      {isOwner && activeTab === "negocio" && negocioView === "pedidos" && (
        <PedidosTotalPanel
          onBack={() => setNegocioView("menu")}
          insumos={data.insumos}
          proveedores={data.proveedores}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          pedidosDiarios={data.pedidosDiarios}
          pedidosInventario={data.pedidosInventario}
          pedidosCargados={data.pedidosCargados || {}}
        />
      )}

      {isOwner && activeTab === "perfil" && (
        <PerfilPanel
          nombre={data.perfilDueno?.nombre || profile.display_name || ""}
          nombreEditable
          foto={data.perfilDueno?.foto}
          descripcion={data.perfilDueno?.descripcion}
          puesto={puestoDueno?.nombre}
          area={puestoDueno ? data.areas.find((a) => a.id === puestoDueno.areaId)?.nombre : undefined}
          secciones={[]}
          etiquetaCuenta="Dueño · acceso a todo"
          arriba={
            meseroDelDueno(data, data.perfilDueno?.nombre || profile.display_name || "") ? (
              <MiRankingDueno
                data={data}
                meseroId={meseroDelDueno(data, data.perfilDueno?.nombre || profile.display_name || "")!}
                onVerRanking={() => {
                  setActiveTab("equipo");
                  setEquipoView("ranking");
                }}
              />
            ) : undefined
          }
          onGuardar={guardarPerfilDueno}
          onBack={() => goToTab("inicio")}
        >
          {!soloLectura && <NotificacionesDueno ownerId={profile.id} data={data} onGuardar={guardarConfigNotificaciones} />}
        </PerfilPanel>
      )}

      {isOwner && activeTab === "inicio" && <InicioPanel data={data} ownerId={duenoId} onIr={irDesdeInicio} />}

      {isOwner && activeTab === "dashboard" && (
        monthKeys.length > 0 ? (
          <DashboardPanel
            months={data.months}
            monthKeys={monthKeys}
            initialMonthKey={mostRecentMonthKey as string}
            initialWeekIndex={mostRecentWeekIdx}
            empleados={data.empleados}
            horarios={data.horarios}
            meseros={data.meseros}
            montosFijos={data.montosFijosSemanales}
            metaVenta={data.metaSemanal}
            onGoToNomina={() => {
              setActiveTab("equipo");
              setEquipoView("nomina");
            }}
          />
        ) : (
          <div className="page-section">
            <TituloPagina titulo="Dashboard" />
            <p className="hint">Agrega un mes desde Corte para empezar a ver tu reporte de resultados.</p>
          </div>
        )
      )}

      {(!isOwner || activeTab === "corte") && (
        <>
        {isOwner && <TituloPagina titulo="Corte" subtitulo={month?.label} />}
        {isOwner && monthKeys.length > 0 && (
          <nav className="month-scroll">
            {monthKeys.map((mk) => (
              <div key={mk} className={`month-chip ${mk === activeMonth ? "active" : ""}`}>
                <button
                  className="month-chip-label"
                  onClick={() => {
                    setActiveMonth(mk);
                    const wi = mostRecentWeekIndex(mk, data.months[mk]);
                    setActiveWeek(wi);
                    setActiveDay(mostRecentDayInWeek(mk, wi, data.months[mk]));
                  }}
                >
                  {data.months[mk].label}
                </button>
                <button className="month-chip-delete" onClick={() => setModal({ type: "deleteMonth", monthKey: mk })} aria-label={`Eliminar ${data.months[mk].label}`}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button className="month-chip-add" onClick={() => setModal({ type: "month" })} aria-label="Agregar mes">
              <Plus size={16} />
            </button>
          </nav>
        )}

        {!month || !day ? (
          isOwner ? (
            <div className="onboarding">
              <Empty
                icon={<Receipt size={34} strokeWidth={1.3} />}
                text="Aún no tienes ningún mes registrado. Agrega el mes actual para empezar a capturar tus cortes."
              />
              <button className="btn-primary" onClick={() => setModal({ type: "month" })}>
                <Plus size={17} /> Agregar mi primer mes
              </button>
            </div>
          ) : (
            <div className="full-page-msg">Preparando tu día…</div>
          )
        ) : (
          <>
            {isOwner ? (
              <>
                <div className="week-bar">
                  <nav className="week-tabs">
                    {month.weeks.map((_, i) => (
                      <button
                        key={i}
                        className={`week-tab ${i === activeWeek ? "active" : ""}`}
                        onClick={() => {
                          setActiveWeek(i);
                          if (activeMonth) setActiveDay(mostRecentDayInWeek(activeMonth, i, month));
                        }}
                      >
                        Semana {i + 1}
                      </button>
                    ))}
                  </nav>
                  <button className="icon-btn" onClick={() => setModal({ type: "weekSummary" })} aria-label="Resumen semanal">
                    <BarChart3 size={18} />
                  </button>
                  <button className="icon-btn" onClick={() => setModal({ type: "gastosSummary" })} aria-label="Resumen de gastos">
                    <Receipt size={18} />
                  </button>
                </div>
                {weekStartDate && <p className="week-range-hint">{formatWeekRange(weekStartDate)}</p>}
              </>
            ) : (
              <div className="staff-banner">
                <TituloPagina
                  titulo="Corte"
                  subtitulo="Acceso por día asignado"
                  onBack={
                    (assignments && assignments.length > 1) || (profile.permisos || []).length > 0 ? () => setSelectedAssignedDate(null) : undefined
                  }
                  backLabel="Inicio"
                />
                <span>Capturando el corte de {selectedAssignedDate && formatAssignedDate(selectedAssignedDate)}</span>
              </div>
            )}

            {isOwner && week && month && activeMonth && (
              <nav className="day-scroll">
                {DAYS.map((d) => {
                  const hasData = week.days[d].meseros.length > 0;
                  const dDate = dateForDay(activeMonth, activeWeek, month, d);
                  return (
                    <button key={d} className={`day-chip ${d === activeDay ? "active" : ""}`} onClick={() => setActiveDay(d)}>
                      {hasData ? <CircleDot size={9} /> : <Circle size={9} />}
                      {DAY_SHORT[d]} <span className="day-chip-date">{formatDayNumber(dDate)}</span>
                    </button>
                  );
                })}
              </nav>
            )}

            {isOwner && activeDayDate && <p className="active-day-date">{formatLongDayDate(activeDayDate)}</p>}

            {isOwner && day && (
              <div className="asignado-actual">
                <span>
                  {day.asignadoA ? (
                    <>
                      Asignado a <strong>{day.asignadoA.nombre}</strong>
                    </>
                  ) : (
                    "Sin asignar"
                  )}
                  {day.hechoPor && (
                    <>
                      {" "}
                      · Corte hecho por <strong>{day.hechoPor.nombre}</strong>
                    </>
                  )}
                </span>
                <button className="link-btn" onClick={() => setModal({ type: "asignarDia" })}>
                  {day.asignadoA ? "Cambiar" : "Asignar día"}
                </button>
              </div>
            )}
            {isOwner && day && activeDayDate && (
              <button className="link-btn historial-dia-btn" onClick={() => setHistorialDia(activeDayDate)}>
                <History size={15} /> Historial de este día{cambiosDelDia > 0 ? ` (${cambiosDelDia} ${cambiosDelDia === 1 ? "cambio" : "cambios"})` : ""}
              </button>
            )}

            {day?.corteGuardado && (
              <div className={`corte-guardado ${isOwner ? "dueno" : ""}`}>
                <Lock size={15} />
                <span>
                  <strong>Corte guardado</strong> por {day.corteGuardado.nombre} el {fechaHoraCorta(day.corteGuardado.fecha)}.
                  {!isOwner && " Ya no se puede editar. Si algo está mal, avísale al dueño."}
                </span>
              </div>
            )}

            {turnosDelDia && day && !day.apertura && !day.corteGuardado && (
              <div className="apertura-aviso">
                <span>
                  {abrenHoy.length > 0 ? (
                    <>
                      Hoy abre: <strong>{abrenHoy.map((x) => x.nombre).join(", ")}</strong>{" "}
                      <small>({abrenHoy.map((x) => x.marca).join(", ")} en el horario)</small>
                    </>
                  ) : (
                    "Nadie tiene X ni Z hoy en el horario."
                  )}
                </span>
                <button className="btn-primary" onClick={() => setModal({ type: "apertura" })}>
                  Corte de apertura
                </button>
              </div>
            )}

            {turnosDelDia && day?.apertura && (
              <div className="medio-turno-banner">
                <Lock size={15} />
                <span>
                  <strong>Corte de apertura</strong>
                  {day.apertura.abrio ? ` (abrió ${day.apertura.abrio.nombre})` : ""} guardado por {day.apertura.nombre} el{" "}
                  {fechaHoraCorta(day.apertura.fecha)}.
                  {isOwner ? (
                    <>
                      {" "}El personal ya no lo puede cambiar.{" "}
                      <button className="link-btn" onClick={() => setModal({ type: "quitarApertura" })}>
                        Desbloquear apertura
                      </button>
                    </>
                  ) : (
                    " Ya no se puede editar."
                  )}
                </span>
              </div>
            )}

            {turnosDelDia &&
              day &&
              acumuladosDelDia(day).map((a) => (
                <div key={a.meseroId} className="acumulado-dia">
                  <span>
                    {a.nombre} del día <small>({a.cortes} {a.cortes === 1 ? "corte" : "cortes"})</small>
                  </span>
                  <span>
                    <strong>{money(a.lectura)}</strong> <small>debe coincidir con el sistema</small>
                  </span>
                </div>
              ))}
            {turnosDelDia && day?.apertura && (
              <div className="acumulado-dia">
                <span>
                  Apps del día <small>(apertura {money(day.apertura.ventaApps)})</small>
                </span>
                <span>
                  <strong>{money(day.ventaApps || 0)}</strong> <small>al cierre, escribe el total del día</small>
                </span>
              </div>
            )}

            {totals && (
              <section className="summary">
                <div className="summary-item highlight">
                  <span>Venta total</span>
                  <strong>{money(totals.ventaTotal)}</strong>
                </div>
                <div className="summary-item">
                  <span>Venta local</span>
                  <strong>{money(totals.ventaLocal)}</strong>
                </div>
                <div className="summary-item">
                  <span>Venta apps</span>
                  <strong>{money(totals.ventaApps)}</strong>
                </div>
                <div className="summary-item highlight">
                  <span>Tarjetas</span>
                  <strong>{money(totals.tarjetas)}</strong>
                </div>
                <div className="summary-item highlight">
                  <span>Transferencias</span>
                  <strong>{money(totals.transferencias)}</strong>
                </div>
                <div className="summary-item">
                  <span>Propinas</span>
                  <strong>{money(totals.propina)}</strong>
                </div>
                <div className="summary-item">
                  <span>Gastos</span>
                  <strong>{money(totals.gastos)}</strong>
                </div>
                {!efectivoDia && (
                  <div className="summary-item highlight" style={{ gridColumn: "1 / -1" }}>
                    <span>
                      Efectivo a entregar <em>(sin propinas)</em>
                    </span>
                    <strong>{money(totals.efectivo)}</strong>
                  </div>
                )}
              </section>
            )}

            {efectivoDia && day && (
              <section className="efectivo-dia">
                <h4>Efectivo del día</h4>
                {efectivoDia.tieneApertura && (
                  <div className="efectivo-fila info">
                    <span>Efectivo de la apertura (ya entregado al dueño)</span>
                    <span>{money(efectivoDia.aperturaEf)}</span>
                  </div>
                )}
                <div className="efectivo-fila">
                  <span>{efectivoDia.tieneApertura ? "Efectivo del resto del día" : "Efectivo de las ventas"} (sin propinas)</span>
                  <strong>{money(efectivoDia.resto)}</strong>
                </div>
                {efectivoDia.dejadoAyer > 0 && (
                  <div className="efectivo-fila">
                    <span>+ Se dejó el día anterior{efectivoDia.ayer?.nota ? ` (${efectivoDia.ayer.nota})` : ""}</span>
                    <strong>+{money(efectivoDia.dejadoAyer)}</strong>
                  </div>
                )}
                {efectivoDia.dejadoHoy > 0 && (
                  <div className="efectivo-fila menos">
                    <span>− Se deja en el restaurante{day.efectivoDejado?.nota ? ` (${day.efectivoDejado.nota})` : ""}</span>
                    <strong>−{money(efectivoDia.dejadoHoy)}</strong>
                  </div>
                )}
                <div className="efectivo-fila total">
                  <span>Efectivo a entregar{efectivoDia.tieneApertura ? " en la noche" : ""}</span>
                  <span>{money(efectivoDia.entregar)}</span>
                </div>
                {efectivoDia.tieneApertura && (
                  <div className="efectivo-fila info">
                    <span>Total de efectivo del día (apertura + noche)</span>
                    <span>{money(efectivoDia.totalDia)}</span>
                  </div>
                )}
                {!corteBloqueado && (
                  <button className="link-btn" onClick={() => setModal({ type: "dejarEfectivo" })}>
                    {day.efectivoDejado ? "Cambiar el efectivo que se deja" : "+ Dejar efectivo para el día siguiente"}
                  </button>
                )}
              </section>
            )}

            <button className="apps-row" onClick={() => setModal({ type: "apps" })} disabled={corteBloqueado}>
              <span className="apps-row-label">
                <Smartphone size={15} /> Ventas de apps <em>(no suma al efectivo)</em>
              </span>
              <span className="apps-row-value">
                {money(day.ventaApps || 0)} <Pencil size={13} />
              </span>
            </button>

            <main className="content">
              <section className="block">
                <div className="block-head">
                  <h2>
                    <Users size={17} /> Meseros
                  </h2>
                  {!corteBloqueado && (
                    <button className="icon-btn accent" onClick={() => setModal({ type: "mesero" })}>
                      <Plus size={18} />
                    </button>
                  )}
                </div>
                {day.meseros.length === 0 ? (
                  <Empty icon={<Users size={26} strokeWidth={1.3} />} text="Sin cortes capturados este día. Toca + para agregar el primero." />
                ) : (
                  (() => {
                    // Número de corte de cada usuario acumulado ("Para llevar · Corte 2").
                    const numCorte: Record<string, number> = {};
                    const cuenta: Record<string, number> = {};
                    day.meseros.forEach((m) => {
                      if (m.lecturaSistema === undefined) return;
                      cuenta[m.meseroId] = (cuenta[m.meseroId] || 0) + 1;
                      numCorte[m.id] = cuenta[m.meseroId];
                    });
                    const tarjeta = (m: MeseroCut) => {
                      const bloq = bloqueadoMedioTurno(m.id);
                      return (
                        <button
                          key={m.id}
                          className={`card mesero-card${bloq ? " bloqueado-mt" : ""}`}
                          onClick={() => setModal({ type: "mesero", editing: m })}
                          disabled={corteBloqueado || bloq}
                        >
                          <div className="card-top">
                            <span className="card-name">
                              {m.nombre}
                              {numCorte[m.id] && <span className="tag-corte">Corte {numCorte[m.id]}</span>}
                            </span>
                            <span className="card-total">{money(m.total)}</span>
                          </div>
                          <div className="card-sub">
                            {m.cobro && <span>Cobró: {m.cobro}</span>}
                            {m.lecturaSistema !== undefined && <span>Sistema: {money(m.lecturaSistema)}</span>}
                            <span>Venta {money(m.venta)}</span>
                            <span>Tarjetas {money(m.tarjetas)}</span>
                            {m.transferencia > 0 && <span>Transferencia {money(m.transferencia)}</span>}
                            {m.gastosTotal > 0 && <span>Gastos {money(m.gastosTotal)}</span>}
                          </div>
                        </button>
                      );
                    };
                    const ap = day.apertura;
                    if (!turnosDelDia || !ap) return <div className="card-list">{day.meseros.map(tarjeta)}</div>;
                    const turno1 = day.meseros.filter((m) => ap.ids.includes(m.id));
                    const turno2 = day.meseros.filter((m) => !ap.ids.includes(m.id));
                    const hora = new Date(ap.fecha).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
                    return (
                      <>
                        <div className="turno-titulo">
                          <span>Apertura · hasta {hora}</span>
                          <Lock size={13} />
                        </div>
                        <div className="card-list">
                          {turno1.map(tarjeta)}
                          <div className="card mesero-card bloqueado-mt">
                            <div className="card-top">
                              <span className="card-name">Apps</span>
                              <span className="card-total">{money(ap.ventaApps)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="turno-titulo">
                          <span>Resto del día</span>
                        </div>
                        {turno2.length === 0 ? (
                          <p className="hint">Aún no hay cortes después de la apertura. Al cierre, agrega el de {turno1.map((m) => m.nombre).join(" y ")} con el total del día.</p>
                        ) : (
                          <div className="card-list">{turno2.map(tarjeta)}</div>
                        )}
                      </>
                    );
                  })()
                )}
              </section>

              <section className="block">
                <div className="block-head">
                  <h2>
                    <Receipt size={17} /> Gastos
                  </h2>
                  {!corteBloqueado && (
                    <button className="icon-btn accent" onClick={() => setModal({ type: "gasto" })}>
                      <Plus size={18} />
                    </button>
                  )}
                </div>
                {day.gastos.length === 0 ? (
                  <Empty icon={<Receipt size={26} strokeWidth={1.3} />} text="No hay gastos registrados este día." />
                ) : (
                  <div className="card-list">
                    {day.gastos.map((g) => (
                      <div key={g.id} className="card gasto-card">
                        <button className="gasto-main" onClick={() => setModal({ type: "gasto", editing: g })} disabled={corteBloqueado || bloqueadoMedioTurno(g.id)}>
                          <div className="card-top">
                            <span className="card-name">{g.concepto}</span>
                            <span className="card-total">{money(g.total)}</span>
                          </div>
                          {g.origen === "mesero" && <span className="card-tag">Desde corte de {g.meseroNombre}</span>}
                          {g.empleadoId && (
                            <span className="card-tag">
                              Descuento a {data.empleados.find((e) => e.id === g.empleadoId)?.nombre || "empleado eliminado"}
                            </span>
                          )}
                          {g.meseroId && (
                            <span className="card-tag">
                              Cancelación a {data.meseros.find((m) => m.id === g.meseroId)?.nombre || "mesero eliminado"}
                            </span>
                          )}
                        </button>
                        <button
                          className={`estado-chip ${g.estado}`}
                          disabled={corteBloqueado || bloqueadoMedioTurno(g.id) || (g.estado === "pendiente" && !g.categoria)}
                          onClick={() => toggleGastoEstado(g.id)}
                        >
                          {g.estado === "pendiente" ? "Confirmar" : "Ingresado"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="block">
                <div className="block-head">
                  <h2>
                    <ArrowLeftRight size={17} /> Transferencias
                  </h2>
                  {!corteBloqueado && (
                    <button className="icon-btn accent" onClick={() => setModal({ type: "transfer" })}>
                      <Plus size={18} />
                    </button>
                  )}
                </div>
                {day.transferencias.length === 0 ? (
                  <Empty icon={<ArrowLeftRight size={26} strokeWidth={1.3} />} text="No hay transferencias registradas este día." />
                ) : (
                  <div className="card-list">
                    {day.transferencias.map((t) => (
                      <button key={t.id} className="card" onClick={() => setModal({ type: "transfer", editing: t })} disabled={corteBloqueado || bloqueadoMedioTurno(t.id)}>
                        <div className="card-top">
                          <span className="card-name">{t.persona}</span>
                          <span className="card-total">{money(t.total)}</span>
                        </div>
                        {t.origen === "mesero" && <span className="card-tag">Desde su corte</span>}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {!day.corteGuardado ? (
                <div className="guardar-corte">
                  <button className="btn-primary" onClick={() => setModal({ type: "guardarCorte" })}>
                    <Lock size={16} /> Guardar corte
                  </button>
                  <p className="hint">Al guardarlo ya no se podrá editar.</p>
                </div>
              ) : (
                isOwner && (
                  <p className="hint guardar-corte-dueno">
                    Tú lo puedes seguir editando. Si quieres que la persona lo corrija, toca{" "}
                    <button className="link-btn" onClick={() => setModal({ type: "reabrirCorte" })}>
                      Reabrir corte
                    </button>
                    .
                  </p>
                )
              )}
            </main>
          </>
        )}
      </>
      )}

      {!modal && (
        <button
          type="button"
          className={`preguntas-fab ${isOwner ? "" : "sin-barra"}`}
          onClick={() => setPreguntasAbierto(true)}
          aria-label="Pregúntale a Cortes"
        >
          <MessageCircle size={24} />
        </button>
      )}
      {preguntasAbierto && (
        <PreguntasSheet
          data={data}
          profile={profile}
          contexto={isOwner ? null : contextoEquipo(profile, data, assignments || [])}
          onClose={() => setPreguntasAbierto(false)}
          onIr={(destino) => {
            setPreguntasAbierto(false);
            if (!isOwner) {
              // Personal en su corte: a otro de sus días, o de regreso a su
              // inicio en la sección de la respuesta.
              if (destino.tipo === "dia") setSelectedAssignedDate(destino.fecha);
              else if (destino.tipo === "seccion") {
                setStaffVista(destino.seccion);
                setSelectedAssignedDate(null);
              }
              return;
            }
            if (destino.tipo === "dashboard") goToTab("dashboard");
            else if (destino.tipo === "ranking") {
              goToTab("equipo");
              setEquipoView("ranking");
            } else if (destino.tipo === "propinas") {
              goToTab("equipo");
              setEquipoView("propinas");
            } else if (destino.tipo === "seccion") {
              goToTab("negocio");
              setNegocioView("recetarioBar");
            } else irDesdeInicio(destino);
          }}
        />
      )}

      {isOwner && (
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            <button className={`bottom-nav-item ${activeTab === "inicio" ? "active" : ""}`} onClick={() => goToTab("inicio")}>
              <Home size={20} />
              <span>Inicio</span>
            </button>
            <button className={`bottom-nav-item ${activeTab === "corte" ? "active" : ""}`} onClick={() => goToTab("corte")}>
              <Receipt size={20} />
              <span>Corte</span>
            </button>
            <button className={`bottom-nav-item ${activeTab === "equipo" ? "active" : ""}`} onClick={() => goToTab("equipo")}>
              <Users size={20} />
              <span>Equipo</span>
            </button>
            <button className={`bottom-nav-item ${activeTab === "negocio" ? "active" : ""}`} onClick={() => goToTab("negocio")}>
              <Store size={20} />
              <span>Negocio</span>
            </button>
            <button className={`bottom-nav-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => goToTab("dashboard")}>
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </button>
          </div>
        </nav>
      )}

      {modal?.type === "month" && <MonthModal onClose={() => setModal(null)} onSave={addMonth} existing={monthKeys} />}
      {modal?.type === "mesero" && day && (
        <MeseroModal
          onClose={() => setModal(null)}
          onSave={saveMeseroCut}
          onDelete={modal.editing ? () => deleteMeseroCut((modal.editing as MeseroCut).id) : undefined}
          editing={modal.editing}
          catalog={data.meseros}
          existingGastos={modal.editing ? day.gastos.filter((g) => g.meseroCutId === (modal.editing as MeseroCut).id) : []}
          historial={historialGastos}
          cortesDelDia={day.meseros}
          turnos={turnosDelDia}
        />
      )}
      {modal?.type === "gasto" && (
        <GastoModal
          onClose={() => setModal(null)}
          onSave={saveGasto}
          onDelete={modal.editing ? () => deleteGasto((modal.editing as Gasto).id) : undefined}
          editing={modal.editing}
          empleados={data.empleados}
          meseros={data.meseros}
          historial={historialGastos}
        />
      )}
      {modal?.type === "transfer" && (
        <TransferModal
          onClose={() => setModal(null)}
          onSave={saveTransfer}
          onDelete={modal.editing ? () => deleteTransfer((modal.editing as Transferencia).id) : undefined}
          editing={modal.editing}
          catalog={data.meseros}
        />
      )}
      {historialDia && <HistorialDiaSheet ownerId={duenoId} fecha={historialDia} onClose={() => setHistorialDia(null)} />}
      {modal?.type === "guardarCorte" && day && totals && (
        <GuardarCorteModal day={day} totals={totals} onGuardar={guardarCorte} onClose={() => setModal(null)} />
      )}
      {modal?.type === "apertura" && (
        <AperturaModal
          onClose={() => setModal(null)}
          onGuardar={guardarApertura}
          catalog={data.meseros}
          empleados={data.empleados}
          abren={abrenHoy}
          historial={historialGastos}
          dejadoAyer={efectivoDia?.ayer}
        />
      )}
      {modal?.type === "dejarEfectivo" && day && (
        <DejarEfectivoModal
          inicial={day.efectivoDejado}
          onGuardar={guardarEfectivoDejado}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "quitarApertura" && (
        <Sheet title="Desbloquear apertura" onClose={() => setModal(null)}>
          <p className="hint">
            Los cortes de la apertura se quedan, pero el personal los podrá editar y la lista vuelve a verse en un solo bloque.
          </p>
          <button className="btn-primary" onClick={quitarApertura}>
            Sí, desbloquear
          </button>
          <button className="link-btn" onClick={() => setModal(null)}>
            Cancelar
          </button>
        </Sheet>
      )}
      {modal?.type === "reabrirCorte" && (
        <Sheet title="Reabrir corte" onClose={() => setModal(null)}>
          <p className="hint">
            El corte se desbloquea para quien lo tiene asignado: lo podrá corregir y tendrá que volver a tocar
            "Guardar corte".
          </p>
          <button className="btn-primary" onClick={reabrirCorte}>
            Sí, reabrir corte
          </button>
          <button className="link-btn" onClick={() => setModal(null)}>
            Cancelar
          </button>
        </Sheet>
      )}
      {modal?.type === "apps" && day && <AppsModal onClose={() => setModal(null)} onSave={saveVentaApps} value={day.ventaApps || 0} desglose={day.ventaAppsDesglose} />}
      {modal?.type === "weekSummary" && month && activeMonth && (
        <WeekSummaryModal
          onClose={() => setModal(null)}
          week={month.weeks[activeWeek]}
          month={month}
          weekLabel={`Semana ${activeWeek + 1} · ${month.label}`}
          monthKey={activeMonth}
          weekIndex={activeWeek}
          onSaveEfectivoReal={saveEfectivoReal}
          onSaveStartDate={saveWeekStartDate}
        />
      )}
      {modal?.type === "gastosSummary" && monthKeys.length > 0 && (
        <GastosSummaryModal
          onClose={() => setModal(null)}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          onToggleEstado={toggleGastoEstadoInWeek}
          onSetCategoria={setGastoCategoriaInWeek}
          onMoverGasto={moverGastoEnSemana}
          onEditarGasto={editarGastoEnSemana}
          onAgregarGasto={agregarGastoEnSemana}
          empleados={data.empleados}
          meseros={data.meseros}
          historial={historialGastos}
        />
      )}
      {modal?.type === "creditoProveedores" && monthKeys.length > 0 && (
        <CreditoProveedoresModal
          onClose={() => setModal(null)}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          montosFijos={data.montosFijosSemanales}
          onSave={saveCreditoProveedores}
        />
      )}
      {modal?.type === "catalog" && (
        <CatalogModal onClose={() => setModal(null)} meseros={data.meseros} onSave={upsertMesero} onRemove={removeMeseroFromCatalog} />
      )}
      {modal?.type === "proveedores" && (
        <ProveedoresModal
          onClose={() => setModal(null)}
          proveedores={data.proveedores}
          insumos={data.insumos}
          onSave={addProveedor}
          onToggleJueves={toggleProveedorJueves}
          onRemove={removeProveedor}
          onUnir={unirProveedores}
        />
      )}
      {modal?.type === "asignarDia" && day && activeDayDate && (
        <AsignarDiaModal
          onClose={() => setModal(null)}
          fechaLabel={formatAssignedDate(activeDayDate)}
          empleados={data.empleados}
          asignadoA={day.asignadoA}
          hechoPor={day.hechoPor}
          onAsignar={assignDay}
          onQuitar={unassignDay}
        />
      )}
      {modal?.type === "empleado" && (
        <EmpleadoModal
          onClose={() => setModal(null)}
          onSave={upsertEmpleado}
          onDelete={modal.editing ? () => removeEmpleado((modal.editing as EmpleadoEntry).id) : undefined}
          editing={modal.editing}
          areas={data.areas}
          puestos={data.puestos}
          ownerId={duenoId}
          datosPago={modal.editing ? pagoDeEmpleado((modal.editing as EmpleadoEntry).id) : null}
        />
      )}
      {modal?.type === "deleteMonth" && (
        <DeleteMonthModal
          onClose={() => setModal(null)}
          onConfirm={() => deleteMonth(modal.monthKey)}
          monthLabel={data.months[modal.monthKey]?.label || modal.monthKey}
        />
      )}
    </div>
  );
}

// "20 oct a las 11:42 p.m."
function fechaHoraCorta(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(".", "")} a las ${d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}`;
}

// Efectivo que se deja en el restaurante para el día siguiente (ej. para
// pagar hielo): sale del corte de este día y entra solo al del siguiente.
function DejarEfectivoModal({
  inicial,
  onGuardar,
  onClose,
}: {
  inicial?: { monto: number; nota?: string };
  onGuardar: (monto: number, nota: string) => void;
  onClose: () => void;
}) {
  const [monto, setMonto] = useState(inicial ? String(inicial.monto) : "");
  const [nota, setNota] = useState(inicial?.nota || "");
  return (
    <Sheet title="Dejar efectivo para el día siguiente" onClose={onClose}>
      <p className="hint">
        Se resta del efectivo a entregar de hoy y se suma solo al del día siguiente. Lo que se pague con ese dinero se registra
        en Gastos de ese día (no dentro del corte de apertura).
      </p>
      <Field label="Monto que se deja">
        <NumInput value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="¿Para qué? (opcional)">
        <input className="text-input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. para hielo, retiro del dueño" />
      </Field>
      <button className="btn-primary" onClick={() => onGuardar(parseFloat(monto) || 0, nota)}>
        Guardar
      </button>
      {inicial && (
        <button className="btn-delete" onClick={() => onGuardar(0, "")}>
          Ya no se deja efectivo
        </button>
      )}
    </Sheet>
  );
}
