/**
 * React Query hooks that fetch live data from Supabase.
 * Falls back to static seed data from platform.ts if Supabase is unavailable
 * or the environment variables are not configured.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import {
  SITES,
  PROJECTS,
  NEWS,
  RESEARCH,
  type MapSite,
  type TrackedProject,
  type NewsItem,
  type ResearchBrief,
} from "@/data/platform";

const STALE_TIME = 10 * 60 * 1000; // 10 minutes

/* ── Sites ──────────────────────────────────────────────── */
export function useMapSites() {
  return useQuery<MapSite[]>({
    queryKey: ["sites"],
    queryFn: async () => {
      if (!supabase) return SITES;
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .order("name");
      if (error || !data?.length) return SITES;
      // Map snake_case DB columns back to camelCase interface
      return data.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        layer: r.layer,
        province: r.province,
        lat: Number(r.lat),
        lng: Number(r.lng),
        size: r.size ?? undefined,
        status: r.status ?? undefined,
        utilities: r.utilities ?? undefined,
        road: r.road ?? undefined,
        notes: r.notes ?? undefined,
        score: r.score ?? undefined,
        strengths: r.strengths ?? undefined,
        constraints: r.constraints ?? undefined,
        targetIndustries: r.target_industries ?? undefined,
        recommendation: r.recommendation ?? undefined,
        image_url: r.image_url ?? undefined,
        photos: r.photos ?? undefined,
        coordVerified: r.coord_verified ?? undefined,
        eip_management: r.eip_management ?? undefined,
        eip_environmental: r.eip_environmental ?? undefined,
        eip_social: r.eip_social ?? undefined,
        eip_economic: r.eip_economic ?? undefined,
        eip_tier: r.eip_tier ?? undefined,
        port_distance_km: r.port_distance_km ?? undefined,
        elevation_m: r.elevation_m ?? undefined,
        flood_risk: r.flood_risk ?? undefined,
        // EIP energy fields — SEZ/park
        energy_tariff_usd: r.energy_tariff_usd ?? undefined,
        grid_uptime_pct: r.grid_uptime_pct ?? undefined,
        backup_power: r.backup_power ?? undefined,
        renewable_pct: r.renewable_pct ?? undefined,
        own_generation_mw: r.own_generation_mw ?? undefined,
        substation_dist_km: r.substation_dist_km ?? undefined,
        grid_capacity_mw: r.grid_capacity_mw ?? undefined,
        energy_policy: r.energy_policy ?? undefined,
        tenant_metering: r.tenant_metering ?? undefined,
        // Energy layer fields — powerplants / substations
        capacity_mw: r.capacity_mw ?? undefined,
        energy_type: r.energy_type ?? undefined,
        voltage_kv: r.voltage_kv ?? undefined,
        provinces_served: r.provinces_served ?? undefined,
        seasonal_output_pct: r.seasonal_output_pct ?? undefined,
        operator: r.operator ?? undefined,
        year_commissioned: r.year_commissioned ?? undefined,
        website: r.website ?? undefined,
        phone: r.phone ?? undefined,
        tenant_count: r.tenant_count ?? undefined,
        country_count: r.country_count ?? undefined,
        employee_count: r.employee_count ?? undefined,
        export_value_usd: r.export_value_usd ?? undefined,
        stock_ticker: r.stock_ticker ?? undefined,
        on_site_facilities: r.on_site_facilities ?? undefined,
        airport_distance_km: r.airport_distance_km ?? undefined,
        city_distance_km: r.city_distance_km ?? undefined,
        nearest_port: r.nearest_port ?? undefined,
        nearest_airport: r.nearest_airport ?? undefined,
        rail_distance_km: r.rail_distance_km ?? undefined,
        nearest_rail: r.nearest_rail ?? undefined,
        border_distance_km: r.border_distance_km ?? undefined,
        nearest_border: r.nearest_border ?? undefined,
        source_tier: r.source_tier ?? undefined,
        confidence: r.confidence ?? undefined,
        field_provenance: r.field_provenance ?? undefined,
        zone_types: r.zone_types ?? undefined,
        lease_rate_usd: r.lease_rate_usd ?? undefined,
        plot_size_min_ha: r.plot_size_min_ha ?? undefined,
        data_source_url: r.data_source_url ?? undefined,
        data_verified_at: r.data_verified_at ?? undefined,
        boundary: r.boundary ?? null,
      })) as MapSite[];
    },
    staleTime: STALE_TIME,
  });
}

/* ── Projects ───────────────────────────────────────────── */
export function useProjects() {
  return useQuery<TrackedProject[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      if (!supabase) return PROJECTS;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated", { ascending: false });
      if (error || !data?.length) return PROJECTS;
      return data as TrackedProject[];
    },
    staleTime: STALE_TIME,
  });
}

/* ── News ───────────────────────────────────────────────── */
export function useNews() {
  return useQuery<NewsItem[]>({
    queryKey: ["news"],
    queryFn: async () => {
      if (!supabase) return NEWS;
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .order("date", { ascending: false })
        .limit(50);
      if (error || !data?.length) return NEWS;
      return data as NewsItem[];
    },
    staleTime: STALE_TIME,
  });
}

/* ── Research ───────────────────────────────────────────── */
export function useResearch() {
  return useQuery<ResearchBrief[]>({
    queryKey: ["research"],
    queryFn: async () => {
      if (!supabase) return RESEARCH;
      const { data, error } = await supabase
        .from("research")
        .select("*")
        .order("title");
      if (error || !data?.length) return RESEARCH;
      return data as ResearchBrief[];
    },
    staleTime: STALE_TIME,
  });
}

/* ── Site images ────────────────────────────────────────── */
export interface SiteImage {
  id: string;
  site_id: string;
  url: string;
  caption?: string;
  source?: string;
  sort_order: number;
  created_at: string;
}

export function useSiteImages(siteId: string | null) {
  return useQuery<SiteImage[]>({
    queryKey: ["site_images", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      if (!supabase || !siteId) return [];
      const { data, error } = await supabase
        .from("site_images")
        .select("*")
        .eq("site_id", siteId)
        .order("sort_order");
      if (error) return [];
      return data as SiteImage[];
    },
    staleTime: STALE_TIME,
  });
}

export async function addSiteImage(img: Omit<SiteImage, "id" | "created_at">) {
  if (!supabase) throw new Error("No supabase client");
  const { error } = await supabase.from("site_images").insert(img);
  if (error) throw error;
}

export async function deleteSiteImage(id: string) {
  if (!supabase) throw new Error("No supabase client");
  const { error } = await supabase.from("site_images").delete().eq("id", id);
  if (error) throw error;
}

export async function updateSiteField(siteId: string, patch: Record<string, unknown>) {
  if (!supabase) throw new Error("No supabase client");
  const { error } = await supabase.from("sites").update(patch).eq("id", siteId);
  if (error) throw error;
}

/* ── Data quality summary (Phase 4 — for methodology page) ── */
export interface DataQuality {
  total_sites: number;
  coords_verified: number;
  coords_verified_pct: number;
  tier1_official: number;
  tier2_reputable: number;
  tier3_estimated: number;
  conf_high: number;
  conf_medium: number;
  conf_low: number;
  has_source_url: number;
  stale_or_unchecked: number;
}

export function useDataQuality() {
  return useQuery<DataQuality | null>({
    queryKey: ["data-quality"],
    queryFn: async () => {
      if (!supabase) return null;
      const { data, error } = await supabase.from("data_quality_summary").select("*").single();
      if (error) return null;
      return data as DataQuality;
    },
    staleTime: STALE_TIME,
  });
}

/* ── Connection status (for dashboard) ─────────────────── */
export function useSupabaseStatus() {
  return useQuery({
    queryKey: ["supabase-status"],
    queryFn: async () => {
      if (!supabase) return { connected: false, counts: null };
      try {
        const [sites, projects, news, research] = await Promise.all([
          supabase.from("sites").select("*", { count: "exact", head: true }),
          supabase.from("projects").select("*", { count: "exact", head: true }),
          supabase.from("news").select("*", { count: "exact", head: true }),
          supabase.from("research").select("*", { count: "exact", head: true }),
        ]);
        return {
          connected: true,
          counts: {
            sites: sites.count ?? 0,
            projects: projects.count ?? 0,
            news: news.count ?? 0,
            research: research.count ?? 0,
          },
        };
      } catch {
        return { connected: false, counts: null };
      }
    },
    staleTime: 60 * 1000,
    retry: 1,
  });
}
