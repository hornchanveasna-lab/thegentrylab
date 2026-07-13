import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { PENDING_INVITE_KEY } from "@/components/cm/shared";
import { useCMInviteByToken, acceptCMProjectInvite } from "@/lib/cm-data";

export const Route = createFileRoute("/cm/join/$token")({
  head: () => ({ meta: [{ title: "Join Project — Construction Management App" }] }),
  component: CMJoinPage,
});

function CMJoinPage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const { data: invite, isLoading: inviteLoading } = useCMInviteByToken(token);
  const [status, setStatus] = useState<"idle" | "joining" | "error">("idle");

  useEffect(() => {
    if (!user || !invite || status !== "idle") return;
    setStatus("joining");
    acceptCMProjectInvite(invite, user)
      .then(() => {
        try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* */ }
        navigate({ to: "/cm" });
      })
      .catch(() => setStatus("error"));
  }, [user, invite, status, navigate]);

  const handleSignIn = () => {
    try { localStorage.setItem(PENDING_INVITE_KEY, token); } catch { /* */ }
    signInWithGoogle();
  };

  if (authLoading || inviteLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;

  if (!invite) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans text-center">
        <p className="text-white/50 text-sm">{t("team.inviteInvalid")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
      <div className="text-center max-w-sm flex flex-col items-center gap-5">
        <p className="text-[15px] text-white/80">{t("team.inviteJoinPrompt")}</p>
        {!user ? (
          <button onClick={handleSignIn}
            className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
            style={{ backgroundColor: "#ff5100" }}>
            {t("common.signInGoogle")}
          </button>
        ) : (
          <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">{t("team.joining")}</p>
        )}
        {status === "error" && <p className="text-red-400 text-[12px]">{t("team.joinFailed")}</p>}
      </div>
    </div>
  );
}
