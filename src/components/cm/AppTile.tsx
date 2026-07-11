import { Link } from "@tanstack/react-router";

interface AppTileProps {
  label: string;
  icon: React.ReactNode;
  to: string;
}

export function AppTile({ label, icon, to }: AppTileProps) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 group">
      <div
        className="w-16 h-16 rounded-[22px] flex items-center justify-center text-white transition-transform active:scale-90 group-hover:brightness-110"
        style={{ backgroundColor: "#ff5100" }}
      >
        {icon}
      </div>
      <span className="text-[11px] font-medium text-white/75 text-center leading-tight">{label}</span>
    </Link>
  );
}
