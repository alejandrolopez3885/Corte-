import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { defaultData, migrateAppData } from "./dataModel";
import type { AppData, Profile } from "./types";

export type SaveState = "idle" | "saving" | "saved" | "error";

// El "dueño" de los datos: si eres owner, tus propios datos; si eres staff, los de tu owner vinculado.
function ownerIdFor(profile: Profile): string {
  return profile.role === "owner" ? profile.id : (profile.owner_id as string);
}

export function useAppData(profile: Profile | null) {
  const [data, setData] = useState<AppData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetOwnerId = profile ? ownerIdFor(profile) : null;

  useEffect(() => {
    if (!targetOwnerId) return;
    let cancelled = false;
    (async () => {
      setStatus("loading");
      const { data: row, error } = await supabase
        .from("app_data")
        .select("data")
        .eq("owner_id", targetOwnerId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("No se pudieron cargar los datos", error);
        setStatus("error");
        return;
      }

      if (row) {
        const { data: migrated, changed } = migrateAppData(row.data as AppData);
        setData(migrated);
        if (changed) {
          supabase
            .from("app_data")
            .update({ data: migrated, updated_at: new Date().toISOString() })
            .eq("owner_id", targetOwnerId)
            .then(({ error: migrationError }) => {
              if (migrationError) console.error("No se pudo guardar la migración de datos", migrationError);
            });
        }
      } else {
        const fresh = defaultData();
        const { error: insertError } = await supabase
          .from("app_data")
          .insert({ owner_id: targetOwnerId, data: fresh });
        if (insertError) {
          console.error("No se pudo inicializar el negocio", insertError);
          setStatus("error");
          return;
        }
        setData(fresh);
      }
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [targetOwnerId]);

  const persist = useCallback(
    (next: AppData) => {
      setData(next);
      if (!targetOwnerId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState("saving");
      saveTimer.current = setTimeout(async () => {
        const { error } = await supabase
          .from("app_data")
          .update({ data: next, updated_at: new Date().toISOString() })
          .eq("owner_id", targetOwnerId);
        setSaveState(error ? "error" : "saved");
        if (error) console.error("No se pudo guardar", error);
      }, 400);
    },
    [targetOwnerId]
  );

  return { data, status, saveState, persist };
}
