import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { useAuth } from "@/lib/auth";
import { useCredits, CREDIT_PACKAGES, CREDIT_COSTS, formatCredits } from "@/lib/credits";
import { supabase } from "@/lib/supabase";

const PAYWAY_LINKS: Record<string, string> = {
  starter:  "https://link.payway.com.kh/ABAPAYaN463948Z",
  pro:      "https://link.payway.com.kh/ABAPAYUb469458T",
  business: "https://link.payway.com.kh/ABAPAY0i469463b",
};

export const Route = createFileRoute("/credits")({
  component: CreditsPage,
});

export default function CreditsPage() {
  const { user } = useAuth();
  const { credits, loading, refresh } = useCredits();
  const navigate = useNavigate();
  const [buying, setBuying] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [khqrModal, setKhqrModal] = useState<{ pkgId: string; txId: string; link: string } | null>(null);
  const [khqrStatus, setKhqrStatus] = useState<"waiting" | "confirmed" | "timeout">("waiting");
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

  // Handle Stripe / PayWay return
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const successCr = search.get("cr");
  const cancelled = search.get("cancelled");
  const paywayReturn = search.get("pw");

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
    if (paywayReturn && user && supabase) {
      window.history.replaceState({}, "", "/credits");
      // Find the most recent pending transaction for this user and poll it
      supabase
        .from("payway_transactions")
        .select("id, package_id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: tx }) => {
          if (tx) {
            const link = PAYWAY_LINKS[tx.package_id] ?? "";
            setKhqrStatus("waiting");
            setKhqrModal({ pkgId: tx.package_id, txId: tx.id, link });
            startPolling(tx.id);
          } else {
            // Webhook may have already confirmed before we checked
            refresh();
            setToastMsg("Payment received! Checking your balance…");
          }
        });
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function buyWithKhqr(pkgId: string) {
    if (!user || !supabase) { navigate({ to: "/login" }); return; }
    const pkg = CREDIT_PACKAGES.find(p => p.id === pkgId);
    if (!pkg) return;
    const link = PAYWAY_LINKS[pkgId];
    if (!link) return;

    const { data: tx, error } = await supabase
      .from("payway_transactions")
      .insert({
        user_id: user.id,
        package_id: pkgId,
        credits: pkg.credits,
        amount: pkg.price_usd,
        currency: "USD",
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !tx) {
      // Fallback: just open the link, admin can credit manually
      window.open(link, "_blank");
      setToastMsg("Payment opened. Credits will be added after manual confirmation.");
      return;
    }

    setKhqrStatus("waiting");
    setKhqrModal({ pkgId, txId: tx.id, link });

    // Open PayWay in new tab
    window.open(link, "_blank");

    // Poll every 4s for up to 12 minutes for webhook to confirm
    startPolling(tx.id);
  }

  function startPolling(txId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    let elapsed = 0;
    pollRef.current = setInterval(async () => {
      elapsed += 4;
      if (!supabase) return;
      const { data } = await supabase
        .from("payway_transactions")
        .select("status")
        .eq("id", txId)
        .single();

      if (data?.status === "confirmed") {
        clearInterval(pollRef.current!);
        setKhqrStatus("confirmed");
        refresh();
        setTimeout(() => setKhqrModal(null), 4000);
      } else if (elapsed >= 720) {
        clearInterval(pollRef.current!);
        setKhqrStatus("timeout");
      }
    }, 4000);
  }

  function closeKhqrModal() {
    if (pollRef.current) clearInterval(pollRef.current);
    setKhqrModal(null);
    setKhqrStatus("waiting");
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

    {/* KHQR Payment Modal */}
    {khqrModal && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
        <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: isDark ? "#111" : "#fff", border: "1px solid rgba(255,81,0,0.25)" }}>

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: "rgba(255,81,0,0.15)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "#ff5100" }}>ABA KHQR · PayWay</p>
                <p className="text-[16px] font-bold mt-0.5" style={{ color: isDark ? "#fff" : "#111" }}>
                  {khqrPkg?.label} — ${khqrPkg?.price_usd} USD
                </p>
              </div>
              <button onClick={closeKhqrModal} className="w-7 h-7 flex items-center justify-center rounded-full opacity-40 hover:opacity-70 transition"
                style={{ color: isDark ? "#fff" : "#111" }}>✕</button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 text-center space-y-4">
            {khqrStatus === "waiting" && (
              <>
                <div className="w-10 h-10 mx-auto border-2 border-[#ff5100] border-t-transparent rounded-full animate-spin" />
                <p className="text-[13px]" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)" }}>
                  Waiting for payment confirmation…
                </p>
                <p className="text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)" }}>
                  Complete the payment in the tab that just opened.<br/>Credits are added automatically once confirmed.
                </p>
                <button onClick={() => window.open(khqrModal.link, "_blank")}
                  className="w-full py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest transition"
                  style={{ backgroundColor: "rgba(255,81,0,0.12)", color: "#ff5100", border: "1px solid rgba(255,81,0,0.3)" }}>
                  Re-open PayWay →
                </button>
              </>
            )}

            {khqrStatus === "confirmed" && (
              <>
                <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(34,197,94,0.15)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p className="text-[15px] font-bold" style={{ color: isDark ? "#fff" : "#111" }}>Payment confirmed!</p>
                <p className="text-[12px]" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}>
                  {khqrPkg?.credits.toLocaleString()} credits added to your account.
                </p>
              </>
            )}

            {khqrStatus === "timeout" && (
              <>
                <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,81,0,0.12)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <p className="text-[14px] font-semibold" style={{ color: isDark ? "#fff" : "#111" }}>Timed out</p>
                <p className="text-[12px]" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}>
                  No payment detected. If you paid, your credits will appear within a few minutes once PayWay confirms.
                </p>
                <button onClick={closeKhqrModal}
                  className="w-full py-2.5 rounded-xl font-mono text-[11px] uppercase tracking-widest"
                  style={{ backgroundColor: "rgba(255,81,0,0.12)", color: "#ff5100", border: "1px solid rgba(255,81,0,0.3)" }}>
                  Close
                </button>
              </>
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
