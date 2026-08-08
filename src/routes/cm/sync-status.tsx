import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { BackButton, EmptyState } from "@/components/cm/shared";
import {
  listOutboxJobs,
  subscribeOutbox,
  retryOutboxJob,
  syncOutbox,
  type OutboxJob,
} from "@/lib/cm-offline/capture";

export const Route = createFileRoute("/cm/sync-status")({
  head: () => ({ meta: [{ title: "Sync Status — Construction Management App" }] }),
  component: CMSyncStatusPage,
});

const STATUS_COLOR: Record<OutboxJob["status"], string> = {
  pending: "#f59e0b",
  syncing: "#3b82f6",
  failed: "#ef4444",
};

function CMSyncStatusPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const [jobs, setJobs] = useState<OutboxJob[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      listOutboxJobs().then((j) => {
        if (!cancelled) setJobs(j);
      });
    };
    refresh();
    const unsubscribe = subscribeOutbox(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button
          onClick={() => signInWithGoogle()}
          className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
          style={{ backgroundColor: "#ff5100" }}
        >
          {t("common.signInGoogle")}
        </button>
      </div>
    );
  }

  const failedCount = jobs.filter((j) => j.status === "failed").length;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-5">
          <BackButton to="/cm" />
          <h1 className="text-xl font-extrabold tracking-tight text-white flex-1 truncate">
            {t("offline.syncStatusTitle")}
          </h1>
          {failedCount > 0 && (
            <button
              type="button"
              onClick={() => void syncOutbox()}
              className="text-[11px] font-mono uppercase tracking-widest text-[#ff5100] hover:text-[#ff5100]/80 transition-colors shrink-0"
            >
              {t("offline.retryAll")}
            </button>
          )}
        </div>

        {jobs.length === 0 && <EmptyState message={t("offline.empty")} />}

        {jobs.length > 0 && (
          <div className="flex flex-col gap-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-start gap-3 rounded-xl bg-[#0d0d0e] px-4 py-3"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                  style={{ backgroundColor: STATUS_COLOR[job.status] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-white/85 truncate">
                    {job.kind === "daily-log-write"
                      ? t("offline.kindDailyLogWrite")
                      : t("offline.kindPhotoNote")}
                  </p>
                  <p className="text-[12px] text-white/45 mt-0.5">
                    {job.payload.date} ·{" "}
                    {t("offline.photosCount", { count: String(job.payload.files.length) })}
                  </p>
                  <p className="font-mono text-[9px] text-white/25 mt-1">
                    {job.status === "failed"
                      ? t("offline.statusFailed")
                      : job.status === "syncing"
                        ? t("offline.statusSyncing")
                        : t("offline.statusPending")}
                    {job.lastError ? ` — ${job.lastError}` : ""}
                  </p>
                </div>
                {job.status === "failed" && (
                  <button
                    type="button"
                    onClick={() => {
                      void retryOutboxJob(job.id).then(() => syncOutbox());
                    }}
                    className="text-[11px] font-mono uppercase tracking-widest text-[#ff5100] hover:text-[#ff5100]/80 transition-colors shrink-0"
                  >
                    {t("offline.retryNow")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
