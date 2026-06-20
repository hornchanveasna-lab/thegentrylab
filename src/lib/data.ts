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
