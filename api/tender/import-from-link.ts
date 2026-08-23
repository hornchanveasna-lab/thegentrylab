/**
 * Import a tender document from a share link (Google Drive, OneDrive/
 * SharePoint, or any direct-download URL) instead of a local file upload —
 * tenders are frequently distributed this way instead of as attachments.
 * Normalizes the common share-link formats to their direct-download form,
 * fetches the bytes server-side (avoids the CORS block a client-side fetch
 * would hit), stores them in the same "tender-documents" bucket a normal
 * upload uses, and inserts the same tender_documents row shape so the rest
 * of the pipeline (processTenderDocument, the Documents UI) doesn't need to
 * know the file didn't come from a local upload.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getTenderEnv, getAuthedUserId, authorizeTenderAccess, sbPost, uploadStorageObject } from "./lib/auth.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Rewrite known share-link hosts to a direct-download URL. Anything else is used as-is. */
function toDirectDownloadUrl(rawUrl: string): string {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return rawUrl; }

  // Google Drive: https://drive.google.com/file/d/<id>/view?... or ?id=<id>
  if (url.hostname === "drive.google.com") {
    const match = url.pathname.match(/\/file\/d\/([^/]+)/);
    const id = match?.[1] ?? url.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }

  // OneDrive personal share links (1drv.ms redirects to onedrive.live.com)
  if (url.hostname === "onedrive.live.com" || url.hostname === "1drv.ms") {
    if (!url.searchParams.has("download")) url.searchParams.set("download", "1");
    return url.toString();
  }

  // SharePoint / OneDrive for Business share links
  if (url.hostname.endsWith(".sharepoint.com")) {
    if (!url.searchParams.has("download")) url.searchParams.set("download", "1");
    return url.toString();
  }

  return rawUrl;
}

function fileNameFromResponse(res: Response, fallbackUrl: string, providedName?: string): string {
  if (providedName?.trim()) return providedName.trim();
  const disposition = res.headers.get("content-disposition");
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (match?.[1]) {
    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
  }
  try {
    const last = new URL(fallbackUrl).pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch { /* fall through */ }
  return "document";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const env = getTenderEnv();
  if (!env) return res.status(500).json({ error: "TenderAI backend not configured" });

  const userId = await getAuthedUserId(env, req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const tenderId = typeof req.body?.tenderId === "string" ? req.body.tenderId : "";
  const linkUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  const relativePath = typeof req.body?.relativePath === "string" && req.body.relativePath.trim()
    ? req.body.relativePath.trim() : undefined;
  if (!tenderId || !linkUrl) return res.status(400).json({ error: "Missing tenderId or url" });

  const orgId = await authorizeTenderAccess(env, tenderId, userId).catch(() => null);
  if (!orgId) return res.status(403).json({ error: "Not authorized for this tender" });

  let fetched: Response;
  try {
    fetched = await fetch(toDirectDownloadUrl(linkUrl), { redirect: "follow" });
  } catch (err) {
    return res.status(400).json({ error: "Could not reach that link", detail: err instanceof Error ? err.message : String(err) });
  }
  if (!fetched.ok) {
    return res.status(400).json({ error: `The link returned an error (${fetched.status}). Make sure it's set to "Anyone with the link can view".` });
  }

  const contentType = fetched.headers.get("content-type") ?? "application/octet-stream";
  const fileName = fileNameFromResponse(fetched, linkUrl, relativePath?.split("/").pop());
  const bytes = Buffer.from(await fetched.arrayBuffer());

  // A share link that requires sign-in or shows Drive's virus-scan/size-warning
  // interstitial serves an HTML page instead of the file — catch that early
  // with a clear message rather than storing a useless HTML blob.
  if (contentType.includes("text/html") && !fileName.toLowerCase().endsWith(".html")) {
    return res.status(400).json({
      error: "That link didn't return a downloadable file — it may require sign-in, be a folder link, or be a large Google Drive file needing a virus-scan confirmation. Share a direct single-file link with \"Anyone with the link can view\" access.",
    });
  }

  const storagePath = `${orgId}/${tenderId}/${crypto.randomUUID()}-${fileName}`;
  try {
    await uploadStorageObject(env, "tender-documents", storagePath, bytes, contentType);
  } catch (err) {
    return res.status(500).json({ error: "Failed to store the file", detail: err instanceof Error ? err.message : String(err) });
  }

  try {
    const [doc] = await sbPost<Record<string, unknown>[]>(env, "tender_documents", {
      tender_id: tenderId,
      storage_path: storagePath,
      relative_path: relativePath ?? fileName,
      file_name: fileName,
      file_type: (fileName.split(".").pop() ?? "other").toLowerCase(),
      file_size_bytes: bytes.length,
      uploaded_by: userId,
    });
    return res.status(200).json({ ok: true, document: doc });
  } catch (err) {
    return res.status(500).json({ error: "Failed to record the document", detail: err instanceof Error ? err.message : String(err) });
  }
}

export const config = { maxDuration: 60 };
