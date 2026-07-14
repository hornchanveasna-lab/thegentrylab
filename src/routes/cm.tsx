import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/cm/BottomNav";

/** Pathless layout for every /cm/* route — renders the page via <Outlet />
 *  plus the persistent bottom nav, which hides itself on pre-auth flows. */
export const Route = createFileRoute("/cm")({
  component: () => (
    <>
      <Outlet />
      <BottomNav />
    </>
  ),
});
