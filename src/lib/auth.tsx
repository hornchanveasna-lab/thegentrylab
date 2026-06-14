import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  function signInWithGoogle() {
    if (!supabase) return;

    const left = Math.round(window.screenX + (window.outerWidth - 500) / 2);
    const top  = Math.round(window.screenY + (window.outerHeight - 600) / 2);

    // Open /auth/start synchronously — no async before window.open so popup blocker won't fire
    const popup = window.open(
      "/auth/start",
      "google-signin",
      `width=500,height=600,left=${left},top=${top}`
    );

    // Poll until popup closes, then refresh session
    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        supabase!.auth.getSession().then(({ data }) => {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        });
      }
    }, 500);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
