import { Link } from "@tanstack/react-router";

interface AppTileProps {
  label: string;
  icon: React.ReactNode;
  to: string;
}

export function AppTile({ label, icon, to }: AppTileProps) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-2 py-3 px-1 rounded-2xl active:scale-95 transition-transform"
    >
      <span className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-white/5 border border-white/7 text-white/70">
        {icon}
      </span>
      <span className="text-[11px] font-medium text-text-muted text-center leading-tight">{label}</span>
    </Link>
  );
}
