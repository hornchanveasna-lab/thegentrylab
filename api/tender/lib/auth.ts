/**
 * Auth + org-membership check shared by every /api/tender/*.ts endpoint.
 * These endpoints use the service role key (bypasses RLS) so they can read
 * across an org's data in one call — which means each one MUST verify the
 * caller's org membership itself, since RLS isn't doing it for them.
 */
export interface TenderEnv {
  supabaseUrl: string;
  serviceKey: string;
}

export function getTenderEnv(): TenderEnv | null {
  const supabaseUrl = process.env.VITE_TENDER_SUPABASE_URL;
  const serviceKey = process.env.TENDER_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return { supabaseUrl, serviceKey };
}

export async function getAuthedUserId(env: TenderEnv, authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: env.serviceKey },
    });
    if (!res.ok) return null;
    const { id } = await res.json();
    return id ?? null;
  } catch {
    return null;
  }
}

async function sbGet<T>(env: TenderEnv, path: string): Promise<T[]> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sbPatch(env: TenderEnv, path: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function sbPost<T>(env: TenderEnv, path: string, body: Record<string, unknown> | Record<string, unknown>[]): Promise<T> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Returns the tender's org_id if `userId` is a member of it, otherwise null. */
export async function authorizeTenderAccess(env: TenderEnv, tenderId: string, userId: string): Promise<string | null> {
  const tenders = await sbGet<{ org_id: string }>(env, `tenders?id=eq.${tenderId}&select=org_id`);
  const orgId = tenders[0]?.org_id;
  if (!orgId) return null;
  const members = await sbGet<{ user_id: string }>(env, `organization_members?org_id=eq.${orgId}&user_id=eq.${userId}&select=user_id`);
  return members.length > 0 ? orgId : null;
}

export async function downloadStorageObject(env: TenderEnv, bucket: string, path: string): Promise<Buffer> {
  const res = await fetch(`${env.supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
  });
  if (!res.ok) throw new Error(`Storage download failed (${res.status}): ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

export { sbGet };
