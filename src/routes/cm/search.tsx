import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { BackButton, ProjectPicker, useSelectedProject, EmptyState, setLastProject } from "@/components/cm/shared";
import { useCMGlobalSearch, type CMSearchResult } from "@/lib/cm-data";

export const Route = createFileRoute("/cm/search")({
  head: () => ({ meta: [{ title: "Search — Construction Management App" }] }),
  component: CMSearchPage,
});

const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";

const SEARCH_MODULE_COLOR: Record<CMSearchResult["module"], string> = {
  siteDiary: "#3b82f6", inspection: "#22c55e", punchList: "#a855f7", safety: "#ef4444", submittal: "#06b6d4",
  equipment: "#f59e0b", boq: "#84cc16", schedule: "#ec4899",
};

function CMSearchPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const navigate = useNavigate();
  const { projects, projectId, setProjectId } = useSelectedProject(user?.id);
  const [query, setQuery] = useState("");
  const results = useCMGlobalSearch(projectId || undefined, query);

  const goTo = (to: string) => {
    if (projectId) setLastProject(projectId);
    navigate({ to });
  };

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()} className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold" style={{ backgroundColor: "#ff5100" }}>
          {t("common.signInGoogle")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-5">
          <BackButton to="/cm" />
          <h1 className="text-xl font-extrabold tracking-tight text-white flex-1 truncate">{t("search.title")}</h1>
        </div>

        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          autoFocus
          className={`${inputCls} mb-4`}
        />

        {!query.trim() && <p className="text-white/30 text-[13px] text-center py-10">{t("search.prompt")}</p>}

        {query.trim() && results.length === 0 && <EmptyState message={t("search.noResults")} />}

        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((r) => (
              <Link key={`${r.module}-${r.id}`} to={r.to} onClick={() => goTo(r.to)}
                className="flex items-center gap-3 rounded-xl bg-[#0d0d0e] hover:bg-[#111113] transition-colors px-4 py-3">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SEARCH_MODULE_COLOR[r.module] }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-white/85 truncate">{r.title}</p>
                  <p className="font-mono text-[10px] text-white/30 truncate">
                    {[t(`search.module.${r.module}`), r.docNumber, r.subtitle].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-white/25 shrink-0">›</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
