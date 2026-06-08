import { useEffect, useRef, useState } from "react";

/* ── Types ────────────────────────────────────────────────── */
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

/* ── Helpers ──────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);

const SUGGESTED: string[] = [
  "What SEZs are near Phnom Penh?",
  "How long does a QIP permit take?",
  "What's the cost to build a factory?",
  "Which sectors get tax exemptions?",
];

/* ── Simple markdown-lite renderer ───────────────────────── */
function MdText({ text }: { text: string }) {
  // Bold **text**, inline code `code`, line breaks
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
            ? "bg-[#ff5100] text-white rounded-2xl rounded-tr-sm"
            : "bg-white/8 text-white/90 rounded-2xl rounded-tl-sm border border-white/8"
        }`}
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

/* ── Main widget ──────────────────────────────────────────── */
export function AiChat() {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]     = useState("");
  const [streaming, setStreaming] = useState(false);
  const [unread, setUnread]   = useState(false);
  const [greeted, setGreeted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  /* Auto-scroll to bottom on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Focus input when opened */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
      setUnread(false);
      if (!greeted) {
        setGreeted(true);
        setMessages([{
          id: uid(),
          role: "assistant",
          content: "Hi! I'm GentryBot — your Cambodia industrial intelligence assistant.\n\nAsk me anything about SEZs, factory costs, permits, or sector opportunities.",
        }]);
      }
    }
  }, [open]);

  /* Send a message */
  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");

    const userMsg: Message = { id: uid(), role: "user", content };
    const thinkingMsg: Message = { id: uid(), role: "assistant", content: "", pending: true };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setStreaming(true);

    /* Build history for API (exclude the thinking placeholder) */
    const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      /* Replace thinking bubble with streaming text */
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

      if (!open) setUnread(true);
    } catch (err) {
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

  /* ── Render ── */
  return (
    <>
      {/* Chat panel */}
      <div
        className={`fixed bottom-24 right-5 z-[9999] w-[360px] max-w-[calc(100vw-2rem)] flex flex-col
          shadow-2xl border border-white/10 bg-[#0d0d0e] overflow-hidden
          transition-all duration-300 origin-bottom-right
          ${open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}
        style={{ height: "min(560px, calc(100vh - 8rem))", borderRadius: 12 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8 bg-[#111] shrink-0">
          <div className="w-8 h-8 rounded-full bg-[#ff5100] flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"/>
              <circle cx="9" cy="13" r="1" fill="white" stroke="none"/>
              <circle cx="15" cy="13" r="1" fill="white" stroke="none"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white leading-none">GentryBot</p>
            <p className="text-[10px] text-white/40 mt-0.5 font-mono uppercase tracking-widest">Cambodia Industrial AI</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-white/30">Online</span>
          </div>
          <button onClick={() => setOpen(false)}
            className="ml-2 w-6 h-6 flex items-center justify-center text-white/30 hover:text-white transition">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 scrollbar-thin">
          {messages.map((m) => <ChatBubble key={m.id} msg={m} />)}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions (shown before first user message) */}
        {messages.length <= 1 && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5 shrink-0">
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="text-[10.5px] font-mono px-2.5 py-1.5 border border-white/12 text-white/50
                  hover:border-[#ff5100]/60 hover:text-white/80 transition rounded-sm">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-white/8 px-3 py-3 flex gap-2 shrink-0 bg-[#0d0d0e]">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about SEZs, permits, costs…"
            disabled={streaming}
            className="flex-1 bg-white/5 border border-white/10 text-white text-[12.5px] placeholder-white/25
              px-3 py-2 outline-none focus:border-[#ff5100]/50 transition disabled:opacity-50"
            style={{ borderRadius: 6 }}
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

        {/* Powered-by footer */}
        <div className="px-4 py-1.5 border-t border-white/5 text-center shrink-0">
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/18">
            Powered by Claude AI · TheGentryLab
          </span>
        </div>
      </div>

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 right-5 z-[9999] w-14 h-14 rounded-full shadow-xl
          flex items-center justify-center transition-all duration-300
          ${open ? "bg-[#1a1a1b] border border-white/15" : "bg-[#ff5100] hover:bg-[#e64a00] hover:scale-105"}`}
        aria-label="Open GentryBot chat"
      >
        {/* Unread badge */}
        {unread && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#0a0a0b]" />
        )}

        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 3l12 12M15 3L3 15"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>
    </>
  );
}
