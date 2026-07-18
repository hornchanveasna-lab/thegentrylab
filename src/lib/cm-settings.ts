import type { QueryClient } from "@tanstack/react-query";
import {
  type CMAccountSettings, type CMProject, type CMModuleKey,
  upsertCMAccountSettings, updateCMProject, logCMActivity,
} from "@/lib/cm-data";

/** Which tier of the Global / Project / Module hierarchy a setting's value
 *  lives at. Only these two are populated today — every existing setting
 *  lives at exactly one of them, with no live case yet of a module value
 *  needing to fall back through a project override before reaching the
 *  global default. A genuine multi-tier cascade (e.g. Photos becoming
 *  project-overridable) is a deliberate follow-up, not built here. */
export type SettingScope = "GLOBAL" | "PROJECT_MODULE";
export type SettingValueType = "boolean" | "string" | "number" | "enum";

export interface SettingDefinition<T> {
  key: string;
  category: string;
  scope: SettingScope;
  moduleKey?: CMModuleKey;
  valueType: SettingValueType;
  defaultValue: T;
  /** GLOBAL scope only — read the current value off the account row. */
  getGlobal?: (account: CMAccountSettings | null | undefined) => T | undefined;
  /** GLOBAL scope only — build the cm_account_settings patch for a new value. */
  patchGlobal?: (value: T) => Partial<CMAccountSettings>;
  /** PROJECT_MODULE scope only — read the current value off the project row. */
  getModule?: (project: CMProject) => T | undefined;
  /** PROJECT_MODULE scope only — build the cm_projects patch for a new value. */
  patchModule?: (project: CMProject, value: T) => Partial<CMProject>;
}

export interface ResolvedSetting<T> {
  value: T;
  defaultValue: T;
  source: "global" | "module" | "default";
  isOverridden: boolean;
}

/** Resolves a setting's live value against wherever it's actually stored,
 *  falling back to the coded default when nothing is stored yet. */
export function resolveSetting<T>(
  def: SettingDefinition<T>,
  ctx: { account?: CMAccountSettings | null; project?: CMProject | null },
): ResolvedSetting<T> {
  if (def.scope === "PROJECT_MODULE" && def.getModule && ctx.project) {
    const moduleVal = def.getModule(ctx.project);
    if (moduleVal !== undefined) {
      return { value: moduleVal, defaultValue: def.defaultValue, source: "module", isOverridden: true };
    }
  }
  if (def.scope === "GLOBAL" && def.getGlobal) {
    const globalVal = def.getGlobal(ctx.account);
    if (globalVal !== undefined) {
      return { value: globalVal, defaultValue: def.defaultValue, source: "global", isOverridden: globalVal !== def.defaultValue };
    }
  }
  return { value: def.defaultValue, defaultValue: def.defaultValue, source: "default", isOverridden: false };
}

/** Writes a setting's new value to wherever it's actually stored, and
 *  records a "setting_changed" audit-log entry for module-scoped changes
 *  (global/account-scoped changes have no project to attach the entry to). */
export async function setSettingValue<T>(
  def: SettingDefinition<T>,
  value: T,
  ctx: { ownerId: string; project?: CMProject; actorId: string },
): Promise<void> {
  if (def.scope === "GLOBAL") {
    if (!def.patchGlobal) throw new Error(`Setting "${def.key}" has no GLOBAL writer`);
    await upsertCMAccountSettings(ctx.ownerId, def.patchGlobal(value));
    return;
  }
  if (!def.patchModule || !ctx.project) throw new Error(`Setting "${def.key}" requires a project`);
  await updateCMProject(ctx.project.id, def.patchModule(ctx.project, value));
  logCMActivity(ctx.project.id, ctx.actorId, "setting_changed", "setting", def.key, { key: def.key, value });
}

export function resetSettingToDefault<T>(
  def: SettingDefinition<T>,
  ctx: { ownerId: string; project?: CMProject; actorId: string },
): Promise<void> {
  return setSettingValue(def, def.defaultValue, ctx);
}

/** The one call a quick-settings row needs: optimistically patches the
 *  right React Query cache entry so the UI updates instantly, writes the
 *  new value to its real storage location, then invalidates that cache
 *  entry to reconcile with the server — same shape as Photos' original
 *  hand-rolled `toggle()`, generalized across every registered setting. */
export async function writeSettingAndSync<T>(
  def: SettingDefinition<T>,
  value: T,
  ctx: { ownerId: string; project?: CMProject; actorId: string },
  queryClient: QueryClient,
): Promise<void> {
  if (def.scope === "PROJECT_MODULE" && ctx.project && def.patchModule) {
    const patch = def.patchModule(ctx.project, value);
    queryClient.setQueryData(["cm_project", ctx.project.id], (old: CMProject | null | undefined) => (old ? { ...old, ...patch } : old));
  } else if (def.scope === "GLOBAL" && def.patchGlobal) {
    const patch = def.patchGlobal(value);
    queryClient.setQueryData(["cm_account_settings", ctx.ownerId], (old: CMAccountSettings | null | undefined) => (old ? { ...old, ...patch } : old));
  }
  await setSettingValue(def, value, ctx);
  if (ctx.project) queryClient.invalidateQueries({ queryKey: ["cm_project", ctx.project.id] });
  else queryClient.invalidateQueries({ queryKey: ["cm_account_settings", ctx.ownerId] });
}

/** Builds a PROJECT_MODULE-scope definition backed by `cm_projects.module_defaults[moduleKey][subKey]`. */
function moduleDefault<T>(
  moduleKey: CMModuleKey, subKey: string, defaultValue: T, category: string,
): SettingDefinition<T> {
  return {
    key: `${moduleKey}.${subKey}`,
    category,
    scope: "PROJECT_MODULE",
    moduleKey,
    valueType: typeof defaultValue === "boolean" ? "boolean" : "enum",
    defaultValue,
    getModule: (project) => (project.module_defaults?.[moduleKey]?.[subKey] as T | undefined),
    patchModule: (project, value) => ({
      module_defaults: {
        ...(project.module_defaults ?? {}),
        [moduleKey]: { ...(project.module_defaults?.[moduleKey] ?? {}), [subKey]: value },
      },
    }),
  };
}

export const SETTING_DEFINITIONS = {
  // GLOBAL — cm_account_settings (account-wide, all projects)
  photoShowCompanyLogo: {
    key: "photo.showCompanyLogo", category: "photoStamp", scope: "GLOBAL", valueType: "boolean", defaultValue: true,
    getGlobal: (a) => a?.photo_show_company_logo, patchGlobal: (v) => ({ photo_show_company_logo: v }),
  } satisfies SettingDefinition<boolean>,
  photoShowProjectInfo: {
    key: "photo.showProjectInfo", category: "photoStamp", scope: "GLOBAL", valueType: "boolean", defaultValue: true,
    getGlobal: (a) => a?.photo_show_project_info, patchGlobal: (v) => ({ photo_show_project_info: v }),
  } satisfies SettingDefinition<boolean>,
  photoShowConsultantLogos: {
    key: "photo.showConsultantLogos", category: "photoStamp", scope: "GLOBAL", valueType: "boolean", defaultValue: true,
    getGlobal: (a) => a?.photo_show_consultant_logos, patchGlobal: (v) => ({ photo_show_consultant_logos: v }),
  } satisfies SettingDefinition<boolean>,
  photoMonotoneLogos: {
    key: "photo.monotoneLogos", category: "photoStamp", scope: "GLOBAL", valueType: "boolean", defaultValue: false,
    getGlobal: (a) => a?.photo_monotone_logos, patchGlobal: (v) => ({ photo_monotone_logos: v }),
  } satisfies SettingDefinition<boolean>,
  photoTimestamp: {
    key: "photo.timestamp", category: "photoStamp", scope: "GLOBAL", valueType: "boolean", defaultValue: true,
    getGlobal: (a) => a?.photo_timestamp, patchGlobal: (v) => ({ photo_timestamp: v }),
  } satisfies SettingDefinition<boolean>,

  // PROJECT_MODULE — cm_projects.module_defaults (per project, per module)
  punchListPriority: moduleDefault("punch_list", "priority", "Medium", "defaults"),
  punchListRequireAfterPhoto: moduleDefault("punch_list", "requireAfterPhoto", true, "defaults"),
  safetyRecordType: moduleDefault("safety", "recordType", "Toolbox Talk", "defaults"),
  safetySeverity: moduleDefault("safety", "severity", "Low", "defaults"),
  submittalType: moduleDefault("submittal", "type", "", "defaults"),
  instructionsSourceType: moduleDefault("instructions", "sourceType", "Consultant", "defaults"),
  instructionsPriority: moduleDefault("instructions", "priority", "Medium", "defaults"),
  inspectionType: moduleDefault("inspection", "type", "", "defaults"),
  contractsContractType: moduleDefault("contracts", "contractType", "Main Contract", "defaults"),
  contractsCurrency: moduleDefault("contracts", "currency", "", "defaults"),

  // PROJECT_MODULE — dedicated column, not module_defaults (Schedule predates the jsonb column)
  scheduleDelayThresholdPct: {
    key: "schedule.delayThresholdPct", category: "defaults", scope: "PROJECT_MODULE", moduleKey: "schedule",
    valueType: "number", defaultValue: 0,
    getModule: (project) => project.schedule_delay_threshold_pct,
    patchModule: (_project, value) => ({ schedule_delay_threshold_pct: value }),
  } satisfies SettingDefinition<number>,
} as const;
