import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { TopNav } from "@/components/site/TopNav";
import { useAuth } from "@/lib/auth";
import { useCredits, CREDIT_PACKAGES, CREDIT_COSTS, formatCredits } from "@/lib/credits";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/credits")({
  component: CreditsPage,
});

/* ── KHQR types ─────────────────────────── */
interface KhqrSession {
  tran_id: string;
  qr_string: string;
  amount: number;
  credits: number;
  pkg_label: string;
}

/* ── KHQR Modal ─────────────────────────── */
function KhqrModal({ session, onSuccess, onClose }: {
  session: KhqrSession;
  onSuccess: (credits: number) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<"waiting" | "approved" | "declined">("waiting");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const ticker = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    async function poll() {
      if (!user) return;
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      const res = await fetch("/api/payway-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ tran_id: session.tran_id }),
      });
      if (!res.ok) return;
      const { status: s, credits } = await res.json();
      if (s === "approved") {
        setStatus("approved");
        clearInterval(pollRef.current!);
        setTimeout(() => onSuccess(credits), 1200);
      } else if (s === "declined" || s === "cancelled") {
        setStatus("declined");
        clearInterval(pollRef.current!);
      }
    }
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current!);
  }, [session.tran_id, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#111113", border: "1px solid rgba(255,255,255,0.10)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(255,81,0,0.12)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="1.8" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <path d="M14 14h.01M14 18h.01M18 14h.01M18 18h.01M21 14h.01M14 21h.01M18 21h.01M21 21h.01"/>
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-bold" style={{ color: "#ffffff" }}>Scan to pay</p>
              <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.30)" }}>Bakong · ABA · Wing · Any KHQR Bank</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
            style={{ color: "rgba(255,255,255,0.40)" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col items-center gap-4">
          {status === "waiting" && (
            <>
              {/* QR code */}
              <div className="p-3 rounded-xl" style={{ backgroundColor: "#ffffff" }}>
                <QRCode value={session.qr_string} size={200} />
              </div>

              {/* Amount + credits */}
              <div className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Amount</p>
                  <p className="text-[22px] font-extrabold leading-none" style={{ color: "#ffffff" }}>${session.amount.toFixed(2)} <span className="text-[12px] font-normal" style={{ color: "rgba(255,255,255,0.40)" }}>USD</span></p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Credits</p>
                  <p className="text-[22px] font-extrabold leading-none" style={{ color: "#ff5100" }}>{session.credits.toLocaleString()}</p>
                </div>
              </div>

              {/* Waiting indicator */}
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#f59e0b" }} />
                <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.40)" }}>
                  Waiting for payment · {mins}:{secs}
                </p>
              </div>

              <p className="text-center text-[11px]" style={{ color: "rgba(255,255,255,0.30)" }}>
                Open your banking app and scan the QR code above.<br />
                This page updates automatically when payment is detected.
              </p>
            </>
          )}

          {status === "approved" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(16,185,129,0.15)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-[18px] font-bold" style={{ color: "#10b981" }}>Payment confirmed!</p>
              <p className="text-[12px] text-center" style={{ color: "rgba(255,255,255,0.50)" }}>
                {session.credits.toLocaleString()} credits are being added to your account…
              </p>
            </div>
          )}

          {status === "declined" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,0.15)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </div>
              <p className="text-[18px] font-bold" style={{ color: "#ef4444" }}>Payment declined</p>
              <p className="text-[12px] text-center" style={{ color: "rgba(255,255,255,0.50)" }}>
                The payment was declined or cancelled. Please try again.
              </p>
              <button onClick={onClose} className="px-5 py-2 rounded-xl font-mono text-[11px] uppercase tracking-widest transition"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.70)" }}>
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === "waiting" && (
          <div className="px-5 pb-4 flex items-center justify-center gap-2">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.22)" }}>
              Secured by ABA PayWay · KHQR standard
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreditsPage() {
  const { user } = useAuth();
  const { credits, loading, refresh } = useCredits();
  const navigate = useNavigate();
  const [buying, setBuying] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [khqrSession, setKhqrSession] = useState<KhqrSession | null>(null);
  const [khqrBuying, setKhqrBuying] = useState<string | null>(null);

  // Handle Stripe return
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const successCr = search.get("cr");
  const cancelled = search.get("cancelled");

  useEffect(() => {
    if (successCr) {
      refresh();
      setToastMsg(`${Number(successCr).toLocaleString()} credits added to your account!`);
      window.history.replaceState({}, "", "/credits");
    }
    if (cancelled) {
      setToastMsg("Payment cancelled — no charge made.");
      window.history.replaceState({}, "", "/credits");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function buyWithKhqr(pkgId: string) {
    if (!user) { navigate({ to: "/login" }); return; }
    setKhqrBuying(pkgId);
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      const res = await fetch("/api/payway-create", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ packageId: pkgId }),
      });
      if (res.ok) {
        const data = await res.json();
        const pkg = CREDIT_PACKAGES.find(p => p.id === pkgId);
        setKhqrSession({
          tran_id:   data.tran_id,
          qr_string: data.qr_string,
          amount:    data.amount,
          credits:   data.credits,
          pkg_label: pkg?.label ?? pkgId,
        });
      } else {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        setToastMsg(error ?? "Failed to create KHQR. Please try again.");
      }
    } catch {
      setToastMsg("Network error. Please try again.");
    }
    setKhqrBuying(null);
  }

  async function buyCredits(pkgId: string) {
    if (!user) { navigate({ to: "/login" }); return; }
    setBuying(pkgId);
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ packageId: pkgId }),
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) window.location.href = url;
      } else {
        setToastMsg("Unable to start checkout. Please try again.");
      }
    } catch {
      setToastMsg("Checkout error. Please try again.");
    }
    setBuying(null);
  }

  function handleKhqrSuccess(creditsAdded: number) {
    setKhqrSession(null);
    refresh();
    setToastMsg(`${creditsAdded.toLocaleString()} credits added to your account!`);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0b", color: "#ffffff" }}>
      <TopNav />

      {/* KHQR modal */}
      {khqrSession && (
        <KhqrModal
          session={khqrSession}
          onSuccess={handleKhqrSuccess}
          onClose={() => setKhqrSession(null)}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-[13px] font-medium shadow-2xl flex items-center gap-3"
          style={{ backgroundColor: successCr ? "#10b981" : "#333", color: "#fff" }}>
          {successCr ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          {toastMsg}
          <button onClick={() => setToastMsg(null)} style={{ opacity: 0.7 }}>×</button>
        </div>
      )}

      {/* Hero */}
      <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#0d0d0e" }}>
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] px-2.5 py-1 rounded" style={{ color: "#ff5100", backgroundColor: "rgba(255,81,0,0.10)", border: "1px solid rgba(255,81,0,0.20)" }}>
              GentryLab Credits
            </span>
          </div>
          <h1 className="text-[28px] md:text-[36px] font-extrabold tracking-tight" style={{ color: "#ffffff" }}>Buy AI Credits</h1>
          <p className="mt-2 text-[13px] max-w-lg" style={{ color: "rgba(255,255,255,0.40)" }}>
            Power your industrial intelligence. Credits are used for AI chat messages and generating investment briefs.
          </p>

          {/* Current balance */}
          {user && (
            <div className="mt-6 inline-flex items-center gap-4 px-5 py-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Your Balance</p>
                {loading ? (
                  <div className="h-7 w-20 rounded animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                ) : (
                  <p className="text-[24px] font-extrabold" style={{ color: "#ff5100" }}>
                    {credits ? formatCredits(credits.balance) : "0"} <span className="text-[14px] font-normal" style={{ color: "rgba(255,255,255,0.40)" }}>credits</span>
                  </p>
                )}
              </div>
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }} className="pl-4">
                <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>All time earned</p>
                <p className="text-[13px] font-bold" style={{ color: "rgba(255,255,255,0.60)" }}>{credits ? formatCredits(credits.lifetime_earned) : "0"}</p>
              </div>
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }} className="pl-4">
                <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>All time spent</p>
                <p className="text-[13px] font-bold" style={{ color: "rgba(255,255,255,0.60)" }}>{credits ? formatCredits(credits.lifetime_spent) : "0"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">

        {/* Not logged in */}
        {!user && (
          <div className="text-center py-12">
            <p className="text-[13px] mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>Sign in to purchase and manage credits.</p>
            <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px]"
              style={{ backgroundColor: "#ff5100", color: "#ffffff" }}>Sign in →</Link>
          </div>
        )}

        {/* Credit use guide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          {[
            { label: "Chat Message", cost: CREDIT_COSTS.chat, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
            { label: "Standard Brief", cost: CREDIT_COSTS.brief_standard, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
            { label: "Comprehensive Brief", cost: CREDIT_COSTS.brief_comprehensive, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,81,0,0.10)", color: "#ff5100" }}>{item.icon}</div>
              <div>
                <p className="text-[12px] font-semibold" style={{ color: "#ffffff" }}>{item.label}</p>
                <p className="font-mono text-[11px] font-bold" style={{ color: "#ff5100" }}>{item.cost} credits</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing packages */}
        {user && (
          <>
            <h2 className="text-[18px] font-bold mb-2" style={{ color: "#ffffff" }}>Credit Packages</h2>
            <p className="text-[12px] mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>Credits never expire. Priced on actual compute cost per request. Secure payment via Visa / Mastercard.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              {CREDIT_PACKAGES.map(pkg => (
                <div key={pkg.id} className="relative rounded-2xl p-6 flex flex-col gap-4"
                  style={{
                    backgroundColor: pkg.best ? "rgba(255,81,0,0.08)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${pkg.best ? "rgba(255,81,0,0.35)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  {pkg.best && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-widest"
                      style={{ backgroundColor: "#ff5100", color: "#000" }}>Most Popular</div>
                  )}
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: pkg.best ? "#ff5100" : "rgba(255,255,255,0.40)" }}>{pkg.label}</p>
                    <p className="text-[28px] font-extrabold leading-none" style={{ color: "#ffffff" }}>${pkg.price_usd}</p>
                    <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>USD · one-time</p>
                  </div>
                  <div className="py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-[22px] font-extrabold" style={{ color: "#ff5100" }}>{pkg.credits.toLocaleString()}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.40)" }}>Credits</p>
                    <p className="font-mono text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.22)" }}>${(pkg.price_usd / pkg.credits * 1000).toFixed(2)} per 1,000 cr</p>
                  </div>
                  <div className="space-y-1.5 text-[11.5px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "#10b981" }}>✓</span>
                      {Math.floor(pkg.credits / CREDIT_COSTS.brief_standard)} standard briefs
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "#10b981" }}>✓</span>
                      {Math.floor(pkg.credits / CREDIT_COSTS.brief_comprehensive)} comprehensive briefs
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "#10b981" }}>✓</span>
                      {Math.floor(pkg.credits / CREDIT_COSTS.chat)} chat messages
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "#10b981" }}>✓</span>
                      Never expires
                    </div>
                  </div>
                  <button onClick={() => buyCredits(pkg.id)} disabled={buying === pkg.id}
                    className="mt-auto w-full py-3 rounded-xl font-bold text-[13px] transition disabled:opacity-50"
                    style={{ backgroundColor: pkg.best ? "#ff5100" : "rgba(255,255,255,0.08)", color: pkg.best ? "#ffffff" : "rgba(255,255,255,0.80)", border: pkg.best ? "none" : "1px solid rgba(255,255,255,0.12)" }}>
                    {buying === pkg.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        Redirecting…
                      </span>
                    ) : `Buy ${pkg.label} →`}
                  </button>
                </div>
              ))}
            </div>

            {/* Bakong / KHQR section */}
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,81,0,0.25)", backgroundColor: "rgba(255,81,0,0.04)" }}>
              <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(255,81,0,0.15)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,81,0,0.15)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="1.6" strokeLinecap="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                      <path d="M14 14h.01M14 18h.01M18 14h.01M18 18h.01M21 14h.01M14 21h.01M18 21h.01M21 21h.01"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: "#ffffff" }}>Pay with Bakong / KHQR</p>
                    <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>ABA · Wing · ACLEDA · Chip Mong · Any KHQR bank</p>
                  </div>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>Live</span>
                </div>
                <p className="mt-3 text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Scan the QR code with any Cambodian banking app that supports KHQR. Credits are added instantly after payment confirmation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x" style={{ "--tw-divide-opacity": 1, borderColor: "rgba(255,255,255,0.07)" } as React.CSSProperties}>
                {CREDIT_PACKAGES.map(pkg => (
                  <div key={pkg.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{pkg.label}</p>
                      <p className="text-[18px] font-extrabold leading-none" style={{ color: "#ffffff" }}>${pkg.price_usd}</p>
                      <p className="font-mono text-[10px] mt-0.5" style={{ color: "#ff5100" }}>{pkg.credits.toLocaleString()} cr</p>
                    </div>
                    <button
                      onClick={() => buyWithKhqr(pkg.id)}
                      disabled={khqrBuying === pkg.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-[10px] uppercase tracking-widest transition disabled:opacity-50 shrink-0"
                      style={{ backgroundColor: "#ff5100", color: "#000", fontWeight: 700 }}>
                      {khqrBuying === pkg.id ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                          <rect x="3" y="14" width="7" height="7" rx="1"/>
                        </svg>
                      )}
                      {khqrBuying === pkg.id ? "Loading…" : "Pay"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* FAQ */}
        <div className="mt-10">
          <h3 className="text-[15px] font-bold mb-4" style={{ color: "#ffffff" }}>Credits FAQ</h3>
          <div className="space-y-4">
            {[
              { q: "Do credits expire?", a: "No. Purchased credits never expire. New user welcome credits (500 free) also carry over indefinitely." },
              { q: "What are my free credits?", a: "Every new account gets 500 free credits — enough for 6 standard briefs or 25 chat messages. No card required." },
              { q: "How is the price calculated?", a: "Credit prices are based on actual compute costs per request — longer, more complex briefs consume more compute and cost more credits. Prices are set to cover infrastructure and ongoing research into Cambodia's industrial data." },
              { q: "Can I get a refund?", a: "Unused credits can be refunded within 30 days of purchase. Contact advisory@thegentrylab.io." },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[13px] font-semibold mb-1" style={{ color: "#ffffff" }}>{item.q}</p>
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
