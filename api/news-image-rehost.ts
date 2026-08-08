/**
 * news-image-rehost.ts — Downloads a news article's external image and
 * re-hosts it in Supabase Storage, so the platform stops depending on
 * source-site links that go dead over time.
 *
 * POST { id: string }              → re-hosts one news row's current image
 * POST { all: true, limit?: n }    → re-hosts every news row still pointing
 *                                     at an external (non-Supabase) image
 *
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "news-images";

function extFromUrl(url: string, contentType: string | null): string {
  const fromUrl = url.split("?")[0].match(/\.(jpg|jpeg|png|webp|gif)$/i)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("gif")) return "gif";
  return "jpg";
}

async function rehostOne(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: { id: string; image_url: string | null },
): Promise<{ id: string; status: "skipped" | "rehosted" | "failed"; reason?: string }> {
  const src = row.image_url;
  if (!src) return { id: row.id, status: "skipped", reason: "no image_url" };
  if (src.includes(".supabase.co/storage/")) return { id: row.id, status: "skipped", reason: "already rehosted" };

  let res: Response;
  try {
    res = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0 (compatible; GentryLabBot/1.0)" } });
  } catch (e) {
    return { id: row.id, status: "failed", reason: e instanceof Error ? e.message : "fetch failed" };
  }
  if (!res.ok) return { id: row.id, status: "failed", reason: `source returned ${res.status}` };

  const buf = Buffer.from(await res.arrayBuffer());
  const ext = extFromUrl(src, res.headers.get("content-type"));
  const path = `${row.id}.${ext}`;

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: res.headers.get("content-type") ?? `image/${ext === "jpg" ? "jpeg" : ext}`,
    upsert: true,
  });
  if (uploadErr) return { id: row.id, status: "failed", reason: uploadErr.message };

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error: updateErr } = await supabase.from("news").update({ image_url: pub.publicUrl }).eq("id", row.id);
  if (updateErr) return { id: row.id, status: "failed", reason: updateErr.message };

  return { id: row.id, status: "rehosted" };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: "Not configured" });
  const supabase = createClient(supabaseUrl, serviceKey);

  const { id, all, limit } = req.body ?? {};

  if (id) {
    const { data: row, error } = await supabase.from("news").select("id, image_url").eq("id", id).single();
    if (error || !row) return res.status(404).json({ error: "News item not found" });
    const result = await rehostOne(supabase, row as { id: string; image_url: string | null });
    return res.status(200).json({ result });
  }

  if (all) {
    const { data: rows, error } = await supabase
      .from("news")
      .select("id, image_url")
      .not("image_url", "is", null)
      .not("image_url", "ilike", "%.supabase.co/storage/%")
      .limit(typeof limit === "number" ? limit : 20);
    if (error) return res.status(500).json({ error: "Could not load news rows" });

    const results = [];
    for (const row of rows as { id: string; image_url: string | null }[]) {
      results.push(await rehostOne(supabase, row));
    }
    return res.status(200).json({ results });
  }

  return res.status(400).json({ error: "Provide either { id } or { all: true }" });
}
