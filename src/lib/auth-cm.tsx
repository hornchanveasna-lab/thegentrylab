import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseCM } from "./supabase-cm";

interface AuthCMContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCMContext = createContext<AuthCMContextValue>({
  user: null,
  session: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthCMProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseCM) { setLoading(false); return; }

    supabaseCM.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabaseCM.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    if (!supabaseCM) return;
    const { data, error } = await supabaseCM.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/cm/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data?.url) return;
    window.location.href = data.url;
  }

  async function signOut() {
    if (!supabaseCM) return;
    await supabaseCM.auth.signOut();
  }

  return (
    <AuthCMContext.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthCMContext.Provider>
  );
}

export const useAuthCM = () => useContext(AuthCMContext);
