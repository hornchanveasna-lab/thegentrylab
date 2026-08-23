import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Pathless layout for every /tender/* route — just renders the page via <Outlet />,
 *  matching /cm.tsx's convention. Auth/org gating happens per-page. */
export const Route = createFileRoute("/tender")({
  component: () => <Outlet />,
});
