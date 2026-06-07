import { useEffect, useState } from "react";
import { loadConfig, type SiteConfig } from "@/lib/siteConfig";

export function Footer() {
  const [cfg, setCfg] = useState<SiteConfig>(loadConfig);
  useEffect(() => {
    const handler = (e: Event) => setCfg((e as CustomEvent<SiteConfig>).detail);
    window.addEventListener("tgl-config-updated", handler);
    return () => window.removeEventListener("tgl-config-updated", handler);
  }, []);

  return (
    <footer className="border-t border-white/10 bg-black text-white/50 px-6 py-8 font-mono text-[10px] uppercase tracking-widest flex flex-col sm:flex-row gap-3 justify-between">
      <p>{cfg.footerLeft}</p>
      <p>{cfg.footerRight}</p>
    </footer>
  );
}
