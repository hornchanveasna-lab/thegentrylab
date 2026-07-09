import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { GentryMark } from "@/components/site/GentryMark";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const BENEFITS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
    ),
    title: "100 AI credits per day",
    desc: "Ask GentryBot anything about Cambodia's industrial landscape — 100 credits daily, completely free.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: "Chat history saved",
    desc: "Your conversations persist across sessions. Pick up exactly where you left off.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    title: "Save favourite sites",
    desc: "Bookmark industrial zones and projects from the map for quick access. Coming soon.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
    title: "Project watchlist",
    desc: "Track active investments and get alerts on status changes. Coming soon.",
  },
];

export default function LoginPage() {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}>

      {/* Background accent glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px]"
          style={{ background: "radial-gradient(circle at 80% 20%, #ff5100, transparent 60%)", opacity: 0.05 }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px]"
          style={{ background: "radial-gradient(circle at 20% 80%, #ff5100, transparent 60%)", opacity: 0.04 }} />
        <div className="absolute top-1/2 left-0 right-0 h-px" style={{ backgroundColor: "var(--border)" }} />
      </div>

      {/* Top bar */}
      <div className="relative px-6 py-5 flex items-center justify-between">
        <a href="/" className="inline-flex items-center gap-3 group">
          <GentryMark color="#ff5100" size={30} className="transition group-hover:drop-shadow-[0_0_8px_rgba(255,81,0,0.6)]" />
          <div className="leading-none">
            <p className="font-extrabold text-[8px] uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>The</p>
            <p className="font-extrabold text-[14px] uppercase tracking-tight leading-tight" style={{ color: "var(--text-primary)" }}>Gentry</p>
            <p className="font-extrabold text-[14px] uppercase tracking-tight leading-tight" style={{ color: "#ff5100" }}>Lab</p>
          </div>
        </a>
        <a href="/" className="font-mono text-[10px] uppercase tracking-widest transition"
          style={{ color: "var(--text-subtle)" }}>
          ← Back
        </a>
      </div>

      {/* Main */}
      <div className="relative flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px]">

          {/* Headline block */}
          <div className="mb-8 text-center">
            <span className="inline-block font-mono text-[9px] uppercase tracking-[0.25em] px-3 py-1 rounded-full mb-5"
              style={{ color: "#ff5100", border: "1px solid rgba(255,81,0,0.30)" }}>
              Cambodia Industrial Intelligence
            </span>
            <h1 className="text-[32px] font-extrabold tracking-tight leading-tight" style={{ color: "var(--text-primary)" }}>
              Your free platform<br />for industrial Cambodia
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
              260+ sites mapped · AI research assistant · Live project tracker
            </p>
          </div>

          {/* Credit highlight */}
          <div className="mb-6 flex items-center justify-center gap-3 rounded-xl px-5 py-4"
            style={{ backgroundColor: "rgba(255,81,0,0.08)", border: "1px solid rgba(255,81,0,0.20)" }}>
            <div className="text-center">
              <p className="text-[36px] font-extrabold leading-none" style={{ color: "#ff5100" }}>100</p>
              <p className="font-mono text-[9px] uppercase tracking-widest mt-1" style={{ color: "rgba(255,81,0,0.80)" }}>Credits / Day</p>
            </div>
            <div className="w-px h-10" style={{ backgroundColor: "var(--border)" }} />
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Ask GentryBot 100 questions daily about SEZs, permits, costs, and opportunities — free.
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 text-[14px] font-bold rounded-xl active:scale-[0.98] transition-all shadow-xl"
            style={{ backgroundColor: "#ffffff", color: "#1a1a1a" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-3 text-center text-[11px] leading-relaxed" style={{ color: "var(--text-subtle)" }}>
            Your name and email only. No password. No spam. Free forever.
          </p>

          {/* Divider */}
          <div className="my-7 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>Everything included</span>
            <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
          </div>

          {/* Benefits grid */}
          <div className="grid grid-cols-2 gap-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex flex-col gap-2.5 p-3.5 rounded-xl transition"
                style={{ backgroundColor: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(255,81,0,0.10)", color: "#ff5100" }}>
                  {b.icon}
                </div>
                <div>
                  <p className="text-[12px] font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{b.title}</p>
                  <p className="text-[10.5px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p className="mt-8 text-center text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>
            © 2026 The Gentry Lab · Phnom Penh
          </p>
        </div>
      </div>
    </div>
  );
}
