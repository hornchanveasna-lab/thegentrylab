import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Pathless layout for /research and its children (e.g. the free
 * SEZ Landscape brief at /research/sez-landscape-2026).
 *
 * This file must exist so TanStack Router's file-based routing has a
 * layout to nest research.index.tsx (the grid) and
 * research.sez-landscape-2026.tsx (the free brief) under — without it,
 * navigating to a child route silently renders nothing extra (no
 * Outlet to slot the child into). It intentionally renders only
 * <Outlet /> — no shared chrome — so each child page is a fully
 * standalone page, not wrapped in extra layout markup.
 */
export const Route = createFileRoute("/research")({
  component: () => <Outlet />,
});
