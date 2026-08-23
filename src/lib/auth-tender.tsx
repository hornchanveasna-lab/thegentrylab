import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseTender } from "./supabase-tender";

interface AuthTenderContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthTenderContext = createContext<AuthTenderContextValue>({
  user: null,
  session: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthTenderProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseTender) { setLoading(false); return; }

    supabaseTender.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabaseTender.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    if (!supabaseTender) return;
    const { data, error } = await supabaseTender.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/tender/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data?.url) return;
    window.location.href = data.url;
  }

  async function signOut() {
    if (!supabaseTender) return;
    await supabaseTender.auth.signOut();
  }

  return (
    <AuthTenderContext.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthTenderContext.Provider>
  );
}

export const useAuthTender = () => useContext(AuthTenderContext);
