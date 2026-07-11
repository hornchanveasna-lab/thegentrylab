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

/**
 * Every RLS policy in this schema is keyed on telegram_id() = auth.jwt() -> user_metadata
 * ->> 'telegram_id', not auth.uid(). A web (Google) user's telegram_users row is invisible
 * to their own "read own" policy until that claim is bridged into their JWT — get_my_telegram_id()
 * bypasses RLS (keyed on auth.uid() only) to look it up, then updateUser + refreshSession
 * bakes it into the JWT so every subsequent query actually resolves.
 */
async function ensureTelegramIdClaim(session: Session | null) {
  if (!supabaseCM || !session || session.user.user_metadata?.telegram_id) return;
  const { data: telegramId, error } = await supabaseCM.rpc("get_my_telegram_id");
  if (error || telegramId == null) return; // no telegram_users row yet — bootstrap flow will create one
  await supabaseCM.auth.updateUser({ data: { telegram_id: telegramId } });
  await supabaseCM.auth.refreshSession();
  // React Query's cache doesn't know the JWT changed — a full reload is the simplest
  // way to guarantee every already-mounted query re-runs with the fixed claim
  // (same pattern the OAuth callback page already uses for this exact reason).
  window.location.reload();
}

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
      ensureTelegramIdClaim(data.session);
    });

    const { data: { subscription } } = supabaseCM.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      ensureTelegramIdClaim(session);
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
