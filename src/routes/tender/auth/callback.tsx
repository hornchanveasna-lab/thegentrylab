import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseTender } from "@/lib/supabase-tender";
import { Banner, buttonCls, ACCENT } from "@/components/tender/shared";

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

  return (
    <div data-theme="light">
      <div className="tenderai-scope min-h-screen bg-white text-gray-900 font-sans flex items-center justify-center px-4">
        {error ? (
          <div className="w-full max-w-sm text-center">
            <h1 className="text-[17px] font-semibold tracking-tight mb-3">Sign-in failed</h1>
            <Banner tone="error">{error}</Banner>
            <a href="/tender" className={buttonCls("primary")}>Try again</a>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin mx-auto mb-4" style={{ borderTopColor: ACCENT }} />
            <p className="text-[13px] text-gray-600">Signing in…</p>
          </div>
        )}
      </div>
    </div>
  );
}
