import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { AuthProvider } from "@/lib/auth";
import { AuthCMProvider } from "@/lib/auth-cm";
import { CMLangProvider } from "@/lib/cm-i18n";

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
        <h1 className="text-xl font-semibold tracking-tight text-white">
          This page didn't load
        </h1>
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
  const isCMApp = (typeof window !== "undefined" && window.location.hostname.startsWith("cm.")) || pathname.startsWith("/cm");

  return (
    <AuthProvider>
      <AuthCMProvider>
        <CMLangProvider>
          <QueryClientProvider client={queryClient}>
            <Outlet />
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
