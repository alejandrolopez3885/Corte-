import { useEffect, useRef, useState } from "react";
import {
  Plus, Settings2, Users, Receipt, ArrowLeftRight, CircleDot, Circle, Pencil,
  Smartphone, BarChart3, CalendarDays, LogOut,
} from "lucide-react";
import { useAuth } from "../lib/auth.tsx";
import { useAppData } from "../lib/useAppData";
import { buildMonth, formatAssignedDate, locateDate, money, round2, sumFromText, uid } from "../lib/dataModel";
import { useStaffAssignments } from "../lib/staffAssignments";
import { DAYS, DAY_SHORT } from "../lib/types";
import type { DayData, DayName, Gasto, MeseroCatalogEntry, MeseroCut, Profile, Transferencia, WeekData } from "../lib/types";
import { Empty } from "../components/ui";
import { MonthModal } from "../components/modals/MonthModal";
import { MeseroModal, type MeseroFormValues } from "../components/modals/MeseroModal";
import { GastoModal, type GastoFormValues } from "../components/modals/GastoModal";
import { TransferModal, type TransferFormValues } from "../components/modals/TransferModal";
import { CatalogModal } from "../components/modals/CatalogModal";
import { AppsModal } from "../components/modals/AppsModal";
import { WeekSummaryModal } from "../components/modals/WeekSummaryModal";
import { GastosSummaryModal } from "../components/modals/GastosSummaryModal";
import { AssignDayModal } from "../components/modals/AssignDayModal";

type ModalState =
  | { type: "month" }
  | { type: "mesero"; editing?: MeseroCut }
  | { type: "gasto"; editing?: Gasto }
  | { type: "transfer"; editing?: Transferencia }
  | { type: "apps" }
  | { type: "weekSummary" }
  | { type: "gastosSummary" }
  | { type: "catalog" }
  | { type: "assignDay" }
  | null;

export default function CortesApp({ profile }: { profile: Profile }) {
  const { signOut } = useAuth();

  const isOwner = profile.role === "owner";
  const { data, status, saveState, persist } = useAppData(profile);

  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [activeDay, setActiveDay] = useState<DayName>("Lunes");
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedAssignedDate, setSelectedAssignedDate] = useState<string | null>(null);

  const ownerInitialized = useRef(false);
  const locatedForDate = useRef<string | null>(null);
  const { assignments, status: assignmentsStatus } = useStaffAssignments(isOwner ? null : profile.id);

  // Dueño: al cargar, ubica el mes más reciente.
  useEffect(() => {
    if (!data || !isOwner || ownerInitialized.current) return;
    const monthKeys = Object.keys(data.months).sort();
    const last = monthKeys[monthKeys.length - 1];
    if (last) setActiveMonth(last);
    ownerInitialized.current = true;
  }, [data, isOwner]);

  // Staff: cuando elige un día de su lista, lo ubica en mes/semana/día.
  useEffect(() => {
    if (!data || isOwner || !selectedAssignedDate) return;
    if (locatedForDate.current === selectedAssignedDate) return;
    locatedForDate.current = selectedAssignedDate;
    const loc = locateDate(selectedAssignedDate);
    setActiveMonth(loc.monthKey);
    setActiveWeek(loc.weekIndex);
    setActiveDay(loc.dayName);
    if (!data.months[loc.monthKey]) {
      const next = structuredClone(data);
      next.months[loc.monthKey] = buildMonth(loc.monthKey);
      persist(next);
    }
  }, [data, isOwner, selectedAssignedDate, persist]);

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

  function addMonth(monthKey: string) {
    if (!data) return;
    if (data.months[monthKey]) {
      setActiveMonth(monthKey);
      setActiveWeek(0);
      setActiveDay("Lunes");
      setModal(null);
      return;
    }
    const next = structuredClone(data);
    next.months[monthKey] = buildMonth(monthKey);
    persist(next);
    setActiveMonth(monthKey);
    setActiveWeek(0);
    setActiveDay("Lunes");
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
      const entry: Gasto = { id: editingId || uid(), concepto: form.concepto, total: parseFloat(form.total) || 0, estado: form.estado, origen: "manual" };
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

  function toggleGastoEstadoInWeek(dayName: DayName, id: string) {
    updateWeek((w) => {
      const g = w.days[dayName].gastos.find((x) => x.id === id);
      if (g) g.estado = g.estado === "pendiente" ? "ingresado" : "pendiente";
    });
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

  function saveVentaApps(rawValue: string) {
    updateDay((d) => {
      d.ventaApps = sumFromText(rawValue);
    });
    setModal(null);
  }

  const totals = day
    ? (() => {
        const ventaMeseros = day.meseros.reduce((s, m) => s + m.venta, 0);
        const tarjetas = day.meseros.reduce((s, m) => s + m.tarjetas, 0);
        const transferencias = day.transferencias.reduce((s, t) => s + t.total, 0);
        const gastos = day.gastos.reduce((s, g) => s + g.total, 0);
        return {
          venta: round2(ventaMeseros + (day.ventaApps || 0)),
          tarjetas,
          transferencias,
          gastos,
          propina: day.meseros.reduce((s, m) => s + m.propina, 0),
          efectivo: round2(ventaMeseros - tarjetas - transferencias - gastos),
        };
      })()
    : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Cortes</span>
          {month && <span className="brand-month">{month.label}</span>}
          {!isOwner && <span className="brand-role">Acceso por día asignado</span>}
        </div>
        <div className="topbar-actions">
          {saveState === "error" && <span className="save-badge error">No se guardó</span>}
          {saveState === "saving" && <span className="save-badge">Guardando…</span>}
          {isOwner && (
            <button className="icon-btn" onClick={() => setModal({ type: "assignDay" })} aria-label="Tu equipo">
              <CalendarDays size={19} />
            </button>
          )}
          {isOwner && (
            <button className="icon-btn" onClick={() => setModal({ type: "catalog" })} aria-label="Meseros">
              <Settings2 size={19} />
            </button>
          )}
          {isOwner && (
            <button className="pill-btn" onClick={() => setModal({ type: "month" })}>
              <Plus size={16} /> Mes
            </button>
          )}
          <button className="icon-btn" onClick={signOut} aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {isOwner && monthKeys.length > 1 && (
        <nav className="month-scroll">
          {monthKeys.map((mk) => (
            <button
              key={mk}
              className={`month-chip ${mk === activeMonth ? "active" : ""}`}
              onClick={() => {
                setActiveMonth(mk);
                setActiveWeek(0);
                setActiveDay("Lunes");
              }}
            >
              {data.months[mk].label}
            </button>
          ))}
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
            <div className="week-bar">
              <nav className="week-tabs">
                {month.weeks.map((_, i) => (
                  <button
                    key={i}
                    className={`week-tab ${i === activeWeek ? "active" : ""}`}
                    onClick={() => {
                      setActiveWeek(i);
                      setActiveDay("Lunes");
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

          {isOwner && (
            <nav className="day-scroll">
              {DAYS.map((d) => {
                const hasData = month.weeks[activeWeek].days[d].meseros.length > 0;
                return (
                  <button key={d} className={`day-chip ${d === activeDay ? "active" : ""}`} onClick={() => setActiveDay(d)}>
                    {hasData ? <CircleDot size={9} /> : <Circle size={9} />}
                    {DAY_SHORT[d]}
                  </button>
                );
              })}
            </nav>
          )}

          {totals && (
            <section className="summary">
              <div className="summary-item">
                <span>Venta</span>
                <strong>{money(totals.venta)}</strong>
              </div>
              <div className="summary-item">
                <span>Tarjetas</span>
                <strong>{money(totals.tarjetas)}</strong>
              </div>
              <div className="summary-item">
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
                      <button className={`estado-chip ${g.estado}`} onClick={() => toggleGastoEstado(g.id)}>
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
      {modal?.type === "weekSummary" && month && (
        <WeekSummaryModal
          onClose={() => setModal(null)}
          week={month.weeks[activeWeek]}
          weekLabel={`Semana ${activeWeek + 1} · ${month.label}`}
          onSaveEfectivoReal={saveEfectivoReal}
        />
      )}
      {modal?.type === "gastosSummary" && month && (
        <GastosSummaryModal
          onClose={() => setModal(null)}
          week={month.weeks[activeWeek]}
          weekLabel={`Gastos · Semana ${activeWeek + 1} · ${month.label}`}
          onToggleEstado={toggleGastoEstadoInWeek}
        />
      )}
      {modal?.type === "catalog" && (
        <CatalogModal onClose={() => setModal(null)} meseros={data.meseros} onSave={upsertMesero} onRemove={removeMeseroFromCatalog} />
      )}
      {modal?.type === "assignDay" && <AssignDayModal onClose={() => setModal(null)} ownerId={profile.id} />}
    </div>
  );
}
