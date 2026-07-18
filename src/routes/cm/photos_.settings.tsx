import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { ModuleSettingsPage, Card, SettingControlRow } from "@/components/cm/shared";
import { useCMAccountSettings } from "@/lib/cm-data";
import { resolveSetting, writeSettingAndSync, SETTING_DEFINITIONS } from "@/lib/cm-settings";

export const Route = createFileRoute("/cm/photos_/settings")({
  component: PhotosSettingsPage,
});

function PhotosSettingsPage() {
  const { user, loading: authLoading } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: account } = useCMAccountSettings(user?.id);
  const [busy, setBusy] = useState(false);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user) return null;

  const ctx = { ownerId: user.id, actorId: user.id };
  const run = async (p: Promise<void>) => {
    setBusy(true);
    try { await p; } finally { setBusy(false); }
  };

  const showCompanyLogo = resolveSetting(SETTING_DEFINITIONS.photoShowCompanyLogo, { account });
  const showProjectInfo = resolveSetting(SETTING_DEFINITIONS.photoShowProjectInfo, { account });
  const showConsultantLogos = resolveSetting(SETTING_DEFINITIONS.photoShowConsultantLogos, { account });
  const monotoneLogos = resolveSetting(SETTING_DEFINITIONS.photoMonotoneLogos, { account });
  const timestamp = resolveSetting(SETTING_DEFINITIONS.photoTimestamp, { account });

  return (
    <ModuleSettingsPage title={`${t("photos.title")} — ${t("common.settings")}`} backTo="/cm/photos">
      <Card title={t("photos.settingsTitle")}>
        <div className="flex flex-col divide-y divide-white/6">
          <SettingControlRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            }
            label={t("photos.showCompanyLogo")} resolved={showCompanyLogo} disabled={busy}
            onChange={(v) => run(writeSettingAndSync(SETTING_DEFINITIONS.photoShowCompanyLogo, v, ctx, queryClient))}
            onReset={() => run(writeSettingAndSync(SETTING_DEFINITIONS.photoShowCompanyLogo, SETTING_DEFINITIONS.photoShowCompanyLogo.defaultValue, ctx, queryClient))}
          />
          <SettingControlRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" />
              </svg>
            }
            label={t("photos.showProjectInfo")} resolved={showProjectInfo} disabled={busy}
            onChange={(v) => run(writeSettingAndSync(SETTING_DEFINITIONS.photoShowProjectInfo, v, ctx, queryClient))}
            onReset={() => run(writeSettingAndSync(SETTING_DEFINITIONS.photoShowProjectInfo, SETTING_DEFINITIONS.photoShowProjectInfo.defaultValue, ctx, queryClient))}
          />
          <SettingControlRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.2" r="2.1" />
                <path d="M3.3 20c0-3.3 2.5-5.6 5.7-5.6s5.7 2.3 5.7 5.6" /><path d="M14.8 14.9c2.5.4 4.4 2.5 4.4 5.1" />
              </svg>
            }
            label={t("photos.showConsultantLogos")} resolved={showConsultantLogos} disabled={busy}
            onChange={(v) => run(writeSettingAndSync(SETTING_DEFINITIONS.photoShowConsultantLogos, v, ctx, queryClient))}
            onReset={() => run(writeSettingAndSync(SETTING_DEFINITIONS.photoShowConsultantLogos, SETTING_DEFINITIONS.photoShowConsultantLogos.defaultValue, ctx, queryClient))}
          />
          <SettingControlRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
              </svg>
            }
            label={t("photos.monotoneLogos")} resolved={monotoneLogos} disabled={busy}
            onChange={(v) => run(writeSettingAndSync(SETTING_DEFINITIONS.photoMonotoneLogos, v, ctx, queryClient))}
            onReset={() => run(writeSettingAndSync(SETTING_DEFINITIONS.photoMonotoneLogos, SETTING_DEFINITIONS.photoMonotoneLogos.defaultValue, ctx, queryClient))}
          />
          <SettingControlRow
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" />
              </svg>
            }
            label={t("photos.timestamp")} resolved={timestamp} disabled={busy}
            onChange={(v) => run(writeSettingAndSync(SETTING_DEFINITIONS.photoTimestamp, v, ctx, queryClient))}
            onReset={() => run(writeSettingAndSync(SETTING_DEFINITIONS.photoTimestamp, SETTING_DEFINITIONS.photoTimestamp.defaultValue, ctx, queryClient))}
          />
        </div>
      </Card>
    </ModuleSettingsPage>
  );
}
