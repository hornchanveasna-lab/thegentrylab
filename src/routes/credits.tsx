import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { useSmoothScroll } from "@/components/site/Counter";
import { useAuth } from "@/lib/auth";
import { useCredits, CREDIT_PACKAGES, CREDIT_COSTS, formatCredits } from "@/lib/credits";
import { supabase } from "@/lib/supabase";

const PAYWAY_LINKS: Record<string, string> = {
  starter:  "https://link.payway.com.kh/ABAPAYaN463948Z",
  pro:      "https://link.payway.com.kh/ABAPAYUb469458T",
  business: "https://link.payway.com.kh/ABAPAY0i469463b",
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export const Route = createFileRoute("/credits")({
  component: CreditsPage,
});

export default function CreditsPage() {
  useSmoothScroll();
  const { user } = useAuth();
  const { credits, loading, refresh } = useCredits();
  const navigate = useNavigate();
  const [buying, setBuying] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [khqrModal, setKhqrModal] = useState<{ pkgId: string; link: string } | null>(null);
  const [verifyState, setVerifyState] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem("tgl_theme") !== "light"; } catch { return true; }
  });
  useEffect(() => {
    const sync = () => { try { setIsDark(localStorage.getItem("tgl_theme") !== "light"); } catch { /**/ } };
    window.addEventListener("storage", sync);
    const id = setInterval(sync, 300);
    return () => { window.removeEventListener("storage", sync); clearInterval(id); };
  }, []);

  // Theme-aware palette
  const c = {
    pageBg:      isDark ? "#0a0a0b"                    : "#f0f0ee",
    heroBg:      isDark ? "#0d0d0e"                    : "#e8e8e5",
    heroBorder:  isDark ? "rgba(255,255,255,0.06)"     : "rgba(0,0,0,0.08)",
    cardBg:      isDark ? "rgba(255,255,255,0.03)"     : "rgba(0,0,0,0.04)",
    cardBorder:  isDark ? "rgba(255,255,255,0.07)"     : "rgba(0,0,0,0.09)",
    bestBg:      isDark ? "rgba(255,81,0,0.08)"        : "rgba(255,81,0,0.06)",
    bestBorder:  isDark ? "rgba(255,81,0,0.35)"        : "rgba(255,81,0,0.40)",
    divider:     isDark ? "rgba(255,255,255,0.08)"     : "rgba(0,0,0,0.09)",
    text:        isDark ? "#ffffff"                    : "#111111",
    textMid:     isDark ? "rgba(255,255,255,0.55)"     : "rgba(0,0,0,0.60)",
    textFaint:   isDark ? "rgba(255,255,255,0.35)"     : "rgba(0,0,0,0.40)",
    textGhost:   isDark ? "rgba(255,255,255,0.22)"     : "rgba(0,0,0,0.28)",
    balanceBg:   isDark ? "rgba(255,255,255,0.05)"     : "rgba(0,0,0,0.05)",
    balanceBdr:  isDark ? "rgba(255,255,255,0.10)"     : "rgba(0,0,0,0.10)",
    btnSecBg:    isDark ? "rgba(255,255,255,0.08)"     : "rgba(0,0,0,0.07)",
    btnSecBdr:   isDark ? "rgba(255,255,255,0.12)"     : "rgba(0,0,0,0.12)",
    btnSecText:  isDark ? "rgba(255,255,255,0.80)"     : "rgba(0,0,0,0.75)",
    khqrBg:      isDark ? "rgba(255,81,0,0.04)"        : "rgba(255,81,0,0.04)",
    khqrBdr:     isDark ? "rgba(255,81,0,0.25)"        : "rgba(255,81,0,0.30)",
    khqrHdr:     isDark ? "rgba(255,81,0,0.15)"        : "rgba(255,81,0,0.12)",
    skeletonBg:  isDark ? "rgba(255,255,255,0.08)"     : "rgba(0,0,0,0.08)",
  };

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

  function buyWithKhqr(pkgId: string) {
    if (!user) { navigate({ to: "/login" }); return; }
    const link = PAYWAY_LINKS[pkgId];
    if (!link) return;
    setVerifyState("idle");
    setVerifyMsg("");
    setKhqrModal({ pkgId, link });
  }

  function closeKhqrModal() {
    if (pollRef.current) clearInterval(pollRef.current);
    setKhqrModal(null);
    setVerifyState("idle");
    setVerifyMsg("");
  }

  async function submitReceipt(file: File) {
    if (!user || !supabase) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    setVerifyState("verifying");
    setVerifyMsg("");

    const form = new FormData();
    form.append("receipt", file);
    form.append("package_id", khqrModal!.pkgId);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-payway-receipt`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();

      if (data.success) {
        setVerifyState("success");
        setVerifyMsg(`${data.credits.toLocaleString()} credits added to your account!`);
        refresh();
        setTimeout(() => closeKhqrModal(), 4000);
      } else {
        setVerifyState("error");
        setVerifyMsg(data.reason ?? data.error ?? "Verification failed. Please try again.");
      }
    } catch {
      setVerifyState("error");
      setVerifyMsg("Network error. Please try again.");
    }
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

  const khqrPkg = khqrModal ? CREDIT_PACKAGES.find(p => p.id === khqrModal.pkgId) : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: c.pageBg, color: c.text }}>

    {/* KHQR Receipt Upload Modal */}
    {khqrModal && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
        <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: isDark ? "#111" : "#fff", border: "1px solid rgba(255,81,0,0.25)" }}>

          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b flex items-center justify-between"
            style={{ borderColor: "rgba(255,81,0,0.12)" }}>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "#ff5100" }}>ABA PayWay · KHQR</p>
              <p className="text-[15px] font-bold mt-0.5" style={{ color: isDark ? "#fff" : "#111" }}>
                {khqrPkg?.label} — ${khqrPkg?.price_usd} USD
              </p>
            </div>
            <button onClick={closeKhqrModal} className="opacity-30 hover:opacity-60 transition text-lg leading-none"
              style={{ color: isDark ? "#fff" : "#111" }}>✕</button>
          </div>

          <div className="px-6 py-5 space-y-5">

            {verifyState === "idle" && (
              <>
                {/* Steps */}
                <div className="space-y-2.5">
                  {[
                    { n: "1", text: "Open PayWay and complete your payment" },
                    { n: "2", text: "Download the PDF receipt from PayWay" },
                    { n: "3", text: "Upload it below — AI verifies and adds credits instantly" },
                  ].map(s => (
                    <div key={s.n} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-mono text-[10px] font-bold mt-0.5"
                        style={{ backgroundColor: "rgba(255,81,0,0.15)", color: "#ff5100" }}>{s.n}</span>
                      <p className="text-[12px]" style={{ color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.65)" }}>{s.text}</p>
                    </div>
                  ))}
                </div>

                {/* Open PayWay button */}
                <button onClick={() => window.open(khqrModal.link, "_blank")}
                  className="w-full py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest font-bold transition"
                  style={{ backgroundColor: "#ff5100", color: "#fff" }}>
                  Open PayWay →
                </button>

                {/* Upload zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) submitReceipt(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed py-7 flex flex-col items-center gap-2 cursor-pointer transition-colors"
                  style={{ borderColor: dragOver ? "#ff5100" : "rgba(255,81,0,0.25)", backgroundColor: dragOver ? "rgba(255,81,0,0.05)" : "transparent" }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p className="text-[12px] font-semibold" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)" }}>
                    Upload PayWay receipt
                  </p>
                  <p className="text-[10px] font-mono" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.35)" }}>
                    PDF or screenshot · drag & drop or click
                  </p>
                  <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) submitReceipt(f); }} />
                </div>
              </>
            )}

            {verifyState === "verifying" && (
              <div className="py-8 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-[#ff5100] border-t-transparent rounded-full animate-spin" />
                <p className="text-[13px] font-semibold" style={{ color: isDark ? "#fff" : "#111" }}>
                  AI verifying receipt…
                </p>
                <p className="text-[11px] text-center" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)" }}>
                  Checking merchant, amount, and date
                </p>
              </div>
            )}

            {verifyState === "success" && (
              <div className="py-8 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(34,197,94,0.15)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p className="text-[16px] font-bold" style={{ color: isDark ? "#fff" : "#111" }}>Credits added!</p>
                <p className="text-[12px] text-center" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}>
                  {verifyMsg}
                </p>
              </div>
            )}

            {verifyState === "error" && (
              <div className="py-6 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,0.12)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <p className="text-[13px] font-semibold" style={{ color: isDark ? "#fff" : "#111" }}>Verification failed</p>
                <p className="text-[11px] text-center px-2" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}>
                  {verifyMsg}
                </p>
                <button onClick={() => { setVerifyState("idle"); setVerifyMsg(""); }}
                  className="mt-1 px-5 py-2 rounded-xl font-mono text-[10px] uppercase tracking-widest transition"
                  style={{ backgroundColor: "rgba(255,81,0,0.12)", color: "#ff5100", border: "1px solid rgba(255,81,0,0.3)" }}>
                  Try again
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    )}
      <TopNav />

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-[13px] font-medium shadow-2xl flex items-center gap-3"
          style={{ backgroundColor: successCr ? "#10b981" : isDark ? "#333" : "#222", color: "#fff" }}>
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
      <div className="border-b" style={{ borderColor: c.heroBorder, backgroundColor: c.heroBg }}>
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] px-2.5 py-1 rounded"
              style={{ color: "#ff5100", backgroundColor: "rgba(255,81,0,0.10)", border: "1px solid rgba(255,81,0,0.20)" }}>
              GentryLab Credits
            </span>
          </div>
          <h1 className="text-[28px] md:text-[36px] font-extrabold tracking-tight" style={{ color: c.text }}>Buy AI Credits</h1>
          <p className="mt-2 text-[13px] max-w-lg" style={{ color: c.textFaint }}>
            Power your industrial intelligence. Credits are used for AI chat messages and generating investment briefs.
          </p>

          {/* Current balance */}
          {user && (
            <div className="mt-6 inline-flex items-center gap-4 px-5 py-3 rounded-xl"
              style={{ backgroundColor: c.balanceBg, border: `1px solid ${c.balanceBdr}` }}>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: c.textFaint }}>Your Balance</p>
                {loading ? (
                  <div className="h-7 w-20 rounded animate-pulse" style={{ backgroundColor: c.skeletonBg }} />
                ) : (
                  <p className="text-[24px] font-extrabold" style={{ color: "#ff5100" }}>
                    {credits ? formatCredits(credits.balance) : "0"}{" "}
                    <span className="text-[14px] font-normal" style={{ color: c.textFaint }}>credits</span>
                  </p>
                )}
              </div>
              <div style={{ borderLeft: `1px solid ${c.divider}` }} className="pl-4">
                <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: c.textGhost }}>All time earned</p>
                <p className="text-[13px] font-bold" style={{ color: c.textMid }}>{credits ? formatCredits(credits.lifetime_earned) : "0"}</p>
              </div>
              <div style={{ borderLeft: `1px solid ${c.divider}` }} className="pl-4">
                <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: c.textGhost }}>All time spent</p>
                <p className="text-[13px] font-bold" style={{ color: c.textMid }}>{credits ? formatCredits(credits.lifetime_spent) : "0"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">

        {/* Not logged in */}
        {!user && (
          <div className="text-center py-12">
            <p className="text-[13px] mb-4" style={{ color: c.textFaint }}>Sign in to purchase and manage credits.</p>
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
            <div key={item.label} className="flex items-center gap-3 p-4 rounded-xl"
              style={{ backgroundColor: c.cardBg, border: `1px solid ${c.cardBorder}` }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(255,81,0,0.10)", color: "#ff5100" }}>{item.icon}</div>
              <div>
                <p className="text-[12px] font-semibold" style={{ color: c.text }}>{item.label}</p>
                <p className="font-mono text-[11px] font-bold" style={{ color: "#ff5100" }}>{item.cost} credits</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing packages */}
        {user && (
          <>
            <h2 className="text-[18px] font-bold mb-2" style={{ color: c.text }}>Credit Packages</h2>
            <p className="text-[12px] mb-6" style={{ color: c.textFaint }}>
              Credits never expire. Priced on actual compute cost per request. Secure payment via Visa / Mastercard.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              {CREDIT_PACKAGES.map(pkg => (
                <div key={pkg.id} className="relative rounded-2xl p-6 flex flex-col gap-4"
                  style={{
                    backgroundColor: pkg.best ? c.bestBg : c.cardBg,
                    border: `1px solid ${pkg.best ? c.bestBorder : c.cardBorder}`,
                  }}>
                  {pkg.best && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-widest"
                      style={{ backgroundColor: "#ff5100", color: "#fff" }}>Most Popular</div>
                  )}
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest mb-2"
                      style={{ color: pkg.best ? "#ff5100" : c.textFaint }}>{pkg.label}</p>
                    <p className="text-[28px] font-extrabold leading-none" style={{ color: c.text }}>${pkg.price_usd}</p>
                    <p className="text-[12px] mt-1" style={{ color: c.textFaint }}>USD · one-time</p>
                  </div>
                  <div className="py-3" style={{ borderTop: `1px solid ${c.divider}`, borderBottom: `1px solid ${c.divider}` }}>
                    <p className="text-[22px] font-extrabold" style={{ color: "#ff5100" }}>{pkg.credits.toLocaleString()}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: c.textFaint }}>Credits</p>
                    <p className="font-mono text-[9px] mt-1" style={{ color: c.textGhost }}>
                      ${(pkg.price_usd / pkg.credits * 1000).toFixed(2)} per 1,000 cr
                    </p>
                  </div>
                  <div className="space-y-1.5 text-[11.5px]" style={{ color: c.textMid }}>
                    <div className="flex items-center gap-2"><span style={{ color: "#10b981" }}>✓</span>{Math.floor(pkg.credits / CREDIT_COSTS.brief_standard)} standard briefs</div>
                    <div className="flex items-center gap-2"><span style={{ color: "#10b981" }}>✓</span>{Math.floor(pkg.credits / CREDIT_COSTS.brief_comprehensive)} comprehensive briefs</div>
                    <div className="flex items-center gap-2"><span style={{ color: "#10b981" }}>✓</span>{Math.floor(pkg.credits / CREDIT_COSTS.chat)} chat messages</div>
                    <div className="flex items-center gap-2"><span style={{ color: "#10b981" }}>✓</span>Never expires</div>
                  </div>
                  <button onClick={() => buyCredits(pkg.id)} disabled={buying === pkg.id}
                    className="mt-auto w-full py-3 rounded-xl font-bold text-[13px] transition disabled:opacity-50"
                    style={{
                      backgroundColor: pkg.best ? "#ff5100" : c.btnSecBg,
                      color: pkg.best ? "#ffffff" : c.btnSecText,
                      border: pkg.best ? "none" : `1px solid ${c.btnSecBdr}`,
                    }}>
                    {buying === pkg.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                        Redirecting…
                      </span>
                    ) : `Buy ${pkg.label} →`}
                  </button>
                </div>
              ))}
            </div>

            {/* Bakong / KHQR section */}
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${c.khqrBdr}`, backgroundColor: c.khqrBg }}>
              <div className="px-6 py-5 border-b" style={{ borderColor: c.khqrHdr }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(255,81,0,0.15)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="1.6" strokeLinecap="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                      <path d="M14 14h.01M14 18h.01M18 14h.01M18 18h.01M21 14h.01M14 21h.01M18 21h.01M21 21h.01"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: c.text }}>Pay with Bakong / KHQR</p>
                    <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: c.textFaint }}>
                      ABA · Wing · ACLEDA · Chip Mong · Any KHQR bank
                    </p>
                  </div>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>Live</span>
                </div>
                <p className="mt-3 text-[12px]" style={{ color: c.textFaint }}>
                  Scan the QR code with any Cambodian banking app that supports KHQR. Credits are added instantly after payment confirmation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3"
                style={{ borderTop: `1px solid ${c.divider}` }}>
                {CREDIT_PACKAGES.map((pkg, i) => (
                  <div key={pkg.id} className="px-5 py-4 flex items-center justify-between gap-4"
                    style={{ borderLeft: i > 0 ? `1px solid ${c.divider}` : undefined }}>
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: c.textFaint }}>{pkg.label}</p>
                      <p className="text-[18px] font-extrabold leading-none" style={{ color: c.text }}>${pkg.price_usd}</p>
                      <p className="font-mono text-[10px] mt-0.5" style={{ color: "#ff5100" }}>{pkg.credits.toLocaleString()} cr</p>
                    </div>
                    <button
                      onClick={() => buyWithKhqr(pkg.id)}
                      disabled={!!khqrModal}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-[10px] uppercase tracking-widest transition disabled:opacity-50 shrink-0"
                      style={{ backgroundColor: "#ff5100", color: "#fff", fontWeight: 700 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                      </svg>
                      Pay
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* FAQ */}
        <div className="mt-10">
          <h3 className="text-[15px] font-bold mb-4" style={{ color: c.text }}>Credits FAQ</h3>
          <div className="space-y-4">
            {[
              { q: "Do credits expire?", a: "No. Purchased credits never expire. New user welcome credits (500 free) also carry over indefinitely." },
              { q: "What are my free credits?", a: "Every new account gets 500 free credits — enough for 6 standard briefs or 25 chat messages. No card required." },
              { q: "How is the price calculated?", a: "Credit prices are based on actual compute costs per request — longer, more complex briefs consume more compute and cost more credits. Prices are set to cover infrastructure and ongoing research into Cambodia's industrial data." },
              { q: "Can I get a refund?", a: "Unused credits can be refunded within 30 days of purchase. Contact advisory@thegentrylab.io." },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl"
                style={{ backgroundColor: c.cardBg, border: `1px solid ${c.cardBorder}` }}>
                <p className="text-[13px] font-semibold mb-1" style={{ color: c.text }}>{item.q}</p>
                <p className="text-[12px]" style={{ color: c.textMid }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
