import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseCM } from "@/lib/supabase-cm";

export const Route = createFileRoute("/cm/auth/callback")({
  component: CMAuthCallback,
});

function CMAuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseCM) { window.location.href = "/"; return; }

    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) { window.location.href = "/"; return; }

    supabaseCM.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(error.message);
      } else {
        window.location.href = "/";
      }
    }).catch((err) => {
      setError(err?.message ?? "Unexpected error");
    });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="font-mono text-[11px] uppercase tracking-widest text-red-400 mb-3">Sign-in failed</p>
          <p className="font-mono text-[10px] text-white/40 mb-6">{error}</p>
          <a href="/" className="font-mono text-[10px] uppercase tracking-widest text-white/60 hover:text-white border border-white/20 hover:border-white/40 px-4 py-2 transition">
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-[#ff5100] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">Signing in…</p>
      </div>
    </div>
  );
}
