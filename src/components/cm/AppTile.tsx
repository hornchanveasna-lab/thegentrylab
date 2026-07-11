import { Link } from "@tanstack/react-router";

interface AppTileProps {
  label: string;
  count?: number;
  icon: React.ReactNode;
  to?: string;
  onClick?: () => void;
}

export function AppTile({ label, count, icon, to, onClick }: AppTileProps) {
  const inner = (
    <>
      <div
        className="w-16 h-16 rounded-[22px] flex items-center justify-center text-white transition-transform active:scale-90 group-hover:brightness-110"
        style={{ backgroundColor: "#ff5100" }}
      >
        {icon}
      </div>
      <span className="text-[11px] font-medium text-white/75 text-center leading-tight">{label}</span>
      {!!count && count > 0 && <span className="font-mono text-[9px] text-white/30 -mt-1.5">{count}</span>}
    </>
  );
  const cls = "flex flex-col items-center gap-2 group";
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  return <button onClick={onClick} className={cls}>{inner}</button>;
}
