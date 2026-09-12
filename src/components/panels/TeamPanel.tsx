import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Field, NumInput } from "../ui";
import { supabase } from "../../lib/supabaseClient";
import { formatAssignedDate, locateDate } from "../../lib/dataModel";
import { addAssignment, listAssignments, removeAssignment } from "../../lib/staffAssignments";
import { createStaffAccount, PIN_LENGTH } from "../../lib/staffAccounts";
import type { Profile, StaffAssignment } from "../../lib/types";

export function TeamPanel({ ownerId }: { ownerId: string }) {
  const [staff, setStaff] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "none">("loading");

  useEffect(() => {
    load();
  }, [ownerId]);

  async function load() {
    setStatus("loading");
    const { data, error } = await supabase.from("profiles").select("*").eq("owner_id", ownerId).eq("role", "staff").maybeSingle();
    if (error) {
      setStatus("error");
      return;
    }
    if (!data) {
      setStatus("none");
      return;
    }
    setStaff(data as Profile);
    setStatus("ready");
  }

  return (
    <div className="page-section">
      <h2 className="page-title">Tu equipo</h2>
      {status === "loading" && <p className="hint">Cargando…</p>}
      {status === "error" && <p className="hint">No se pudo cargar la información del equipo.</p>}
      {status === "none" && <CreateStaffForm ownerId={ownerId} onCreated={load} />}
      {status === "ready" && staff && <AssignmentsManager staff={staff} />}
    </div>
  );
}

function CreateStaffForm({ ownerId, onCreated }: { ownerId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create() {
    setError(null);
    if (pin !== pin2) {
      setError("Los dos PIN no coinciden.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError(`El PIN debe ser de ${PIN_LENGTH} dígitos numéricos.`);
      return;
    }
    setSaving(true);
    try {
      await createStaffAccount({ displayName: name, pin, ownerId });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la cuenta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="hint">
        Crea una cuenta para la persona que te va a apoyar. Solo necesita su nombre y un PIN de {PIN_LENGTH} dígitos — no necesita
        correo. Va a entrar desde "Soy del equipo, tengo un PIN" en la pantalla de inicio.
      </p>
      {error && <div className="auth-error">{error}</div>}
      <Field label="Nombre">
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Ana" />
      </Field>
      <Field label={`PIN de ${PIN_LENGTH} dígitos`}>
        <NumInput
          value={pin}
          maxLength={PIN_LENGTH}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
          placeholder="0000"
        />
      </Field>
      <Field label="Confirma el PIN">
        <NumInput
          value={pin2}
          maxLength={PIN_LENGTH}
          onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
          placeholder="0000"
        />
      </Field>
      <button className="btn-primary" disabled={!name.trim() || pin.length !== PIN_LENGTH || saving} onClick={create}>
        {saving ? "Creando…" : "Crear cuenta"}
      </button>
    </>
  );
}

function AssignmentsManager({ staff }: { staff: Profile }) {
  const [assignments, setAssignments] = useState<StaffAssignment[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [weekIndex, setWeekIndex] = useState(0);
  const [weekTouched, setWeekTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refresh();
  }, [staff.id]);

  // Sugerencia automática de semana al elegir fecha — el dueño la confirma o
  // la corrige, porque las pestañas "Semana N" del corte son manuales.
  useEffect(() => {
    if (!newDate || weekTouched) return;
    setWeekIndex(locateDate(newDate).weekIndex);
  }, [newDate, weekTouched]);

  async function refresh() {
    try {
      setAssignments(await listAssignments(staff.id));
    } catch {
      setLoadError(true);
    }
  }

  async function add() {
    setError(null);
    if (!newDate) return;
    if (assignments?.some((a) => a.assigned_date === newDate)) {
      setError("Esa fecha ya está asignada.");
      return;
    }
    setSaving(true);
    try {
      await addAssignment(staff.id, newDate, weekIndex);
      setNewDate("");
      setWeekIndex(0);
      setWeekTouched(false);
      await refresh();
    } catch {
      setError("No se pudo asignar esa fecha.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(assignmentId: string) {
    setError(null);
    setSaving(true);
    try {
      await removeAssignment(assignmentId);
      await refresh();
    } catch {
      setError("No se pudo quitar esa fecha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="hint">
        <strong>{staff.display_name}</strong> solo puede ver y capturar el corte de los días que le asignes aquí. Al quitar una
        fecha, pierde acceso a ese día de inmediato.
      </p>
      {loadError && <p className="hint">No se pudo cargar sus fechas asignadas.</p>}
      {error && <div className="auth-error">{error}</div>}

      {assignments && assignments.length > 0 && (
        <div className="catalog-list">
          {assignments.map((a) => (
            <div key={a.id} className="catalog-row">
              <div>
                <strong>{formatAssignedDate(a.assigned_date)}</strong>
                <span>Semana {(a.week_index ?? locateDate(a.assigned_date).weekIndex) + 1} de tu corte</span>
              </div>
              <button className="icon-btn" disabled={saving} onClick={() => remove(a.id)} aria-label="Quitar">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {assignments && assignments.length === 0 && !loadError && <p className="hint">Aún no le has asignado ningún día.</p>}

      <div className="field-row">
        <Field label="Agregar fecha">
          <input type="date" className="date-input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </Field>
      </div>
      {newDate && (
        <Field label="¿En qué semana de tu corte cae esta fecha?">
          <select
            className="text-input"
            value={weekIndex}
            onChange={(e) => {
              setWeekIndex(Number(e.target.value));
              setWeekTouched(true);
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                Semana {i + 1}
              </option>
            ))}
          </select>
          <p className="hint">
            Las semanas de tu corte son manuales — revisa en qué pestaña ("Semana 1", "Semana 2"...) ya tienes o vas a tener
            capturado este día, y elígela aquí.
          </p>
        </Field>
      )}
      <button className="btn-primary" disabled={!newDate || saving} onClick={add}>
        {saving ? "Guardando…" : "Agregar día"}
      </button>
    </>
  );
}
