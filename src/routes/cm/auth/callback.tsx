import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseCM } from "@/lib/supabase-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { PENDING_INVITE_KEY } from "@/components/cm/shared";

export const Route = createFileRoute("/cm/auth/callback")({
  component: CMAuthCallback,
});

function postSignInRedirect() {
  let pendingInvite: string | null = null;
  try { pendingInvite = localStorage.getItem(PENDING_INVITE_KEY); } catch { /* */ }
  window.location.href = pendingInvite ? `/cm/join/${pendingInvite}` : "/cm";
}

function CMAuthCallback() {
  const { t } = useCMLang();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseCM) { postSignInRedirect(); return; }

    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) { postSignInRedirect(); return; }

    supabaseCM.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(error.message);
      } else {
        postSignInRedirect();
      }
    }).catch((err) => {
      setError(err?.message ?? "Unexpected error");
    });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="font-mono text-[11px] uppercase tracking-widest text-red-400 mb-3">{t("auth.signInFailed")}</p>
          <p className="font-mono text-[10px] text-text-subtle mb-6">{error}</p>
          <a href="/cm" className="font-mono text-[10px] uppercase tracking-widest text-text-muted hover:text-text-primary border border-border hover:border-border px-4 py-2 transition">
            {t("auth.tryAgain")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-text-subtle">{t("auth.signingIn")}</p>
      </div>
    </div>
  );
}
