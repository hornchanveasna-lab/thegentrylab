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
      className="flex flex-col items-center justify-center gap-2.5 py-7 px-1 border-r border-b border-white/[0.07] text-white/85 active:bg-white/[0.05] transition-colors"
    >
      {icon}
      <span className="text-[11px] font-medium text-white/65 text-center leading-tight">{label}</span>
    </Link>
  );
}
