import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      window.location.href = "/";
      return;
    }

    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      window.location.href = "/";
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(error.message);
      } else {
        // Full reload so AuthProvider re-mounts and reads the persisted
        // session from localStorage via getSession() — avoids onAuthStateChange timing issues.
        window.location.href = "/";
      }
    }).catch((err) => {
      setError(err?.message ?? "Unexpected error");
    });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="font-mono text-[11px] uppercase tracking-widest text-red-400 mb-3">Sign-in failed</p>
          <p className="font-mono text-[10px] text-white/40 mb-6">{error}</p>
          <a href="/login" className="font-mono text-[10px] uppercase tracking-widest text-white/60 hover:text-white border border-white/20 hover:border-white/40 px-4 py-2 transition">
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">Signing in…</p>
      </div>
    </div>
  );
}
