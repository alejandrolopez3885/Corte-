import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { StaffAssignment } from "./types";

const POLL_INTERVAL_MS = 20000;

export async function listAssignments(staffId: string): Promise<StaffAssignment[]> {
  const { data, error } = await supabase
    .from("staff_assignments")
    .select("id, staff_id, assigned_date, week_index")
    .eq("staff_id", staffId)
    .order("assigned_date", { ascending: true });
  if (error) throw error;
  return data as StaffAssignment[];
}

export async function addAssignment(staffId: string, date: string, weekIndex: number): Promise<void> {
  const { error } = await supabase
    .from("staff_assignments")
    .insert({ staff_id: staffId, assigned_date: date, week_index: weekIndex });
  if (error) throw error;
}

// Igual que addAssignment, pero no truena si esa persona ya tenía esa fecha
// asignada — la deja tal cual (o actualiza la semana). Usado al asignar un
// día desde el propio Corte diario, donde reintentar/reasignar a la misma
// persona debe ser inofensivo.
export async function upsertAssignment(staffId: string, date: string, weekIndex: number): Promise<void> {
  const { error } = await supabase
    .from("staff_assignments")
    .upsert({ staff_id: staffId, assigned_date: date, week_index: weekIndex }, { onConflict: "staff_id,assigned_date" });
  if (error) throw error;
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase.from("staff_assignments").delete().eq("id", assignmentId);
  if (error) throw error;
}

// Quita la asignación de una persona en concreto para una fecha en
// concreto — usado al reasignar el día a alguien más o al quitarle el
// acceso desde el Corte diario, donde no se tiene a la mano el id de la
// fila (solo se sabe quién y qué fecha).
export async function removeAssignmentByStaffAndDate(staffId: string, date: string): Promise<void> {
  const { error } = await supabase.from("staff_assignments").delete().eq("staff_id", staffId).eq("assigned_date", date);
  if (error) throw error;
}

// Usado por la vista del staff: mantiene la lista de sus días asignados al
// día. Los cambios en vivo (Supabase Realtime) hacen que una asignación o
// una revocación del dueño se reflejen de inmediato; el sondeo cada 20s
// sigue como respaldo por si la conexión en vivo se cae.
export function useStaffAssignments(staffId: string | null) {
  const [assignments, setAssignments] = useState<StaffAssignment[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const refresh = useCallback(async () => {
    if (!staffId) return;
    try {
      const rows = await listAssignments(staffId);
      setAssignments(rows);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [staffId]);

  useEffect(() => {
    if (!staffId) return;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [staffId, refresh]);

  useEffect(() => {
    if (!staffId) return;
    const channel = supabase
      .channel(`staff_assignments-${staffId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_assignments", filter: `staff_id=eq.${staffId}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffId, refresh]);

  return { assignments, status, refresh };
}
