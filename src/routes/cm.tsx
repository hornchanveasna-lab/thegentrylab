import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Pathless layout for every /cm/* route — just renders the page via <Outlet />. */
export const Route = createFileRoute("/cm")({
  component: () => <Outlet />,
});
