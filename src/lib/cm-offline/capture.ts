import {
  stampAndUploadCMPhotos,
  findOrCreateCMDailyLog,
  updateCMDailyLog,
  mergeDuplicateCMDailyLogs,
  fetchCMDailyLogsList,
  type CMDeliveryRow,
  type CMManpowerRow,
  type CMDelayRow,
  type CMVisitorRow,
} from "@/lib/cm-data";
import {
  enqueueOutboxJob,
  listOutboxJobs,
  updateOutboxJob,
  deleteOutboxJob,
  subscribeOutbox,
  type OutboxJob,
  type DailyLogWriteJob,
  type PhotoNoteJob,
  type DailyLogWritePurpose,
} from "./outbox";

export { subscribeOutbox, listOutboxJobs, retryOutboxJob } from "./outbox";
export type { OutboxJob } from "./outbox";

export interface DailyLogWriteParams {
  ownerId: string;
  projectId: string;
  date: string;
  purpose: DailyLogWritePurpose;
  noteText: string;
  company: string | null;
  count: number;
  hoursLost: number;
  delayCause: DailyLogWriteJob["payload"]["delayCause"];
  urls: string[];
  thumbs: string[];
}

/** The purpose-specific branch of `CaptureSheet.handleSave`, pulled out so
 *  both the direct online save and the offline-outbox sync processor apply
 *  the exact same write. */
export async function applyDailyLogWrite(p: DailyLogWriteParams): Promise<void> {
  const log = await findOrCreateCMDailyLog(p.ownerId, p.projectId, p.date);
  if (p.urls.length > 0) {
    await updateCMDailyLog(log.id, {
      photos: [...log.photos, ...p.urls],
      photo_thumbs: [...log.photo_thumbs, ...p.thumbs],
    });
  }
  if (p.purpose === "progress") {
    const text = [log.activities, p.noteText].filter(Boolean).join("\n");
    await updateCMDailyLog(log.id, { activities: text || null });
  } else if (p.purpose === "delivery") {
    const row: CMDeliveryRow = {
      material: p.noteText,
      quantity: "",
      unit: null,
      supplier: p.company,
      boq_item_id: null,
      photos: p.urls,
      photo_thumbs: p.thumbs,
      status: "Reported",
      certified_quantity: null,
    };
    await updateCMDailyLog(log.id, { deliveries: [...log.deliveries, row] });
  } else if (p.purpose === "manpower") {
    const row: CMManpowerRow = {
      trade: p.noteText,
      company: p.company,
      count: p.count,
      roster_item_id: null,
    };
    await updateCMDailyLog(log.id, { manpower: [...log.manpower, row] });
  } else if (p.purpose === "equipment") {
    const text = [log.equipment_used, p.noteText].filter(Boolean).join("\n");
    await updateCMDailyLog(log.id, { equipment_used: text || null });
  } else if (p.purpose === "delay") {
    const row: CMDelayRow = {
      cause: p.delayCause,
      description: p.noteText,
      hours_lost: p.hoursLost,
    };
    await updateCMDailyLog(log.id, { delays: [...log.delays, row] });
  } else if (p.purpose === "visitor") {
    const row: CMVisitorRow = {
      name: p.noteText,
      organization: p.company,
      kind: "visitor",
      note: "",
      photos: p.urls,
      photo_thumbs: p.thumbs,
    };
    await updateCMDailyLog(log.id, { visitors: [...log.visitors, row] });
  } else {
    const text = [log.notes, p.noteText].filter(Boolean).join("\n");
    await updateCMDailyLog(log.id, { notes: text || null });
  }
}

/** Tries the direct online path (upload + write) first; only falls back to
 *  the IndexedDB outbox if the device is offline or the direct attempt
 *  fails (network drop mid-save). This is Phase 1's whole offline strategy:
 *  no service worker, just "try now, queue on failure, sync on reconnect." */
export async function captureOfflineAware(
  ownerId: string,
  projectId: string,
  files: File[],
  applyWrite: (urls: string[], thumbs: string[]) => Promise<void>,
  enqueueJob: () => Promise<void>,
): Promise<"synced" | "queued"> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await enqueueJob();
    return "queued";
  }
  try {
    const uploaded = await stampAndUploadCMPhotos(ownerId, projectId, files, new Date());
    await applyWrite(
      uploaded.map((u) => u.url),
      uploaded.map((u) => u.thumbUrl),
    );
    return "synced";
  } catch {
    await enqueueJob();
    return "queued";
  }
}

export function enqueueDailyLogWriteJob(
  job: Omit<DailyLogWriteJob, "kind" | "status" | "attempts">,
): Promise<void> {
  return enqueueOutboxJob({ ...job, kind: "daily-log-write", status: "pending", attempts: 0 });
}

export function enqueuePhotoNoteJob(
  job: Omit<PhotoNoteJob, "kind" | "status" | "attempts">,
): Promise<void> {
  return enqueueOutboxJob({ ...job, kind: "photo-note", status: "pending", attempts: 0 });
}

async function processDailyLogWriteJob(job: DailyLogWriteJob): Promise<void> {
  const uploaded = await stampAndUploadCMPhotos(
    job.ownerId,
    job.projectId,
    job.payload.files,
    new Date(job.createdAt),
  );
  await applyDailyLogWrite({
    ownerId: job.ownerId,
    projectId: job.projectId,
    date: job.payload.date,
    purpose: job.payload.purpose,
    noteText: job.payload.noteText,
    company: job.payload.company,
    count: job.payload.count,
    hoursLost: job.payload.hoursLost,
    delayCause: job.payload.delayCause,
    urls: uploaded.map((u) => u.url),
    thumbs: uploaded.map((u) => u.thumbUrl),
  });
}

export async function applyPhotoNoteWrite(
  ownerId: string,
  projectId: string,
  date: string,
  caption: string,
  urls: string[],
  thumbs: string[],
): Promise<void> {
  const log = await findOrCreateCMDailyLog(
    ownerId,
    projectId,
    date,
    caption ? { notes: caption } : undefined,
  );
  if (urls.length > 0) {
    await updateCMDailyLog(log.id, {
      photos: [...log.photos, ...urls],
      photo_thumbs: [...log.photo_thumbs, ...thumbs],
    });
  }
}

async function processPhotoNoteJob(job: PhotoNoteJob): Promise<void> {
  const uploaded = await stampAndUploadCMPhotos(
    job.ownerId,
    job.projectId,
    job.payload.files,
    new Date(job.createdAt),
  );
  await applyPhotoNoteWrite(
    job.ownerId,
    job.projectId,
    job.payload.date,
    job.payload.caption,
    uploaded.map((u) => u.url),
    uploaded.map((u) => u.thumbUrl),
  );
}

let syncing = false;

/** Drains every pending/failed job in the outbox, in creation order, one at
 *  a time (safer than parallel for jobs against the same day's log row).
 *  After a project's jobs finish, runs the existing duplicate-log merge —
 *  offline queuing makes the pre-existing same-day race more likely, and
 *  this reuses the fix that already exists for it rather than building new
 *  conflict UI. No-ops if a sync is already running or the device is
 *  offline. */
export async function syncOutbox(): Promise<void> {
  if (syncing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  syncing = true;
  try {
    const jobs = (await listOutboxJobs()).filter((j) => j.status !== "syncing");
    const touchedProjects = new Set<string>();
    for (const job of jobs) {
      await updateOutboxJob(job.id, { status: "syncing" });
      try {
        if (job.kind === "daily-log-write") await processDailyLogWriteJob(job);
        else await processPhotoNoteJob(job);
        await deleteOutboxJob(job.id);
        touchedProjects.add(job.projectId);
      } catch (err) {
        await updateOutboxJob(job.id, {
          status: "failed",
          attempts: job.attempts + 1,
          lastError: err instanceof Error ? err.message : "Sync failed",
        });
      }
    }
    for (const projectId of touchedProjects) {
      const logs = await fetchCMDailyLogsList(projectId);
      await mergeDuplicateCMDailyLogs(logs);
    }
  } finally {
    syncing = false;
  }
}

let wired = false;
/** Call once (from the root layout) to sync on load and whenever the
 *  browser regains connectivity. Idempotent — safe to call from multiple
 *  mounts in dev/HMR. */
export function wireOutboxAutoSync(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", () => void syncOutbox());
  void syncOutbox();
}

export type { OutboxJobKind, DailyLogWriteJob, PhotoNoteJob, DailyLogWritePurpose } from "./outbox";
