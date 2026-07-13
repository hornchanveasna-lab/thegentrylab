import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { PENDING_INVITE_KEY, inputCls, labelCls } from "@/components/cm/shared";
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
  const [status, setStatus] = useState<"idle" | "intake" | "joining" | "error">("idle");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");

  useEffect(() => {
    if (user && !name) {
      setName((user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? "");
    }
  }, [user, name]);

  useEffect(() => {
    if (user && invite && status === "idle") setStatus("intake");
  }, [user, invite, status]);

  const handleSignIn = () => {
    try { localStorage.setItem(PENDING_INVITE_KEY, token); } catch { /* */ }
    signInWithGoogle();
  };

  const handleJoin = async () => {
    if (!user || !invite) return;
    setStatus("joining");
    try {
      await acceptCMProjectInvite(invite, user, { displayName: name.trim(), position: position.trim() || null });
      try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* */ }
      navigate({ to: "/cm" });
    } catch {
      setStatus("error");
    }
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
      <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
        <p className="text-[15px] text-white/80">{t("team.inviteJoinPromptNamed", { project: invite.project_name })}</p>
        {!user ? (
          <button onClick={handleSignIn}
            className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
            style={{ backgroundColor: "#ff5100" }}>
            {t("common.signInGoogle")}
          </button>
        ) : status === "intake" ? (
          <div className="w-full flex flex-col gap-4 text-left">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("team.intakeNameLabel")}</span>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("team.intakeNamePlaceholder")} autoFocus />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("team.intakeEmailLabel")}</span>
              <p className="text-[13px] text-white/50 px-3.5 py-2.5">{user.email}</p>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("team.intakePositionLabel")}</span>
              <input className={inputCls} value={position} onChange={(e) => setPosition(e.target.value)} placeholder={t("team.intakePositionPlaceholder")} />
            </label>
            <button onClick={handleJoin} disabled={!name.trim()}
              className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
              style={{ backgroundColor: "#ff5100" }}>
              {t("team.intakeSubmit")}
            </button>
          </div>
        ) : (
          <p className="font-mono text-[11px] uppercase tracking-widest text-white/40">{t("team.joining")}</p>
        )}
        {status === "error" && <p className="text-red-400 text-[12px]">{t("team.joinFailed")}</p>}
      </div>
    </div>
  );
}
