import { openDB, type IDBPDatabase } from "idb";
import type { CMDelayCause } from "@/lib/cm-data";

/** Two capture flows can happen with no network: the Site Diary CaptureSheet
 *  (photos plus one structured field write) and the standalone Photos-module
 *  quick capture (photos plus an optional caption). Each gets its own job
 *  kind rather than a generic mutation-queue framework, since those are the
 *  only two offline-capable writes in Phase 1 (Site Diary + Photos). */
export type OutboxJobKind = "daily-log-write" | "photo-note";

export type DailyLogWritePurpose =
  | "progress"
  | "delivery"
  | "manpower"
  | "equipment"
  | "delay"
  | "visitor"
  | "general";

interface OutboxJobBase {
  id: string;
  projectId: string;
  ownerId: string;
  createdAt: string;
  status: "pending" | "syncing" | "failed";
  attempts: number;
  lastError?: string;
}

export interface DailyLogWriteJob extends OutboxJobBase {
  kind: "daily-log-write";
  payload: {
    date: string;
    purpose: DailyLogWritePurpose;
    noteText: string;
    company: string | null;
    count: number;
    hoursLost: number;
    delayCause: CMDelayCause;
    files: File[];
  };
}

export interface PhotoNoteJob extends OutboxJobBase {
  kind: "photo-note";
  payload: { date: string; caption: string; files: File[] };
}

export type OutboxJob = DailyLogWriteJob | PhotoNoteJob;

const DB_NAME = "cm_outbox";
const STORE = "jobs";

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}
/** Lets `useOutboxStatus` (and anything else) re-render on queue changes
 *  without polling. Returns an unsubscribe function. */
export function subscribeOutbox(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function enqueueOutboxJob(job: OutboxJob): Promise<void> {
  const db = await getDB();
  await db.put(STORE, job);
  notify();
}

export async function listOutboxJobs(): Promise<OutboxJob[]> {
  const db = await getDB();
  return db.getAll(STORE);
}

export async function updateOutboxJob(id: string, patch: Partial<OutboxJob>): Promise<void> {
  const db = await getDB();
  const existing = await db.get(STORE, id);
  if (!existing) return;
  await db.put(STORE, { ...existing, ...patch });
  notify();
}

export async function deleteOutboxJob(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
  notify();
}

export async function retryOutboxJob(id: string): Promise<void> {
  await updateOutboxJob(id, { status: "pending", lastError: undefined });
}
