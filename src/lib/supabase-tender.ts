import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_TENDER_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_TENDER_SUPABASE_ANON_KEY as string | undefined;

/** Exported for the raw-XHR upload path in tender-data.ts (real byte-level
 *  progress events — supabase-js's storage.upload() is fetch-based with no
 *  progress callback). */
export const TENDER_SUPABASE_URL = url;
export const TENDER_SUPABASE_ANON_KEY = key;

/** Fully separate Supabase project for TenderAI — its own auth.users, not
 *  shared with thegentrylab's main Supabase project or the CM app's. */
export const supabaseTender = url && key
  ? createClient(url, key, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        storage: window.localStorage,
        storageKey: "tender-auth",
      },
    })
  : null;
