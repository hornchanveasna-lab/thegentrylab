import {
  useCMProject,
  useCMProjectMembers,
  useCMRolePermissions,
  type CMJobRole,
  type CMMemberRole,
  type CMModuleKey,
  type CMPermissionAction,
  type CMRolePermission,
} from "./cm-data";

/** Pure decision function — kept separate from the live-data hook below so
 *  it's trivially testable without React Query. A missing matrix row (or
 *  job_role === null) is always permissive: mirrors the cm_role_permission()
 *  RLS fallback, so a matrix gap can never silently lock someone out. */
export function hasPermission(
  tierRole: CMMemberRole | "owner" | undefined,
  jobRole: CMJobRole | null | undefined,
  matrix: CMRolePermission[] | undefined,
  moduleKey: CMModuleKey,
  action: CMPermissionAction,
): boolean {
  if (!tierRole) return false;
  if (tierRole === "owner") return true;
  if ((moduleKey === "people" || moduleKey === "settings") && tierRole === "admin") return true;
  if (tierRole === "visitor" && action !== "view") return false;
  if (!jobRole) return true;
  const row = matrix?.find((p) => p.job_role === jobRole && p.module_key === moduleKey);
  if (!row) return true;
  switch (action) {
    case "view": return row.can_view;
    case "create": return row.can_create;
    case "edit": return row.can_edit;
    case "approve": return row.can_approve;
    case "delete": return row.can_delete;
  }
}

export function usePermission(
  projectId: string | undefined,
  userId: string | undefined,
  moduleKey: CMModuleKey,
  action: CMPermissionAction,
): boolean {
  const { data: project } = useCMProject(projectId);
  const { data: members } = useCMProjectMembers(projectId);
  const { data: matrix } = useCMRolePermissions();
  const me = members?.find((m) => m.user_id === userId);
  const tierRole: CMMemberRole | "owner" | undefined =
    project && userId && project.owner_id === userId ? "owner" : me?.role;
  return hasPermission(tierRole, me?.job_role ?? null, matrix, moduleKey, action);
}
