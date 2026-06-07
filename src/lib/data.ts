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
