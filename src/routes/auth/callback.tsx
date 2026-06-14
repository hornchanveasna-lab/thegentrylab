import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabase) {
      navigate({ to: "/" });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/" });
      } else {
        // Exchange code for session (PKCE flow)
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          supabase.auth.exchangeCodeForSession(code).then(() => {
            navigate({ to: "/" });
          });
        } else {
          navigate({ to: "/" });
        }
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">Signing in…</p>
      </div>
    </div>
  );
}
