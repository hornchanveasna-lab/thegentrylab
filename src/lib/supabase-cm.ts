import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_CM_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_CM_SUPABASE_ANON_KEY as string | undefined;

/** Fully separate Supabase project for the Construction Management App —
 *  its own auth.users, not shared with thegentrylab's main Supabase project. */
export const supabaseCM = url && key
  ? createClient(url, key, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        storage: window.localStorage,
        storageKey: "cm-auth",
      },
    })
  : null;
