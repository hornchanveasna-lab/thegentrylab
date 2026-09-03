/**
 * Continuous-scroll pdf.js canvas renderer for the TenderAI Documents
 * viewer. Replaces the browser's native PDF iframe with real page
 * navigation, zoom, and in-document search — the foundation for citation
 * deep-linking (a requirement's source page/quote can be jumped to via
 * `scrollTarget`, wired by a later phase).
 *
 * Pages are painted lazily (IntersectionObserver) rather than all at once,
 * since tender packages commonly run 100+ pages.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfScrollTarget {
  page: number; // 1-based
  quotedText?: string | null;
  /** Bump to re-trigger a jump to the same page/text a second time. */
  nonce?: number;
}

export interface PdfCanvasViewerProps {
  url: string;
  fileName: string;
  /** Fetches a fresh signed URL when the current one has expired mid-read. */
  onUrlExpired?: () => Promise<string>;
  scrollTarget?: PdfScrollTarget | null;
  onScrollTargetConsumed?: () => void;
}

interface SearchMatch {
  page: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

export function PdfCanvasViewer({ url, fileName, onUrlExpired, scrollTarget, onScrollTargetConsumed }: PdfCanvasViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [highlightPage, setHighlightPage] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [indexing, setIndexing] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map());
  const pageTextCache = useRef<Map<number, string>>(new Map());
  const retriedRef = useRef(false);

  // Load the document. getDocument({url}) range-requests rather than
  // buffering the whole file, which matters for large tender PDFs.
  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    setPdfDoc(null); setNumPages(0); setLoadError(null);
    pageTextCache.current.clear();
    retriedRef.current = false;

    async function load(src: string) {
      try {
        loadingTask = pdfjsLib.getDocument({ url: src });
        const doc = await loadingTask.promise;
        if (cancelled) { loadingTask?.destroy(); return; }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setPageInput("1");
      } catch (err) {
        // A 10-minute signed URL can expire mid-read of a long document —
        // retry once with a freshly-signed URL before surfacing an error.
        if (!retriedRef.current && onUrlExpired) {
          retriedRef.current = true;
          try {
            const fresh = await onUrlExpired();
            if (!cancelled) return load(fresh);
          } catch { /* fall through to error below */ }
        }
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load PDF");
      }
    }
    load(url);

    return () => { cancelled = true; loadingTask?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Fit-width baseline: compute a scale that fills the scroll container,
  // recomputed on first load and on container resize.
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;
    let cancelled = false;
    const el = containerRef.current;
    async function fitWidth() {
      if (!pdfDoc) return;
      const page = await pdfDoc.getPage(1);
      if (cancelled) return;
      const baseWidth = page.getViewport({ scale: 1 }).width;
      const available = el.clientWidth - 32; // account for page padding
      if (available > 0) setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, available / baseWidth)));
    }
    fitWidth();
    const ro = new ResizeObserver(() => fitWidth());
    ro.observe(el);
    return () => { cancelled = true; ro.disconnect(); };
  }, [pdfDoc]);

  const pageNumbers = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  function scrollToPage(page: number) {
    pageEls.current.get(page)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function handlePageInputSubmit() {
    const n = parseInt(pageInput, 10);
    if (Number.isFinite(n) && n >= 1 && n <= numPages) scrollToPage(n);
    else setPageInput(String(currentPage));
  }

  function zoom(delta: number) {
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)));
  }

  // Citation deep-link: jump to the requested page and give it a brief glow.
  useEffect(() => {
    if (!scrollTarget || !pdfDoc) return;
    scrollToPage(scrollTarget.page);
    setHighlightPage(scrollTarget.page);
    const t = setTimeout(() => setHighlightPage(null), 2000);
    onScrollTargetConsumed?.();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTarget, pdfDoc]);

  function onPageTextIndexed(page: number, text: string) {
    pageTextCache.current.set(page, text);
    setIndexedCount(pageTextCache.current.size);
  }

  async function runSearch(q: string) {
    setQuery(q);
    setMatchIndex(0);
    if (!q.trim() || !pdfDoc) { setMatches([]); return; }
    const needle = q.toLowerCase();

    function currentMatches(): SearchMatch[] {
      const found: SearchMatch[] = [];
      for (const [page, text] of pageTextCache.current) {
        if (text.toLowerCase().includes(needle)) found.push({ page });
      }
      return found.sort((a, b) => a.page - b.page);
    }
    setMatches(currentMatches());

    // Background-index any pages not yet rendered/cached so search covers
    // the whole document, not just what's been scrolled past so far.
    const missing = pageNumbers.filter((p) => !pageTextCache.current.has(p));
    if (missing.length === 0) return;
    setIndexing(true);
    for (const p of missing) {
      if (query !== q) break; // superseded by a newer search
      try {
        const page = await pdfDoc.getPage(p);
        const content = await page.getTextContent();
        const text = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
        onPageTextIndexed(p, text);
      } catch { /* skip unreadable page */ }
      await new Promise((r) => setTimeout(r, 0));
    }
    setIndexing(false);
    setMatches(currentMatches());
  }

  function gotoMatch(i: number) {
    if (matches.length === 0) return;
    const idx = ((i % matches.length) + matches.length) % matches.length;
    setMatchIndex(idx);
    scrollToPage(matches[idx].page);
    setHighlightPage(matches[idx].page);
    setTimeout(() => setHighlightPage(null), 2000);
  }

  const fitWidthScale = scale;

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1 bg-white/5 rounded-lg px-1.5 py-1">
          <button onClick={() => zoom(-0.15)} className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors">−</button>
          <span className="font-mono text-[10px] text-white/50 w-10 text-center">{Math.round(fitWidthScale * 100)}%</span>
          <button onClick={() => zoom(0.15)} className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors">+</button>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-white/50">
          <span>Page</span>
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handlePageInputSubmit(); }}
            onBlur={handlePageInputSubmit}
            className="w-10 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-center text-white outline-none focus:border-white/25"
          />
          <span>/ {numPages || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <input
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") gotoMatch(e.shiftKey ? matchIndex - 1 : matchIndex + 1); }}
            placeholder="Search this document…"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:border-white/25"
          />
          {query.trim() && (
            <span className="font-mono text-[9px] text-white/40 shrink-0 whitespace-nowrap">
              {indexing ? `indexing ${indexedCount}/${numPages}…` : matches.length === 0 ? "0 results" : `${matchIndex + 1}/${matches.length}`}
            </span>
          )}
          {matches.length > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => gotoMatch(matchIndex - 1)} className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-colors">‹</button>
              <button onClick={() => gotoMatch(matchIndex + 1)} className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-colors">›</button>
            </div>
          )}
        </div>
      </div>

      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto rounded-xl bg-black/30 p-4">
        {loadError ? (
          <div className="h-full flex items-center justify-center px-6 text-center">
            <p className="text-[12px] text-red-400">{loadError}</p>
          </div>
        ) : !pdfDoc ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white/20 border-t-[#ff5100] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {pageNumbers.map((n) => (
              <PdfPageCanvas
                key={n}
                pdfDoc={pdfDoc}
                pageNumber={n}
                scale={scale}
                registerEl={(el) => { if (el) pageEls.current.set(n, el); else pageEls.current.delete(n); }}
                onBecomeVisible={setCurrentPage}
                onTextIndexed={onPageTextIndexed}
                highlighted={highlightPage === n}
                fileName={fileName}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PdfPageCanvas({ pdfDoc, pageNumber, scale, registerEl, onBecomeVisible, onTextIndexed, highlighted, fileName }: {
  pdfDoc: PDFDocumentProxy; pageNumber: number; scale: number;
  registerEl: (el: HTMLDivElement | null) => void;
  onBecomeVisible: (page: number) => void;
  onTextIndexed: (page: number, text: string) => void;
  highlighted: boolean;
  fileName: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number } | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const indexedRef = useRef(false);

  useEffect(() => {
    if (wrapperRef.current) registerEl(wrapperRef.current);
    return () => registerEl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cheap viewport calc up front so the placeholder (and scrollbar height)
  // is correct immediately, independent of whether the page is on-screen.
  useEffect(() => {
    let cancelled = false;
    pdfDoc.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      pageRef.current = page;
      const vp = page.getViewport({ scale });
      setViewportSize({ w: vp.width, h: vp.height });
    });
    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber, scale]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) onBecomeVisible(pageNumber);
      },
      { rootMargin: "800px 0px", threshold: [0, 0.5, 1] }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber]);

  // Actual paint — gated by visibility, re-runs on zoom.
  useEffect(() => {
    if (!isIntersecting || !canvasRef.current) return;
    let cancelled = false;
    pdfDoc.getPage(pageNumber).then(async (page) => {
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renderTaskRef.current?.cancel();
      const task = page.render({ canvas, canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (err) {
        if ((err as { name?: string })?.name !== "RenderingCancelledException") console.error(err);
      }

      if (!indexedRef.current) {
        indexedRef.current = true;
        try {
          const content = await page.getTextContent();
          const text = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
          onTextIndexed(pageNumber, text);
        } catch { /* skip */ }
      }
    });
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pageNumber, scale, isIntersecting]);

  return (
    <div
      ref={wrapperRef}
      className={`relative bg-white rounded shadow-lg transition-shadow ${highlighted ? "ring-2 ring-[#ff5100] ring-offset-2 ring-offset-black/30" : ""}`}
      style={viewportSize ? { width: viewportSize.w, height: viewportSize.h } : { width: "100%", height: 400 }}
      title={`${fileName} — page ${pageNumber}`}
    >
      <canvas ref={canvasRef} className="block" />
      <span className="absolute bottom-1 right-1.5 font-mono text-[9px] text-black/30 select-none">{pageNumber}</span>
    </div>
  );
}
