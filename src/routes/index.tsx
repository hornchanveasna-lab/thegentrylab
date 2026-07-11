import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Split into two independent chunks so cm.thegentrylab.io never downloads the
// marketing homepage's code (and vice versa) — each hostname only fetches its own.
const IndustrialHomePage = lazy(() =>
  import("@/components/site/IndustrialHomePage").then((m) => ({ default: m.IndustrialHomePage }))
);
const CMIndexPage = lazy(() =>
  import("@/routes/cm/index").then((m) => ({ default: m.CMIndexPage }))
);

export const Route = createFileRoute("/")({
  component: RootRouteComponent,
});

/** cm.thegentrylab.io is the Construction Management App's own subdomain —
 *  render it directly at "/" (no client-side redirect to /cm, so the URL stays clean). */
function RootRouteComponent() {
  const isCM = typeof window !== "undefined" && window.location.hostname.startsWith("cm.");
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0b]" />}>
      {isCM ? <CMIndexPage /> : <IndustrialHomePage />}
    </Suspense>
  );
}
