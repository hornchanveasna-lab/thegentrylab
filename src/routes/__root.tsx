import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth";
import { AuthCMProvider, useAuthCM } from "@/lib/auth-cm";
import { CMLangProvider, useCMLang } from "@/lib/cm-i18n";
import { useCMAccountSettings, makeSquareIconDataUrl, extractDominantColor } from "@/lib/cm-data";
import {
  listOutboxJobs,
  subscribeOutbox,
  wireOutboxAutoSync,
  type OutboxJob,
} from "@/lib/cm-offline/capture";

// Only the main site uses this — lazy so cm.thegentrylab.io never fetches its code.
const AiChat = lazy(() => import("@/components/site/AiChat").then((m) => ({ default: m.AiChat })));

declare global {
  function gtag(...args: unknown[]): void;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-white">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-white">Page not found</h2>
        <p className="mt-2 text-sm text-white/50">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-mono uppercase tracking-widest bg-brand-accent text-black hover:brightness-110 transition"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    console.error("Root error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-white">This page didn't load</h1>
        <p className="mt-2 text-sm text-white/50">
          Something went wrong. You can try refreshing or head back home.
        </p>
        {error?.message && (
          <p className="mt-3 font-mono text-[10px] text-red-400/70 bg-red-900/10 border border-red-900/20 rounded px-3 py-2 text-left break-all">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-mono uppercase tracking-widest bg-brand-accent text-black hover:brightness-110 transition"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center border border-white/20 px-4 py-2 text-sm font-mono uppercase tracking-widest text-white hover:bg-white/5 transition"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

/** Swaps the favicon/home-screen-icon links to the signed-in CM user's own
 *  company logo (padded onto a square canvas), so a fresh "Add to Home
 *  Screen" install picks up their brand instead of the site's default icon.
 *  Browsers generally don't re-fetch the icon for an *already* installed
 *  shortcut, so this only takes effect on new installs — not a live push to
 *  icons already sitting on someone's home screen. */
function CMAppIconSync() {
  const { user } = useAuthCM();
  const { data: account } = useCMAccountSettings(user?.id);
  const logoUrl = account?.company_logo_url;

  useEffect(() => {
    if (!logoUrl) return;
    let cancelled = false;
    makeSquareIconDataUrl(logoUrl).then((dataUrl) => {
      if (cancelled || !dataUrl) return;
      for (const rel of ["icon", "apple-touch-icon", "shortcut icon"]) {
        let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
        if (!link) {
          link = document.createElement("link");
          link.rel = rel;
          document.head.appendChild(link);
        }
        link.href = dataUrl;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  return null;
}

const CM_DEFAULT_ACCENT = "#ff5100";

/** Pushes a resolved brand color onto :root as CSS custom properties that
 *  styles.css's --gradient-brand/--page-wash rules read — inline style on
 *  the root element always wins over any stylesheet selector, so this
 *  overrides the static per-theme defaults uniformly without needing to
 *  know which theme is active. */
function applyCMBrandColor(hex: string) {
  const root = document.documentElement.style;
  root.setProperty("--color-brand-accent", hex);
  root.setProperty("--gradient-brand", `linear-gradient(135deg, color-mix(in srgb, ${hex} 65%, white) 0%, ${hex} 55%, color-mix(in srgb, ${hex} 78%, black) 100%)`);
  root.setProperty("--page-wash-dark", `linear-gradient(180deg, color-mix(in srgb, ${hex} 26%, #0a0a0b) 0%, #0a0a0b 55%, color-mix(in srgb, ${hex} 14%, #0a0a0b) 100%)`);
  root.setProperty("--page-wash-light", `linear-gradient(180deg, color-mix(in srgb, ${hex} 20%, #faf7f2) 0%, #faf7f2 55%, color-mix(in srgb, ${hex} 9%, #faf7f2) 100%)`);
}

/** Resolves the CM app's brand accent — a manual override always wins when
 *  set, otherwise the color is auto-extracted from the company logo,
 *  otherwise the default orange — and pushes it onto :root so the whole
 *  app's gradients/accents follow the signed-in account's own branding. */
function CMBrandColorSync() {
  const { user } = useAuthCM();
  const { data: account } = useCMAccountSettings(user?.id);
  const manualColor = account?.brand_color_mode === "manual" ? account.brand_color : null;
  const logoUrl = account?.company_logo_url;

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    (async () => {
      const extracted = !manualColor && logoUrl ? await extractDominantColor(logoUrl) : null;
      if (cancelled) return;
      applyCMBrandColor(manualColor || extracted || CM_DEFAULT_ACCENT);
    })();
    return () => {
      cancelled = true;
    };
  }, [account, manualColor, logoUrl]);

  return null;
}

/** Small persistent indicator for the offline outbox (Site Diary + Photos
 *  captures made with no network). Hidden while the queue is empty; shows a
 *  "syncing" pill while jobs are pending/in-flight, or a "failed" pill once
 *  a job has exhausted a sync attempt — tapping either opens the full
 *  per-job list at /cm/sync-status. Auto-syncs on mount and whenever the
 *  browser regains connectivity (no service worker involved). */
function CMSyncStatusBadge() {
  const { t } = useCMLang();
  const [jobs, setJobs] = useState<OutboxJob[]>([]);

  useEffect(() => {
    wireOutboxAutoSync();
    let cancelled = false;
    const refresh = () => {
      listOutboxJobs().then((j) => {
        if (!cancelled) setJobs(j);
      });
    };
    refresh();
    const unsubscribe = subscribeOutbox(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (jobs.length === 0) return null;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const pending = jobs.length - failed;

  return (
    <Link
      to="/cm/sync-status"
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg transition-colors ${
        failed > 0 ? "bg-red-500 text-white" : "bg-amber-400 text-black"
      }`}
    >
      {failed > 0
        ? t("offline.failedPill", { count: String(failed) })
        : t("offline.syncingPill", { count: String(pending) })}
    </Link>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof gtag !== "undefined") {
      gtag("event", "page_view", {
        page_path: pathname,
        page_title: document.title,
      });
    }
  }, [pathname]);

  // The industrial-intelligence AI chat widget belongs to the main site only —
  // hide it on the Construction Management App (its own cm.thegentrylab.io subdomain, or /cm/*).
  const isCMApp =
    (typeof window !== "undefined" && window.location.hostname.startsWith("cm.")) ||
    pathname.startsWith("/cm");

  // Marks <html> so styles.css can scope CM-only rules (like its gradient
  // page background) without touching the main marketing site, which reuses
  // several of the same literal utility classes (e.g. bg-[#0a0a0b]) for its
  // own flat-color page backgrounds.
  useEffect(() => {
    document.documentElement.setAttribute("data-app", isCMApp ? "cm" : "site");
  }, [isCMApp]);

  return (
    <AuthProvider>
      <AuthCMProvider>
        <CMLangProvider>
          <QueryClientProvider client={queryClient}>
            <Outlet />
            {isCMApp && <CMAppIconSync />}
            {isCMApp && <CMBrandColorSync />}
            {isCMApp && <CMSyncStatusBadge />}
            {!isCMApp && (
              <Suspense fallback={null}>
                <AiChat />
              </Suspense>
            )}
          </QueryClientProvider>
        </CMLangProvider>
      </AuthCMProvider>
    </AuthProvider>
  );
}
