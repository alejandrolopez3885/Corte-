import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { StaffAssignment } from "./types";

const POLL_INTERVAL_MS = 20000;

export async function listAssignments(staffId: string): Promise<StaffAssignment[]> {
  const { data, error } = await supabase
    .from("staff_assignments")
    .select("id, staff_id, assigned_date")
    .eq("staff_id", staffId)
    .order("assigned_date", { ascending: true });
  if (error) throw error;
  return data as StaffAssignment[];
}

export async function addAssignment(staffId: string, date: string): Promise<void> {
  const { error } = await supabase.from("staff_assignments").insert({ staff_id: staffId, assigned_date: date });
  if (error) throw error;
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase.from("staff_assignments").delete().eq("id", assignmentId);
  if (error) throw error;
}

// Usado por la vista del staff: mantiene la lista de sus días asignados
// al día, revisando periódicamente mientras la app está abierta — así, si
// el dueño le quita un día, deja de tener acceso sin necesidad de recargar.
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

  return { assignments, status, refresh };
}
