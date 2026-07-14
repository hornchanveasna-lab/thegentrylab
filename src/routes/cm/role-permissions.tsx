import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { FieldSelect, Card } from "@/components/cm/shared";
import {
  useCMRolePermissions,
  setCMRolePermission,
  useCMCustomJobRoles,
  jobRoleLabel,
  orderedJobRoles,
  CM_JOB_ROLES,
  type CMJobRole,
  type CMModuleKey,
  type CMPermissionAction,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/role-permissions")({
  component: CMRolePermissionsPage,
});

const CM_MODULE_KEYS: CMModuleKey[] = [
  "site_diary", "punch_list", "inspection", "safety", "submittal",
  "equipment", "boq", "schedule", "manpower", "people", "settings",
];
const MODULE_TITLE_KEY: Record<CMModuleKey, string> = {
  site_diary: "siteDiary.title",
  punch_list: "punchList.title",
  inspection: "inspection.title",
  safety: "safety.title",
  submittal: "submittal.title",
  equipment: "equipment.title",
  boq: "boq.title",
  schedule: "schedule.title",
  manpower: "manpower.title",
  people: "people.title",
  settings: "projectSettings.title",
};
const ACTIONS: { action: CMPermissionAction; labelKey: string }[] = [
  { action: "view", labelKey: "rolePermissions.view" },
  { action: "create", labelKey: "rolePermissions.create" },
  { action: "edit", labelKey: "rolePermissions.edit" },
  { action: "approve", labelKey: "rolePermissions.approve" },
  { action: "delete", labelKey: "rolePermissions.delete" },
];
const ACTION_FIELD: Record<CMPermissionAction, "can_view" | "can_create" | "can_edit" | "can_approve" | "can_delete"> = {
  view: "can_view", create: "can_create", edit: "can_edit", approve: "can_approve", delete: "can_delete",
};

function CMRolePermissionsPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: matrix } = useCMRolePermissions(user?.id);
  const { data: customRoles } = useCMCustomJobRoles(user?.id);
  const allRoles = orderedJobRoles(customRoles ?? []);
  const [jobRole, setJobRole] = useState<CMJobRole>(CM_JOB_ROLES[0]);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_role_permissions", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["cm_custom_job_roles", user?.id] });
  };

  const effectiveRow = (moduleKey: CMModuleKey) =>
    matrix?.find((p) => p.job_role === jobRole && p.module_key === moduleKey && p.owner_id === user?.id) ??
    matrix?.find((p) => p.job_role === jobRole && p.module_key === moduleKey && p.owner_id === null);

  const toggle = async (moduleKey: CMModuleKey, action: CMPermissionAction) => {
    if (!user) return;
    const row = effectiveRow(moduleKey);
    const current = row ? { can_view: row.can_view, can_create: row.can_create, can_edit: row.can_edit, can_approve: row.can_approve, can_delete: row.can_delete } : {
      can_view: true, can_create: true, can_edit: true, can_approve: true, can_delete: true,
    };
    const cellKey = `${moduleKey}:${action}`;
    setSaving(cellKey);
    setError("");
    try {
      await setCMRolePermission(user.id, jobRole, moduleKey, { [ACTION_FIELD[action]]: !current[ACTION_FIELD[action]] }, current);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save — the role-permissions schema may need its migration applied in Supabase.");
    } finally {
      setSaving(null);
    }
  };

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()} className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>{t("common.signInGoogle")}</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/cm/settings" className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight text-white">{t("rolePermissions.title")}</h1>
        </div>
        <p className="text-[12px] text-white/35 mb-5">{t("rolePermissions.subtitle")}</p>

        <div className="mb-4">
          <FieldSelect value={jobRole} onChange={setJobRole} searchable allowCustom
            searchPlaceholder={t("rolePermissions.searchRole")}
            options={allRoles.map((r) => ({ value: r, label: jobRoleLabel(r, t) }))} />
        </div>

        {error && <p className="text-[12px] text-red-400 mb-3">{error}</p>}

        <Card title={jobRoleLabel(jobRole, t)}>
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-[1fr_repeat(5,44px)] items-center gap-1 pb-2 mb-1 border-b border-white/6">
              <span />
              {ACTIONS.map(({ action, labelKey }) => (
                <span key={action} className="font-mono text-[8px] uppercase tracking-widest text-white/30 text-center">{t(labelKey)}</span>
              ))}
            </div>
            {CM_MODULE_KEYS.map((moduleKey) => {
              const row = effectiveRow(moduleKey);
              return (
                <div key={moduleKey} className="grid grid-cols-[1fr_repeat(5,44px)] items-center gap-1 py-1.5">
                  <span className="text-[12px] text-white/70 truncate pr-2">{t(MODULE_TITLE_KEY[moduleKey])}</span>
                  {ACTIONS.map(({ action }) => {
                    const checked = row ? row[ACTION_FIELD[action]] : true;
                    const cellKey = `${moduleKey}:${action}`;
                    return (
                      <div key={action} className="flex items-center justify-center">
                        <input type="checkbox" checked={checked} disabled={saving === cellKey}
                          onChange={() => toggle(moduleKey, action)}
                          className="w-4 h-4 rounded accent-[#ff5100] cursor-pointer disabled:opacity-40" />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>
      </main>
    </div>
  );
}
