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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: "20 AI credits per day",
    desc: "Ask GentryBot about SEZs, permits, factory costs, and investment zones — 20 credits daily, free.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
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
    desc: "Bookmark industrial zones and projects from the map. Coming soon.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    ),
    title: "Project watchlist",
    desc: "Track active investments and get notified on status changes. Coming soon.",
  },
];

export default function LoginPage() {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col">
      {/* Top bar */}
      <div className="px-6 py-5">
        <a href="/" className="inline-flex items-center gap-3 group">
          <GentryMark color="#ff5100" size={28} />
          <div className="leading-none">
            <p className="font-extrabold text-[9px] uppercase tracking-[0.18em] text-white/40">The</p>
            <p className="font-extrabold text-[13px] uppercase tracking-tight text-white">Gentry Lab</p>
          </div>
        </a>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Headline */}
          <div className="mb-10 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff5100] mb-3">
              Cambodia Industrial Intelligence
            </p>
            <h1 className="text-3xl font-extrabold text-white tracking-tight leading-snug">
              Sign in to<br />TheGentryLab
            </h1>
            <p className="mt-3 text-[13px] text-white/45 leading-relaxed">
              Free access to Cambodia's industrial intelligence platform —<br className="hidden sm:block" />
              SEZ maps, project tracker, AI research assistant.
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white text-[#1a1a1a]
              text-[14px] font-semibold rounded-lg hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Trust note */}
          <p className="mt-3 text-center text-[11px] text-white/25 leading-relaxed">
            We only use your name and email to identify you.<br />
            No password stored. No spam.
          </p>

          {/* Divider */}
          <div className="my-8 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/8" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/20">What you get</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Benefits */}
          <div className="space-y-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0 text-[#ff5100]">
                  {b.icon}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white">{b.title}</p>
                  <p className="text-[11.5px] text-white/40 mt-0.5 leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Back link */}
          <div className="mt-10 text-center">
            <a href="/" className="font-mono text-[10px] uppercase tracking-widest text-white/25 hover:text-white/50 transition">
              ← Back to platform
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
