import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        flowType: "pkce",
        // Disabled so the callback page can do the exchange manually without conflict.
        // Supabase v2.107+ auto-exchanges when true, causing a double-call race condition.
        detectSessionInUrl: false,
        persistSession: true,
        storage: window.localStorage,
      },
    })
  : null;
