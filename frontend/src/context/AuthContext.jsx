import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = checking, false = anonymous, object = authed
  const [user, setUser] = useState(null);

  // Fetches our app's profile (plan, credits, etc.) for the current Supabase
  // session — auto-provisioned server-side on first call for a new user.
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch {
      setUser(false);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data?.session) refresh();
      else setUser(false);
    });

    // Keep our profile in sync whenever Supabase's session changes (sign in,
    // sign out, token refresh, or another tab logging in/out).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) refresh();
      else setUser(false);
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [refresh]);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    const data = await refresh();
    return data ? { ok: true } : { ok: false, error: "Signed in, but couldn't load your profile." };
  };

  const register = async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    });
    if (error) return { ok: false, error: formatApiErrorDetail(error.message) };
    const data = await refresh();
    return data ? { ok: true } : { ok: false, error: "Account created — check your email to confirm, then log in." };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
