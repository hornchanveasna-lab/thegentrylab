import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useResearchComments, postResearchComment, deleteResearchComment } from "@/lib/data";

/** Relative-time formatter for comment timestamps ("2h ago", "3d ago"). */
function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

/** Reader discussion thread for a research publication — read is public,
 *  posting requires the same Google sign-in used across the site. Author
 *  name/company are snapshotted onto the comment at post time rather than
 *  joined from `profiles` live, since `profiles` RLS only lets a user read
 *  their own row (by design — no public profile browsing on this site). */
export function CommentSection({ briefId }: { briefId: string }) {
  const { user, signInWithGoogle } = useAuth();
  const { data: comments = [], isLoading } = useResearchComments(briefId);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!user || !draft.trim() || !supabase) return;
    setPosting(true);
    setError(null);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, company")
        .eq("user_id", user.id)
        .maybeSingle();
      await postResearchComment({
        briefId,
        userId: user.id,
        authorName: profile?.display_name || user.user_metadata?.full_name || user.email || "Reader",
        authorCompany: profile?.company ?? null,
        body: draft.trim(),
      });
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["research-comments", briefId] });
    } catch {
      setError("Couldn't post your comment. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteResearchComment(id);
      await queryClient.invalidateQueries({ queryKey: ["research-comments", briefId] });
    } catch { /* silently ignore — the row just stays visible */ }
  }

  return (
    <section className="reveal border-t border-white/10 pt-10 print:hidden">
      <div className="flex items-center gap-2 mb-6">
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/35">Discussion</p>
        {comments.length > 0 && (
          <span className="font-mono text-[9px] text-white/25">· {comments.length} comment{comments.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {user ? (
        <div className="mb-8">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share a perspective, a correction, or a question…"
            rows={3}
            maxLength={2000}
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#ff5100]/50 transition-colors resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            {error ? <p className="text-[10px] text-red-400">{error}</p> : <span />}
            <button
              onClick={handleSubmit}
              disabled={!draft.trim() || posting}
              className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest bg-[#ff5100] text-black disabled:opacity-30 hover:brightness-110 transition font-bold"
            >
              {posting ? "Posting…" : "Post comment"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-8 border border-dashed border-white/15 rounded-lg py-6 px-5 text-center">
          <p className="text-[13px] text-white/60 mb-3">Sign in to join the discussion.</p>
          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-2 px-5 py-2 font-mono text-[10px] uppercase tracking-widest border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-[12px] text-white/25">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-[12px] text-white/25">No comments yet — be the first to weigh in.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {comments.map((c) => (
            <div key={c.id} className="border-b border-white/6 pb-5 last:border-0">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-white/90">{c.author_name}</span>
                  {c.author_company && <span className="text-[11px] text-white/35">· {c.author_company}</span>}
                  <span className="font-mono text-[9px] text-white/25">· {timeAgo(c.created_at)}</span>
                </div>
                {user?.id === c.user_id && (
                  <button onClick={() => handleDelete(c.id)} className="font-mono text-[9px] uppercase tracking-widest text-white/25 hover:text-red-400 transition-colors shrink-0">
                    Delete
                  </button>
                )}
              </div>
              <p className="text-[13px] text-white/65 leading-relaxed whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
