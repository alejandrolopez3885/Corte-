import { useEffect, useState } from "react";
import { Sheet, Field } from "../ui";
import { supabase } from "../../lib/supabaseClient";
import { locateDate } from "../../lib/dataModel";
import type { Profile } from "../../lib/types";

export function AssignDayModal({ onClose, ownerId }: { onClose: () => void; ownerId: string }) {
  const [staff, setStaff] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "none">("loading");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
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
      setDate((data as Profile).assigned_date || "");
      setStatus("ready");
    })();
  }, [ownerId]);

  async function save() {
    if (!staff) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ assigned_date: date || null })
      .eq("id", staff.id);
    setSaving(false);
    if (!error) onClose();
  }

  const location = date ? locateDate(date) : null;

  return (
    <Sheet title="Asignar día al equipo" onClose={onClose}>
      {status === "loading" && <p className="hint">Cargando…</p>}
      {status === "error" && <p className="hint">No se pudo cargar la cuenta del equipo.</p>}
      {status === "none" && (
        <p className="hint">
          Aún no existe una cuenta de equipo vinculada a la tuya. Créala desde el panel de Supabase (tabla profiles) con role
          "staff" y owner_id igual a tu propio id.
        </p>
      )}
      {status === "ready" && staff && (
        <>
          <p className="hint">
            {staff.display_name || "Tu compañero"} solo podrá ver y capturar el corte del día que le asignes aquí.
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
      )}
    </Sheet>
  );
}
