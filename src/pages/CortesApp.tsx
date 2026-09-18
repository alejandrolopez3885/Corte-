import { useEffect, useRef, useState } from "react";
import {
  Plus, Settings2, Users, Receipt, ArrowLeftRight, CircleDot, Circle, Pencil,
  Smartphone, BarChart3, LogOut, Truck, Trash2, Home, Store, LayoutDashboard,
} from "lucide-react";
import { useAuth } from "../lib/auth.tsx";
import { useAppData } from "../lib/useAppData";
import {
  addDaysIso, buildMonth, dateForDay, formatAssignedDate, formatDayNumber, formatLongDayDate, formatWeekRange,
  mondayOnOrBefore, money, mostRecentDayInWeek, mostRecentWeekIndex, resolveAssignmentLocation, resolveWeekStartDate,
  round2, sumFromText, todayIso, uid,
} from "../lib/dataModel";
import { useStaffAssignments } from "../lib/staffAssignments";
import { DAYS, DAY_SHORT } from "../lib/types";
import type { CreditoProveedores, DayData, DayName, EmpleadoEntry, Gasto, GastoCategoria, MeseroCatalogEntry, MeseroCut, Profile, Transferencia, WeekData } from "../lib/types";
import { Empty } from "../components/ui";
import { MonthModal } from "../components/modals/MonthModal";
import { MeseroModal, type MeseroFormValues } from "../components/modals/MeseroModal";
import { GastoModal, type GastoFormValues } from "../components/modals/GastoModal";
import { TransferModal, type TransferFormValues } from "../components/modals/TransferModal";
import { CreditoProveedoresModal } from "../components/modals/CreditoProveedoresModal";
import { CatalogModal } from "../components/modals/CatalogModal";
import { AppsModal } from "../components/modals/AppsModal";
import { WeekSummaryModal } from "../components/modals/WeekSummaryModal";
import { GastosSummaryModal } from "../components/modals/GastosSummaryModal";
import { DeleteMonthModal } from "../components/modals/DeleteMonthModal";
import { TeamPanel } from "../components/panels/TeamPanel";
import { EmpleadosPanel } from "../components/panels/EmpleadosPanel";
import { DashboardPanel } from "../components/panels/DashboardPanel";

type ModalState =
  | { type: "month" }
  | { type: "mesero"; editing?: MeseroCut }
  | { type: "gasto"; editing?: Gasto }
  | { type: "transfer"; editing?: Transferencia }
  | { type: "apps" }
  | { type: "weekSummary" }
  | { type: "gastosSummary" }
  | { type: "creditoProveedores" }
  | { type: "catalog" }
  | { type: "deleteMonth"; monthKey: string }
  | null;

type OwnerTab = "corte" | "equipo" | "negocio" | "dashboard";

export default function CortesApp({ profile }: { profile: Profile }) {
  const { signOut } = useAuth();

  const isOwner = profile.role === "owner";
  const { data, status, saveState, persist } = useAppData(profile);

  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [activeDay, setActiveDay] = useState<DayName>("Lunes");
  const [activeTab, setActiveTab] = useState<OwnerTab>("corte");
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedAssignedDate, setSelectedAssignedDate] = useState<string | null>(null);

  const ownerInitialized = useRef(false);
  const locatedForDate = useRef<string | null>(null);
  const { assignments, status: assignmentsStatus } = useStaffAssignments(isOwner ? null : profile.id);

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
    if (assignmentsStatus === "loading" || assignments === null) {
      return (
        <div className="app-shell">
          <div className="loading">Cargando tus días asignados…</div>
        </div>
      );
    }
    if (assignmentsStatus === "error") {
      return (
        <div className="app-shell">
          <div className="full-page-msg">No se pudieron cargar tus días asignados. Intenta recargar la página.</div>
        </div>
      );
    }
    if (assignments.length === 0) {
      return (
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark">Cortes</span>
            </div>
            <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </header>
          <div className="full-page-msg">No tienes días asignados para hacer corte. Pide al encargado que te asigne uno.</div>
        </div>
      );
    }
    const stillValid = selectedAssignedDate && assignments.some((a) => a.assigned_date === selectedAssignedDate);
    if (selectedAssignedDate && !stillValid) {
      return (
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark">Cortes</span>
            </div>
            <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </header>
          <div className="full-page-msg">Ya no tienes acceso a este día. Si fue un error, pide al encargado que te lo asigne de nuevo.</div>
          <div style={{ padding: "0 20px" }}>
            <button className="btn-primary" onClick={() => setSelectedAssignedDate(null)}>
              Ver mis días asignados
            </button>
          </div>
        </div>
      );
    }
    if (!selectedAssignedDate) {
      return (
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark">Cortes</span>
            </div>
            <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </header>
          <div style={{ padding: "8px 20px" }}>
            <p className="hint">Toca el día que vas a capturar:</p>
            <div className="staff-name-grid">
              {assignments.map((a) => (
                <button key={a.id} className="staff-name-btn" onClick={() => setSelectedAssignedDate(a.assigned_date)}>
                  {formatAssignedDate(a.assigned_date)}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }
  }

  const monthKeys = Object.keys(data.months).sort();
  const month = activeMonth ? data.months[activeMonth] : null;
  const day: DayData | null = month ? month.weeks[activeWeek].days[activeDay] : null;
  const week = month ? month.weeks[activeWeek] : null;
  const weekStartDate = activeMonth && month ? resolveWeekStartDate(activeMonth, activeWeek, month) : null;
  const activeDayDate = activeMonth && month ? dateForDay(activeMonth, activeWeek, month, activeDay) : null;

  // Mes/semana más reciente del negocio, sin depender de qué esté viendo
  // el dueño en la pestaña Corte — para que Negocio y Dashboard siempre
  // arranquen en la semana más relevante, aunque se hayan abierto directo.
  const mostRecentMonthKey = monthKeys.length > 0 ? monthKeys[monthKeys.length - 1] : null;
  const mostRecentWeekIdx = mostRecentMonthKey ? mostRecentWeekIndex(mostRecentMonthKey, data.months[mostRecentMonthKey]) : 0;

  function updateDay(mutator: (d: DayData) => void) {
    if (!data || !activeMonth) return;
    const next = structuredClone(data);
    const d = next.months[activeMonth].weeks[activeWeek].days[activeDay];
    mutator(d);
    persist(next);
  }

  function updateWeek(mutator: (w: WeekData) => void) {
    if (!data || !activeMonth) return;
    const next = structuredClone(data);
    const w = next.months[activeMonth].weeks[activeWeek];
    mutator(w);
    persist(next);
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
  // solo para el corte.
  function upsertEmpleado(entry: EmpleadoEntry) {
    if (!data) return;
    const next = structuredClone(data);
    const idx = next.empleados.findIndex((e) => e.id === entry.id);
    if (idx >= 0) next.empleados[idx] = entry;
    else next.empleados.push(entry);
    persist(next);
  }

  function removeEmpleado(id: string) {
    if (!data) return;
    const next = structuredClone(data);
    next.empleados = next.empleados.filter((e) => e.id !== id);
    persist(next);
  }

  function saveMeseroCut(form: MeseroFormValues, editingId?: string) {
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
        });
      }
    });
    setModal(null);
  }

  function deleteMeseroCut(id: string) {
    updateDay((d) => {
      d.meseros = d.meseros.filter((m) => m.id !== id);
      d.transferencias = d.transferencias.filter((t) => t.meseroCutId !== id);
    });
    setModal(null);
  }

  function saveGasto(form: GastoFormValues, editingId?: string) {
    updateDay((d) => {
      const entry: Gasto = {
        id: editingId || uid(),
        concepto: form.concepto,
        total: parseFloat(form.total) || 0,
        estado: form.estado,
        origen: "manual",
        categoria: form.categoria || undefined,
      };
      if (editingId) {
        const i = d.gastos.findIndex((g) => g.id === editingId);
        d.gastos[i] = { ...d.gastos[i], ...entry };
      } else d.gastos.push(entry);
    });
    setModal(null);
  }

  function toggleGastoEstado(id: string) {
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

  function deleteGasto(id: string) {
    updateDay((d) => {
      d.gastos = d.gastos.filter((g) => g.id !== id);
    });
    setModal(null);
  }

  function saveTransfer(form: TransferFormValues, editingId?: string) {
    updateDay((d) => {
      const entry = { id: editingId || uid(), persona: form.persona, total: parseFloat(form.total) || 0 };
      if (editingId) {
        const i = d.transferencias.findIndex((t) => t.id === editingId);
        d.transferencias[i] = entry;
      } else d.transferencias.push(entry);
    });
    setModal(null);
  }

  function deleteTransfer(id: string) {
    updateDay((d) => {
      d.transferencias = d.transferencias.filter((t) => t.id !== id);
    });
    setModal(null);
  }

  // Control (solo informativo) de gastos que los proveedores dan a crédito,
  // pagados después por transferencia — vive por semana, igual que
  // efectivoReal, pero no afecta ningún total de caja del corte.
  function saveCreditoProveedores(monthKey: string, weekIndex: number, values: CreditoProveedores) {
    if (!data) return;
    const next = structuredClone(data);
    next.months[monthKey].weeks[weekIndex].creditoProveedores = values;
    persist(next);
  }

  // Nómina del reporte del Dashboard — capturada a mano por ahora, sin
  // generador de nómina todavía.
  function saveNominaManual(monthKey: string, weekIndex: number, value: number) {
    if (!data) return;
    const next = structuredClone(data);
    next.months[monthKey].weeks[weekIndex].nominaManual = value;
    persist(next);
  }

  function saveVentaApps(rawValue: string) {
    updateDay((d) => {
      d.ventaApps = sumFromText(rawValue);
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

  return (
    <div className={`app-shell ${isOwner ? "with-bottom-nav" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Cortes</span>
          {isOwner && activeTab === "corte" && month && <span className="brand-month">{month.label}</span>}
          {!isOwner && <span className="brand-role">Acceso por día asignado</span>}
        </div>
        <div className="topbar-actions">
          {saveState === "error" && <span className="save-badge error">No se guardó</span>}
          {saveState === "saving" && <span className="save-badge">Guardando…</span>}
          <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {isOwner && activeTab === "equipo" && (
        <>
          <TeamPanel ownerId={profile.id} />
          <EmpleadosPanel empleados={data.empleados} onSave={upsertEmpleado} onRemove={removeEmpleado} />
        </>
      )}

      {isOwner && activeTab === "negocio" && (
        <div className="page-section">
          <h2 className="page-title">Negocio</h2>
          <div className="menu-list">
            <button className="menu-item" onClick={() => setModal({ type: "catalog" })}>
              <span className="menu-item-icon">
                <Settings2 size={20} />
              </span>
              <span className="menu-item-text">
                <strong>Meseros</strong>
                <span>Catálogo de meseros para el corte</span>
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
        </div>
      )}

      {isOwner && activeTab === "dashboard" && (
        monthKeys.length > 0 ? (
          <DashboardPanel
            months={data.months}
            monthKeys={monthKeys}
            initialMonthKey={mostRecentMonthKey as string}
            initialWeekIndex={mostRecentWeekIdx}
            onSaveNomina={saveNominaManual}
          />
        ) : (
          <div className="page-section">
            <h2 className="page-title">Dashboard</h2>
            <p className="hint">Agrega un mes desde Corte para empezar a ver tu reporte de resultados.</p>
          </div>
        )
      )}

      {(!isOwner || activeTab === "corte") && (
        <>
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
                <span>Capturando el corte de {selectedAssignedDate && formatAssignedDate(selectedAssignedDate)}</span>
                {assignments && assignments.length > 1 && (
                  <button className="link-btn" onClick={() => setSelectedAssignedDate(null)}>
                    Cambiar día
                  </button>
                )}
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
                <div className="summary-item highlight" style={{ gridColumn: "1 / -1" }}>
                  <span>
                    Efectivo a entregar <em>(sin propinas)</em>
                  </span>
                  <strong>{money(totals.efectivo)}</strong>
                </div>
              </section>
            )}

            <button className="apps-row" onClick={() => setModal({ type: "apps" })}>
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
                  <button className="icon-btn accent" onClick={() => setModal({ type: "mesero" })}>
                    <Plus size={18} />
                  </button>
                </div>
                {day.meseros.length === 0 ? (
                  <Empty icon={<Users size={26} strokeWidth={1.3} />} text="Sin cortes capturados este día. Toca + para agregar el primero." />
                ) : (
                  <div className="card-list">
                    {day.meseros.map((m) => (
                      <button key={m.id} className="card mesero-card" onClick={() => setModal({ type: "mesero", editing: m })}>
                        <div className="card-top">
                          <span className="card-name">{m.nombre}</span>
                          <span className="card-total">{money(m.total)}</span>
                        </div>
                        <div className="card-sub">
                          <span>Venta {money(m.venta)}</span>
                          <span>Tarjetas {money(m.tarjetas)}</span>
                          {m.transferencia > 0 && <span>Transferencia {money(m.transferencia)}</span>}
                          {m.gastosTotal > 0 && <span>Gastos {money(m.gastosTotal)}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="block">
                <div className="block-head">
                  <h2>
                    <Receipt size={17} /> Gastos
                  </h2>
                  <button className="icon-btn accent" onClick={() => setModal({ type: "gasto" })}>
                    <Plus size={18} />
                  </button>
                </div>
                {day.gastos.length === 0 ? (
                  <Empty icon={<Receipt size={26} strokeWidth={1.3} />} text="No hay gastos registrados este día." />
                ) : (
                  <div className="card-list">
                    {day.gastos.map((g) => (
                      <div key={g.id} className="card gasto-card">
                        <button className="gasto-main" onClick={() => setModal({ type: "gasto", editing: g })}>
                          <div className="card-top">
                            <span className="card-name">{g.concepto}</span>
                            <span className="card-total">{money(g.total)}</span>
                          </div>
                          {g.origen === "mesero" && <span className="card-tag">Desde corte de {g.meseroNombre}</span>}
                        </button>
                        <button
                          className={`estado-chip ${g.estado}`}
                          disabled={g.estado === "pendiente" && !g.categoria}
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
                  <button className="icon-btn accent" onClick={() => setModal({ type: "transfer" })}>
                    <Plus size={18} />
                  </button>
                </div>
                {day.transferencias.length === 0 ? (
                  <Empty icon={<ArrowLeftRight size={26} strokeWidth={1.3} />} text="No hay transferencias registradas este día." />
                ) : (
                  <div className="card-list">
                    {day.transferencias.map((t) => (
                      <button key={t.id} className="card" onClick={() => setModal({ type: "transfer", editing: t })}>
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
            </main>
          </>
        )}
      </>
      )}

      {isOwner && (
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            <button className={`bottom-nav-item ${activeTab === "corte" ? "active" : ""}`} onClick={() => setActiveTab("corte")}>
              <Home size={20} />
              <span>Corte</span>
            </button>
            <button className={`bottom-nav-item ${activeTab === "equipo" ? "active" : ""}`} onClick={() => setActiveTab("equipo")}>
              <Users size={20} />
              <span>Equipo</span>
            </button>
            <button className={`bottom-nav-item ${activeTab === "negocio" ? "active" : ""}`} onClick={() => setActiveTab("negocio")}>
              <Store size={20} />
              <span>Negocio</span>
            </button>
            <button className={`bottom-nav-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>
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
        />
      )}
      {modal?.type === "gasto" && (
        <GastoModal
          onClose={() => setModal(null)}
          onSave={saveGasto}
          onDelete={modal.editing ? () => deleteGasto((modal.editing as Gasto).id) : undefined}
          editing={modal.editing}
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
      {modal?.type === "apps" && day && <AppsModal onClose={() => setModal(null)} onSave={saveVentaApps} value={day.ventaApps || 0} />}
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
        />
      )}
      {modal?.type === "creditoProveedores" && monthKeys.length > 0 && (
        <CreditoProveedoresModal
          onClose={() => setModal(null)}
          months={data.months}
          monthKeys={monthKeys}
          initialMonthKey={mostRecentMonthKey as string}
          initialWeekIndex={mostRecentWeekIdx}
          onSave={saveCreditoProveedores}
        />
      )}
      {modal?.type === "catalog" && (
        <CatalogModal onClose={() => setModal(null)} meseros={data.meseros} onSave={upsertMesero} onRemove={removeMeseroFromCatalog} />
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
