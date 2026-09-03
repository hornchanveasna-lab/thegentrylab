import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseTender } from "@/lib/supabase-tender";

export const Route = createFileRoute("/tender/auth/callback")({
  component: TenderAuthCallback,
});

function TenderAuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseTender) { window.location.href = "/tender"; return; }

    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) { window.location.href = "/tender"; return; }

    supabaseTender.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(error.message);
      } else {
        window.location.href = "/tender";
      }
    }).catch((err) => {
      setError(err?.message ?? "Unexpected error");
    });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-[11px] text-red-600 mb-3">Sign-in failed</p>
          <p className="text-[10px] text-gray-400 mb-6">{error}</p>
          <a href="/tender" className="text-[10px] text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-4 py-2 transition">
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin mx-auto mb-4" style={{ borderTopColor: "#0696D7" }} />
        <p className="text-[11px] text-gray-400">Signing in…</p>
      </div>
    </div>
  );
}
