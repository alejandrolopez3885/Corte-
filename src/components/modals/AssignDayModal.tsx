import { useEffect, useState } from "react";
import { Sheet, Field, NumInput } from "../ui";
import { supabase } from "../../lib/supabaseClient";
import { locateDate } from "../../lib/dataModel";
import { createStaffAccount, PIN_LENGTH } from "../../lib/staffAccounts";
import type { Profile } from "../../lib/types";

export function AssignDayModal({ onClose, ownerId }: { onClose: () => void; ownerId: string }) {
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
    <Sheet title="Tu equipo" onClose={onClose}>
      {status === "loading" && <p className="hint">Cargando…</p>}
      {status === "error" && <p className="hint">No se pudo cargar la información del equipo.</p>}
      {status === "none" && <CreateStaffForm ownerId={ownerId} onCreated={load} />}
      {status === "ready" && staff && <AssignDateForm staff={staff} onChanged={load} />}
    </Sheet>
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

function AssignDateForm({ staff, onChanged }: { staff: Profile; onChanged: () => void }) {
  const [date, setDate] = useState(staff.assigned_date || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ assigned_date: date || null })
      .eq("id", staff.id);
    setSaving(false);
    if (!error) onChanged();
  }

  const location = date ? locateDate(date) : null;

  return (
    <>
      <p className="hint">
        <strong>{staff.display_name}</strong> solo puede ver y capturar el corte del día que le asignes aquí.
      </p>
      <Field label="Fecha asignada">
        <input type="date" className="date-input" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {location && (
        <p className="hint">
          Corresponde a {location.dayName}, semana {location.weekIndex + 1} del mes {location.monthKey}.
        </p>
      )}
      <button className="btn-primary" disabled={saving} onClick={save}>
        {saving ? "Guardando…" : "Guardar asignación"}
      </button>
      {date && (
        <button className="link-btn" onClick={() => setDate("")}>
          Quitar asignación
        </button>
      )}
    </>
  );
}
