/**
 * Compact document browser + PDF viewer for the floating "Documents"
 * dock panel — lets a user keep a source document visible while working
 * in another tab (Requirements, Checklist, ...) without navigating away.
 * Intentionally standalone from documents.tsx's full folder-tree page so
 * the dock system doesn't entangle with that route's upload/tree logic.
 */
import { useState } from "react";
import { useTenderDocuments, getTenderDocumentUrl, type TenderDocument } from "@/lib/tender-data";
import { LoadingSpinner } from "@/components/tender/shared";
import { PdfCanvasViewer } from "@/components/tender/PdfCanvasViewer";

export function QuickDocumentsPanel({ tenderId }: { tenderId: string }) {
  const { data: documents = [], isLoading } = useTenderDocuments(tenderId);
  const [selected, setSelected] = useState<TenderDocument | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  function select(doc: TenderDocument) {
    setSelected(doc);
    setUrl(null);
    setUrlLoading(true);
    getTenderDocumentUrl(doc).then(setUrl).finally(() => setUrlLoading(false));
  }

  return (
    <div className="flex h-full">
      <div className="w-[200px] shrink-0 border-r border-white/8 overflow-y-auto">
        {isLoading ? (
          <LoadingSpinner />
        ) : documents.length === 0 ? (
          <p className="text-[11px] text-white/30 p-3">No documents yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/6">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => select(doc)}
                className={`text-left px-3 py-2 text-[11px] truncate transition-colors ${selected?.id === doc.id ? "bg-white/[0.06] text-[#ff5100]" : "text-white/70 hover:bg-white/[0.03]"}`}
                title={doc.file_name}
              >
                {doc.file_name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 p-3">
        {!selected ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[11px] text-white/30">Select a document to preview it.</p>
          </div>
        ) : urlLoading || !url ? (
          <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>
        ) : selected.file_type.toLowerCase() === "pdf" ? (
          <PdfCanvasViewer url={url} fileName={selected.file_name} onUrlExpired={() => getTenderDocumentUrl(selected)} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
            <p className="text-[11px] text-white/40">Preview isn't available here for .{selected.file_type.toLowerCase()} files.</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#ff5100" }}>
              Open in new tab ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
