import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useSelectedProject } from "@/components/cm/shared";
import type { SafetyRecordType, SafetySeverity } from "@/lib/cm-data";
import { NewSafetySheet } from "./safety";

export const Route = createFileRoute("/cm/safety_/new")({
  component: NewSafetyEntryPage,
});

function NewSafetyEntryPage() {
  const { user, loading: authLoading } = useAuthCM();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projects, projectId } = useSelectedProject(user?.id);
  const activeProject = projects?.find((p) => p.id === projectId);
  const safetyDefaults = activeProject?.module_defaults?.safety as { recordType?: SafetyRecordType; severity?: SafetySeverity } | undefined;

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user || !projectId) return null;

  return (
    <NewSafetySheet
      ownerId={user.id} projectId={projectId} defaultRecordType={safetyDefaults?.recordType} defaultSeverity={safetyDefaults?.severity} backTo="/cm/safety"
      onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ["cm_safety_records", projectId] });
        navigate({ to: "/cm/safety" });
      }}
    />
  );
}
