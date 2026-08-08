/**
 * sez-imagery.ts — Satellite land-use check for one SEZ/park site
 *
 * GET  /api/sez-imagery?site_id=xxx        → latest snapshot + short history
 * POST /api/sez-imagery { site_id }        → runs a fresh Sentinel-2 check,
 *                                             stores it, returns the result
 *
 * Requires GEE_SERVICE_ACCOUNT_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getBuiltUpStats } from "./lib/gee.js";

/** Parses a free-text size field like "118 ha" or "1,000+ ha (expanded...)" into hectares. */
function parseHectares(size: string | null): number | null {
  if (!size) return null;
  const match = size.replace(/,/g, "").match(/([\d.]+)\s*\+?\s*ha/i);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Not configured" });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  if (req.method === "GET") {
    const siteId = req.query.site_id;
    if (!siteId || typeof siteId !== "string") {
      return res.status(400).json({ error: "site_id is required" });
    }
    const { data, error } = await supabase
      .from("sez_imagery_snapshots")
      .select("*")
      .eq("site_id", siteId)
      .order("checked_at", { ascending: false })
      .limit(12);
    if (error) return res.status(500).json({ error: "Could not load snapshots" });
    return res.status(200).json({ snapshots: data });
  }

  if (req.method === "POST") {
    if (!process.env.GEE_SERVICE_ACCOUNT_KEY) {
      return res.status(501).json({
        error: "Satellite imagery is not configured yet. Add a Google Earth Engine service account key to enable this.",
      });
    }

    const siteId = req.body?.site_id;
    if (!siteId || typeof siteId !== "string") {
      return res.status(400).json({ error: "site_id is required" });
    }

    const { data: site, error: siteErr } = await supabase
      .from("sites")
      .select("id, lat, lng, boundary, size, plot_size_min_ha")
      .eq("id", siteId)
      .single();
    if (siteErr || !site) return res.status(404).json({ error: "Site not found" });

    const knownAreaHa = site.plot_size_min_ha ?? parseHectares(site.size);

    let stats;
    try {
      stats = await getBuiltUpStats({
        lat: Number(site.lat),
        lng: Number(site.lng),
        boundary: site.boundary,
        knownAreaHa,
      });
    } catch (e) {
      return res.status(502).json({ error: e instanceof Error ? e.message : "Satellite check failed" });
    }

    const { data: prior } = await supabase
      .from("sez_imagery_snapshots")
      .select("built_up_pct")
      .eq("site_id", siteId)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const changeVsPrior = prior?.built_up_pct != null
      ? Math.round((stats.builtUpPct - prior.built_up_pct) * 10) / 10
      : null;

    const { data: inserted, error: insertErr } = await supabase
      .from("sez_imagery_snapshots")
      .insert({
        site_id: siteId,
        image_date: stats.imageDate,
        built_up_pct: stats.builtUpPct,
        ndvi_mean: stats.ndviMean,
        change_vs_prior_pct: changeVsPrior,
        area_analyzed_ha: stats.areaAnalyzedHa,
        boundary_source: stats.boundarySource,
        source: "sentinel-2",
      })
      .select()
      .single();
    if (insertErr) return res.status(500).json({ error: "Could not save snapshot" });

    return res.status(200).json({ snapshot: inserted });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
