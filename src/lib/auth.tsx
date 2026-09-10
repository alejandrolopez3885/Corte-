import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import type { Profile } from "./types";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  status: "loading" | "ready";
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) {
    console.error("No se pudo cargar el perfil", error);
    return null;
  }
  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  async function loadForSession(s: Session | null) {
    setSession(s);
    if (s) {
      const p = await fetchProfile(s.user.id);
      setProfile(p);
    } else {
      setProfile(null);
    }
    setStatus("ready");
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      loadForSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      loadForSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function refreshProfile() {
    if (session) setProfile(await fetchProfile(session.user.id));
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, status, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
