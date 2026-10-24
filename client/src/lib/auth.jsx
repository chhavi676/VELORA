import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "").replace(/\/api$/, "");
const AuthContext = createContext({ session: null, profile: null, loading: true, error: "", signOut: async () => {}, refreshProfile: async () => {} });

async function fetchProfile(session) {
  const response = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${session.access_token}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Profile sync failed (${response.status}).`);
  return body.user;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");

  const load = useCallback(async (nextSession) => {
    setSession(nextSession);
    if (!nextSession) { setProfile(null); setError(""); setLoading(false); return; }
    try { setProfile(await fetchProfile(nextSession)); setError(""); }
    catch (e) { setProfile(null); setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) load(data.session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      // Defer network work out of the auth callback so the Supabase client is not locked.
      Promise.resolve().then(() => { if (active) load(next); });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [load]);

  const signOut = useCallback(async () => { await supabase?.auth.signOut(); setSession(null); setProfile(null); }, []);
  const refreshProfile = useCallback(async () => { if (session) await load(session); }, [session, load]);
  const value = useMemo(() => ({ session, profile, loading, error, signOut, refreshProfile }), [session, profile, loading, error, signOut, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
