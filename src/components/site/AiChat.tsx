import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/* ── Types ────────────────────────────────────────────────── */
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

/* ── Helpers ──────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);

const ANON_CREDITS  = 5;
const DAILY_CREDITS = 100;
const STORAGE_KEY   = "tgl_anon";

function getAnonUsed(): number {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").count ?? 0; }
  catch { return 0; }
}
function incAnonUsed() {
  const count = getAnonUsed() + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ count }));
  return count;
}

/* Browser-session ID for chat history grouping */
function getSessionId(): string {
  let sid = sessionStorage.getItem("tgl_sid");
  if (!sid) { sid = uid() + uid(); sessionStorage.setItem("tgl_sid", sid); }
  return sid;
}

const SUGGESTED: string[] = [
  "What SEZs are near Phnom Penh?",
  "How long does a QIP permit take?",
  "What's the cost to build a factory?",
  "Which sectors get tax exemptions?",
];

/* ── Simple markdown-lite renderer ───────────────────────── */
function MdText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`"))
          return <code key={i} className="bg-white/10 px-1 rounded text-[11px] font-mono">{p.slice(1, -1)}</code>;
        if (p === "\n") return <br key={i} />;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/* ── Chat bubble ──────────────────────────────────────────── */
function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#ff5100] flex items-center justify-center shrink-0 mt-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"/>
            <circle cx="9" cy="13" r="1" fill="white" stroke="none"/>
            <circle cx="15" cy="13" r="1" fill="white" stroke="none"/>
          </svg>
        </div>
      )}
      <div
        className={`max-w-[82%] px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
          isUser
            ? "rounded-2xl rounded-tr-sm"
            : "rounded-2xl rounded-tl-sm"
        }`}
        style={isUser
          ? { backgroundColor: "#ff5100", color: "#ffffff" }
          : { backgroundColor: "var(--chat-bubble-bg)", color: "var(--chat-bubble-text)", border: "1px solid var(--chat-bubble-border)" }
        }
      >
        {msg.pending ? (
          <span className="flex items-center gap-1">
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
            <span className="animate-bounce" style={{ animationDelay: "120ms" }}>·</span>
            <span className="animate-bounce" style={{ animationDelay: "240ms" }}>·</span>
          </span>
        ) : (
          <MdText text={msg.content} />
        )}
      </div>
    </div>
  );
}

/* ── Google sign-in wall ──────────────────────────────────── */
function LoginWall() {
  return (
    <div className="border-t border-white/8 px-4 py-5 flex flex-col items-center gap-3 shrink-0 bg-[#0d0d0e]">
      <p className="text-[11.5px] text-white/60 text-center leading-relaxed">
        You've used your <span className="text-white font-semibold">5 free credits</span>.<br />
        Sign in to continue — 20 credits per day, free.
      </p>
      <a
        href="/login"
        className="flex items-center gap-2.5 px-4 py-2.5 bg-white text-[#1a1a1a] text-[12.5px] font-semibold
          rounded-md hover:bg-white/90 transition w-full justify-center"
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in to continue
      </a>
    </div>
  );
}

/* ── Main widget ──────────────────────────────────────────── */
export function AiChat() {
  const { user, session, signInWithGoogle, signOut } = useAuth();

  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [streaming, setStreaming] = useState(false);
  const [unread, setUnread]       = useState(false);
  const [historyLoaded, setHistoryLoaded]   = useState(false);
  const [showLoginWall, setShowLoginWall]   = useState(false);
  const [creditsUsed, setCreditsUsed]       = useState(0);
  const [outOfCredits, setOutOfCredits]     = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  /* Push panel above keyboard on mobile */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(kb);
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => { vv.removeEventListener("resize", handler); vv.removeEventListener("scroll", handler); };
  }, []);

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const GREETING: Message = {
    id: "greeting",
    role: "assistant",
    content: "Hi! I'm GentryBot — your Cambodia industrial intelligence assistant.\n\nAsk me anything about SEZs, factory costs, permits, or sector opportunities.",
  };

  /* On open: show greeting only if no messages yet */
  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 150);
    setUnread(false);
    setMessages((prev) => prev.length === 0 ? [GREETING] : prev);
  }, [open]);

  /* Load today's credit usage when user logs in */
  useEffect(() => {
    if (!user || !supabase) return;
    setShowLoginWall(false);
    setOutOfCredits(false);

    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from("user_daily_usage")
      .select("count")
      .eq("user_id", user.id)
      .eq("date", today)
      .single()
      .then(({ data }) => {
        setCreditsUsed(data?.count ?? 0);
      });
  }, [user]);

  /* Load chat history when user logs in */
  useEffect(() => {
    if (!user || !supabase) return;

    supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        setHistoryLoaded(true);
        if (!data?.length) return;
        const history: Message[] = data
          .reverse()
          .map((r) => ({ id: uid(), role: r.role as "user" | "assistant", content: r.content }));
        setMessages(history);
      });
  }, [user]);

  /* Save a pair of messages to Supabase */
  async function saveMessages(userContent: string, assistantContent: string) {
    if (!user || !supabase) return;
    const sessionId = getSessionId();
    await supabase.from("chat_messages").insert([
      { user_id: user.id, session_id: sessionId, role: "user",      content: userContent },
      { user_id: user.id, session_id: sessionId, role: "assistant", content: assistantContent },
    ]);
  }

  /* Send a message */
  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    /* Anon credit gate */
    if (!user) {
      const used = incAnonUsed();
      if (used > ANON_CREDITS) {
        setShowLoginWall(true);
        return;
      }
    }

    /* Logged-in credit gate */
    if (user && creditsUsed >= DAILY_CREDITS) {
      setOutOfCredits(true);
      return;
    }

    setInput("");
    const userMsg: Message     = { id: uid(), role: "user", content };
    const thinkingMsg: Message = { id: uid(), role: "assistant", content: "", pending: true };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setStreaming(true);

    const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: history }),
      });

      if (res.status === 429) {
        setOutOfCredits(true);
        setMessages((prev) => prev.filter((m) => m.id !== thinkingMsg.id));
        return;
      }

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      setMessages((prev) =>
        prev.map((m) => m.id === thinkingMsg.id ? { ...m, pending: false, content: "" } : m)
      );

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snap = accumulated;
        setMessages((prev) =>
          prev.map((m) => m.id === thinkingMsg.id ? { ...m, content: snap } : m)
        );
      }

      /* Persist + update credit count for logged-in users */
      if (user) {
        saveMessages(content, accumulated);
        setCreditsUsed((c) => c + 1);
      }

      if (!open) setUnread(true);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingMsg.id
            ? { ...m, pending: false, content: "Sorry, I couldn't connect right now. Please try again." }
            : m
        )
      );
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name ?? user?.email ?? "") as string;

  /* ── Render ── */
  return (
    <div className="ai-chat-no-print">
      {/* Chat panel */}
      <div
        ref={panelRef}
        className={`fixed right-4 z-[9999] w-[360px] max-w-[calc(100vw-2rem)] flex flex-col
          shadow-2xl overflow-hidden
          transition-all duration-300 origin-bottom-right
          ${open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}
        style={{
          bottom: `${(keyboardOffset > 0 ? keyboardOffset + 8 : 80) + 8}px`,
          height: `min(560px, calc(100dvh - ${keyboardOffset > 0 ? keyboardOffset + 24 : 130}px))`,
          borderRadius: 12,
          backgroundColor: "var(--chat-bg)",
          border: "1px solid var(--chat-border)",
          color: "var(--chat-text)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 shrink-0" style={{ backgroundColor: "var(--chat-header-bg)", borderBottom: "1px solid var(--chat-inner-border)" }}>
          {user && avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#ff5100] flex items-center justify-center shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"/>
                <circle cx="9" cy="13" r="1" fill="white" stroke="none"/>
                <circle cx="15" cy="13" r="1" fill="white" stroke="none"/>
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold leading-none truncate" style={{ color: "var(--chat-text)" }}>
              {user ? displayName.split(" ")[0] || "GentryBot" : "GentryBot"}
            </p>
            <p className="text-[10px] mt-0.5 font-mono uppercase tracking-widest" style={{ color: "var(--chat-text-muted)" }}>
              {user
                ? `${DAILY_CREDITS - creditsUsed} credits remaining`
                : "Cambodia Industrial AI"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <button onClick={signOut}
                className="text-[9px] font-mono uppercase tracking-widest transition" style={{ color: "var(--chat-text-subtle)" }}>
                Sign out
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "var(--chat-text-subtle)" }}>Online</span>
            </div>
            <button onClick={() => setOpen(false)}
              className="ml-1 w-6 h-6 flex items-center justify-center transition" style={{ color: "var(--chat-text-subtle)" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M2 2l8 8M10 2l-8 8"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 scrollbar-thin">
          {messages.map((m) => <ChatBubble key={m.id} msg={m} />)}

          {/* Out of credits message */}
          {outOfCredits && (
            <div className="text-center py-3 px-2">
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-[11.5px] text-white/50 leading-relaxed text-left">
                  <span className="text-white/80 font-semibold">0 credits remaining.</span><br />
                  {user ? "Resets at midnight." : <a href="/login" className="text-[#ff5100] hover:underline">Sign in for 20 credits/day →</a>}
                </p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && !showLoginWall && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5 shrink-0">
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="text-[10.5px] font-mono px-2.5 py-1.5 transition rounded-sm"
                style={{ border: "1px solid var(--chat-chip-border)", color: "var(--chat-chip-text)" }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Login wall OR input */}
        {showLoginWall && !user ? (
          <LoginWall />
        ) : outOfCredits ? null : (
          <div className="px-3 py-3 flex gap-2 shrink-0" style={{ backgroundColor: "var(--chat-bg)", borderTop: "1px solid var(--chat-inner-border)" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about SEZs, permits, costs…"
              disabled={streaming}
              className="flex-1 text-[12.5px] px-3 py-2 outline-none transition disabled:opacity-50"
              style={{ borderRadius: 6, backgroundColor: "var(--chat-input-bg)", border: "1px solid var(--chat-input-border)", color: "var(--chat-text)" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || streaming}
              className="w-9 h-9 flex items-center justify-center bg-[#ff5100] text-white
                hover:bg-[#e64a00] transition disabled:opacity-35 disabled:cursor-not-allowed shrink-0"
              style={{ borderRadius: 6 }}
            >
              {streaming ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.5 7H1.5M8.5 3L12.5 7l-4 4"/>
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-1.5 border-t border-white/5 text-center shrink-0">
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/18">
            Powered by Claude AI · TheGentryLab
          </span>
        </div>
      </div>

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed right-4 z-[9999] w-14 h-14 rounded-full shadow-xl
          flex items-center justify-center transition-all duration-300
          ${open ? "bg-[#1a1a1b] border border-white/15" : "bg-[#ff5100] hover:bg-[#e64a00] hover:scale-105"}`}
        style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem) + 0.5rem)" }}
        aria-label="Open GentryBot chat"
      >
        {unread && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#0a0a0b]" />
        )}
        {open ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l12 12M14 2L2 14"/>
          </svg>
        ) : (
          /* TGL G-mark — exact logo geometry */
          <svg width="22" height="22" viewBox="0 0 22 22">
            <g transform="translate(2 2) scale(0.01233)">
              <rect x="143" y="2"    width="1285" height="283" fill="white"/>
              <rect x="0"   y="143"  width="287"  height="857" fill="white"/>
              <circle cx="143" cy="143" r="143"               fill="white"/>
              <rect x="558" y="572"  width="870"  height="288" fill="white"/>
              <rect x="1141" y="572" width="287"  height="890" fill="white"/>
              <rect x="0"   y="1146" width="1428" height="316" fill="white"/>
            </g>
          </svg>
        )}
      </button>
    </div>
  );
}
