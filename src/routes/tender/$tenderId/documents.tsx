import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthTender } from "@/lib/auth-tender";
import {
  useCurrentOrg, useTenderDocuments, uploadTenderDocument, deleteTenderDocument,
  updateTenderDocumentCategory, processTenderDocument, importTenderDocumentFromLink,
  getTenderDocumentUrl, TENDER_DOC_CATEGORIES, type TenderDocCategory, type TenderDocument,
} from "@/lib/tender-data";
import { TenderShell, Card, StatusBadge, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";
import { PdfCanvasViewer, type PdfScrollTarget } from "@/components/tender/PdfCanvasViewer";

export const Route = createFileRoute("/tender/$tenderId/documents")({
  component: TenderDocuments,
});

interface UploadProgress {
  filesDone: number;
  filesTotal: number;
  bytesDone: number;
  bytesTotal: number;
  startedAt: number;
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadProgressBar({ progress }: { progress: UploadProgress }) {
  const { filesDone, filesTotal, bytesDone, bytesTotal, startedAt } = progress;
  const pct = bytesTotal > 0 ? Math.min(100, (bytesDone / bytesTotal) * 100) : (filesDone / filesTotal) * 100;
  const elapsedSec = (Date.now() - startedAt) / 1000;
  const rate = bytesDone > 0 ? bytesDone / elapsedSec : 0; // bytes/sec
  const remainingBytes = Math.max(0, bytesTotal - bytesDone);
  const etaSec = rate > 0 ? remainingBytes / rate : null;

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-mono text-white/60">
          Uploading {filesDone}/{filesTotal} file{filesTotal !== 1 ? "s" : ""} · {formatBytes(bytesDone)} / {formatBytes(bytesTotal)}
        </p>
        <p className="text-[11px] font-mono text-white/40">
          {etaSec !== null ? `~${formatEta(etaSec)} left` : "estimating…"}
        </p>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: "#2563eb" }}
        />
      </div>
    </div>
  );
}

interface DocTreeFolder {
  name: string;
  path: string;
  folders: DocTreeFolder[];
  files: TenderDocument[];
}

function buildDocTree(documents: TenderDocument[]): DocTreeFolder {
  const root: DocTreeFolder = { name: "", path: "", folders: [], files: [] };
  const byPath = new Map<string, DocTreeFolder>([["", root]]);
  for (const doc of documents) {
    const parts = doc.relative_path.split("/");
    parts.pop();
    let current = root;
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let folder = byPath.get(currentPath);
      if (!folder) {
        folder = { name: part, path: currentPath, folders: [], files: [] };
        byPath.set(currentPath, folder);
        current.folders.push(folder);
      }
      current = folder;
    }
    current.files.push(doc);
  }
  function sortRec(f: DocTreeFolder) {
    f.folders.sort((a, b) => a.name.localeCompare(b.name));
    f.files.sort((a, b) => a.file_name.localeCompare(b.file_name));
    f.folders.forEach(sortRec);
  }
  sortRec(root);
  return root;
}

function countTreeFiles(f: DocTreeFolder): number {
  return f.files.length + f.folders.reduce((sum, sub) => sum + countTreeFiles(sub), 0);
}

function findDocFolder(tree: DocTreeFolder, path: string): DocTreeFolder | undefined {
  if (!path) return tree;
  let current = tree;
  for (const part of path.split("/")) {
    const next = current.folders.find((f) => f.name === part);
    if (!next) return undefined;
    current = next;
  }
  return current;
}

function FolderIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: "#2563eb" }}>
      <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Breadcrumbs({ rootLabel, path, onNavigate }: { rootLabel: string; path: string; onNavigate: (path: string) => void }) {
  const crumbs = path ? path.split("/") : [];
  return (
    <div className="flex items-center gap-1.5 mb-3 flex-wrap text-[12px]">
      <button
        onClick={() => onNavigate("")}
        className={`font-semibold transition-colors ${crumbs.length === 0 ? "text-white" : "text-white/50 hover:text-[#2563eb]"}`}
      >
        {rootLabel}
      </button>
      {crumbs.map((c, i) => {
        const segPath = crumbs.slice(0, i + 1).join("/");
        const isLast = i === crumbs.length - 1;
        return (
          <span key={segPath} className="flex items-center gap-1.5">
            <span className="text-white/20">/</span>
            <button
              onClick={() => onNavigate(segPath)}
              className={`transition-colors truncate max-w-[220px] ${isLast ? "text-white font-semibold" : "text-white/50 hover:text-[#2563eb]"}`}
            >
              {c}
            </button>
          </span>
        );
      })}
    </div>
  );
}

function FolderBrowser({ tree, tenderId, onChanged, selectedId, onSelectFile }: {
  tree: DocTreeFolder; tenderId: string; onChanged: () => void;
  selectedId: string | null; onSelectFile: (doc: TenderDocument) => void;
}) {
  const [currentPath, setCurrentPath] = useState("");
  const current = findDocFolder(tree, currentPath) ?? tree;

  const isEmpty = current.folders.length === 0 && current.files.length === 0;

  return (
    <div>
      <Breadcrumbs rootLabel="Documents" path={currentPath} onNavigate={setCurrentPath} />
      <Card>
        {isEmpty ? (
          <p className="text-[12px] text-white/30 py-6 text-center">This folder is empty.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 -mt-1">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="text-left border-b border-white/8">
                  <th className="font-mono text-[9px] font-medium uppercase tracking-widest text-white/35 pb-2 pl-5 pr-3">Name</th>
                  <th className="font-mono text-[9px] font-medium uppercase tracking-widest text-white/35 pb-2 pr-3 w-[170px]">Category</th>
                  <th className="font-mono text-[9px] font-medium uppercase tracking-widest text-white/35 pb-2 pr-3 w-[100px]">Status</th>
                  <th className="font-mono text-[9px] font-medium uppercase tracking-widest text-white/35 pb-2 pr-5 w-[110px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {current.folders.map((sub) => (
                  <tr key={sub.path} onClick={() => setCurrentPath(sub.path)} className="cursor-pointer hover:bg-white/[0.03] transition-colors">
                    <td colSpan={4} className="py-2 pl-5 pr-3">
                      <div className="flex items-center gap-2">
                        <FolderIcon size={14} />
                        <span className="font-semibold truncate flex-1">{sub.name}</span>
                        <span className="font-mono text-[9px] text-white/30 shrink-0">{countTreeFiles(sub)} file{countTreeFiles(sub) !== 1 ? "s" : ""}</span>
                        <svg width="12" height="12" viewBox="0 0 10 10" className="shrink-0">
                          <path d="M2 1 L8 5 L2 9" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </td>
                  </tr>
                ))}
                {current.files.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    tenderId={tenderId}
                    onChanged={onChanged}
                    selected={doc.id === selectedId}
                    onSelect={() => onSelectFile(doc)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const OFFICE_VIEWABLE_TYPES = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx"]);
const IMAGE_TYPES = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

function DocumentPreviewPane({ doc, scrollTarget, onScrollTargetConsumed }: {
  doc: TenderDocument | null;
  scrollTarget?: PdfScrollTarget | null;
  onScrollTargetConsumed?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) { setUrl(null); return; }
    let cancelled = false;
    setLoading(true); setError(null); setUrl(null);
    getTenderDocumentUrl(doc)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load preview"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [doc?.id]);

  if (!doc) {
    return (
      <Card>
        <div className="h-[70vh] flex items-center justify-center">
          <p className="text-[12px] text-white/30">Select a document to view it here.</p>
        </div>
      </Card>
    );
  }

  const ext = doc.file_type.toLowerCase();

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0 flex items-center gap-2">
          <FileIcon fileType={doc.file_type} />
          <p className="text-[12px] font-semibold truncate">{doc.file_name}</p>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-white/40 hover:text-[#2563eb] transition-colors">
            Open in new tab ↗
          </a>
        )}
      </div>
      <div className={`rounded-xl overflow-hidden bg-black/20 border border-white/8 ${ext === "pdf" ? "h-[75vh]" : "h-[70vh]"}`}>
        {loading ? (
          <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>
        ) : error ? (
          <div className="h-full flex items-center justify-center px-6 text-center">
            <p className="text-[12px] text-red-400">{error}</p>
          </div>
        ) : !url ? null : ext === "pdf" ? (
          <div className="h-full p-3">
            <PdfCanvasViewer
              url={url}
              fileName={doc.file_name}
              onUrlExpired={() => getTenderDocumentUrl(doc)}
              scrollTarget={scrollTarget}
              onScrollTargetConsumed={onScrollTargetConsumed}
            />
          </div>
        ) : IMAGE_TYPES.has(ext) ? (
          <div className="h-full flex items-center justify-center p-4">
            <img src={url} alt={doc.file_name} className="max-w-full max-h-full object-contain" />
          </div>
        ) : OFFICE_VIEWABLE_TYPES.has(ext) ? (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
            title={doc.file_name}
            className="w-full h-full border-0"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-[12px] text-white/40">Preview isn't available for .{ext} files.</p>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#2563eb" }}>
              Open in new tab ↗
            </a>
          </div>
        )}
      </div>
    </Card>
  );
}

function TenderDocuments() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { orgId } = useCurrentOrg(user?.id);
  const { data: documents = [], isLoading } = useTenderDocuments(tenderId);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [linkImporting, setLinkImporting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Multi-tab document workspace is a known near-term follow-up; for now
  // only one document is open for preview at a time.
  const [selectedDoc, setSelectedDoc] = useState<TenderDocument | null>(null);
  const [scrollTarget, setScrollTarget] = useState<PdfScrollTarget | null>(null);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  // Files picked while a batch is already uploading are appended to this
  // queue (and folded into the same progress bar's totals) instead of
  // starting a second overlapping upload loop that would reset the bar.
  const uploadQueueRef = useRef<{ file: File; relativePath: string }[]>([]);
  const processingRef = useRef(false);
  const doneFilesRef = useRef(0);
  const doneBytesRef = useRef(0);

  if (!user || !orgId) return <div className="min-h-screen bg-[#0a0a0b]" />;

  async function processUploadQueue() {
    if (!orgId) return;
    processingRef.current = true;
    setUploading(true);
    try {
      while (uploadQueueRef.current.length > 0) {
        const item = uploadQueueRef.current.shift()!;
        const basisBytes = doneBytesRef.current;
        await uploadTenderDocument(orgId, tenderId, item.file, item.relativePath, (loaded) => {
          setUploadProgress((prev) => prev ? { ...prev, bytesDone: basisBytes + loaded } : prev);
        });
        doneFilesRef.current += 1;
        doneBytesRef.current += item.file.size;
        const filesDone = doneFilesRef.current;
        const bytesDone = doneBytesRef.current;
        setUploadProgress((prev) => prev ? { ...prev, filesDone, bytesDone } : prev);
        await queryClient.invalidateQueries({ queryKey: ["tender_documents", tenderId] });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      processingRef.current = false;
      setUploading(false);
      setUploadProgress(null);
      doneFilesRef.current = 0;
      doneBytesRef.current = 0;
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length || !orgId) return;
    setUploadError(null);
    // webkitRelativePath is set for folder-picker uploads and preserves the
    // original tender-package folder structure (e.g. "01 Instructions to
    // Tenderers/ITT.pdf"); plain file picks fall back to just the name.
    const items = Array.from(fileList).map((file) => ({
      file,
      relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));
    const addedBytes = items.reduce((sum, i) => sum + i.file.size, 0);
    uploadQueueRef.current.push(...items);
    setUploadProgress((prev) => prev
      ? { ...prev, filesTotal: prev.filesTotal + items.length, bytesTotal: prev.bytesTotal + addedBytes }
      : { filesDone: 0, filesTotal: items.length, bytesDone: 0, bytesTotal: addedBytes, startedAt: Date.now() });
    if (!processingRef.current) processUploadQueue();
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setDragOver(true);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault(); // required for onDrop to fire
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  async function handleLinkImport(url: string) {
    if (!url.trim() || !orgId) return;
    setLinkImporting(true); setUploadError(null);
    try {
      await importTenderDocumentFromLink(tenderId, url.trim());
      await queryClient.invalidateQueries({ queryKey: ["tender_documents", tenderId] });
      setLinkModalOpen(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLinkImporting(false);
    }
  }

  const tree = buildDocTree(documents);

  return (
    <TenderShell tenderId={tenderId} title="Documents"
      action={
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={(e) => handleFiles(e.target.files)} />
          <input ref={folderInputRef} type="file" multiple className="hidden"
            {...{ webkitdirectory: "true", directory: "true" } as Record<string, string>}
            onChange={(e) => handleFiles(e.target.files)} />
          <button onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-colors">
            Upload Files
          </button>
          <button onClick={() => folderInputRef.current?.click()}
            className="px-3.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest"
            style={{ backgroundColor: "color-mix(in srgb, #2563eb 20%, transparent)", color: "#2563eb" }}>
            {uploading ? "Add more…" : "Upload Folder"}
          </button>
          <button onClick={() => setLinkModalOpen(true)} disabled={linkImporting}
            className="px-3.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 disabled:opacity-40 transition-colors">
            Add by Link
          </button>
        </div>
      }
    >
      {uploadError && <p className="text-[12px] text-red-400 mb-4">{uploadError}</p>}

      {uploadProgress && <UploadProgressBar progress={uploadProgress} />}

      {linkModalOpen && (
        <LinkImportModal
          uploading={linkImporting}
          onCancel={() => { setLinkModalOpen(false); setUploadError(null); }}
          onSubmit={handleLinkImport}
        />
      )}

      <div
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="relative rounded-2xl transition-colors"
      >
        {dragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed pointer-events-none"
            style={{ borderColor: "#2563eb", backgroundColor: "color-mix(in srgb, #2563eb 8%, transparent)" }}>
            <p className="text-[13px] font-bold" style={{ color: "#2563eb" }}>Drop files to upload</p>
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : documents.length === 0 ? (
          <EmptyState title="No documents uploaded yet"
            hint="Upload the full tender package — Instructions to Tenderers, conditions, specs, drawings, BOQ, forms. Drag and drop files here, or use Upload Files / Upload Folder / Add by Link above. ZIP and RAR archives auto-expand into their own folder once processed." />
        ) : (
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <div className="w-full lg:w-[380px] shrink-0">
              <FolderBrowser
                tree={tree}
                tenderId={tenderId}
                onChanged={() => queryClient.invalidateQueries({ queryKey: ["tender_documents", tenderId] })}
                selectedId={selectedDoc?.id ?? null}
                onSelectFile={setSelectedDoc}
              />
            </div>
            <div className="flex-1 min-w-0 w-full">
              <DocumentPreviewPane
                doc={selectedDoc}
                scrollTarget={scrollTarget}
                onScrollTargetConsumed={() => setScrollTarget(null)}
              />
            </div>
          </div>
        )}
      </div>
    </TenderShell>
  );
}

function LinkImportModal({ uploading, onCancel, onSubmit }: {
  uploading: boolean; onCancel: () => void; onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-[#0d0d10] border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-[14px] font-bold mb-1">Add document by link</p>
        <p className="text-[11px] text-white/40 mb-4">
          Paste a Google Drive or OneDrive/SharePoint share link. Make sure it's set to "Anyone with the link can view" — this only works for a single file, not a folder.
        </p>
        <input
          autoFocus
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && url.trim() && !uploading) onSubmit(url); }}
          placeholder="https://drive.google.com/file/d/..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[12px] mb-4 outline-none focus:border-white/25"
        />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} disabled={uploading}
            className="px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button onClick={() => onSubmit(url)} disabled={uploading || !url.trim()}
            className="px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest disabled:opacity-40"
            style={{ backgroundColor: "color-mix(in srgb, #2563eb 20%, transparent)", color: "#2563eb" }}>
            {uploading ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveConfirmModal({ fileName, onCancel, onConfirm }: {
  fileName: string; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-[#0d0d10] border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-[14px] font-bold mb-1">Remove document?</p>
        <p className="text-[11px] text-white/40 mb-5">
          <span className="text-white/70">{fileName}</span> and its extracted chunks will be removed permanently. This can't be undone.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel}
            className="px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
            Remove forever
          </button>
        </div>
      </div>
    </div>
  );
}

function FileIcon({ fileType }: { fileType: string }) {
  const ext = fileType.toLowerCase();
  const color = ext === "pdf" ? "#ef4444" : ext === "xlsx" || ext === "xls" || ext === "csv" ? "#22c55e"
    : ext === "docx" || ext === "doc" ? "#3b82f6" : ext === "zip" || ext === "rar" ? "#f59e0b" : "rgba(255,255,255,0.35)";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color }}>
      <path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 2v6h6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DocumentRow({ doc, onChanged, selected, onSelect }: {
  doc: TenderDocument; tenderId: string; onChanged: () => void; selected: boolean; onSelect: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleConfirmedRemove() {
    setDeleting(true);
    setConfirmOpen(false);
    deleteTenderDocument(doc).then(onChanged);
  }

  return (
    <tr className={`transition-colors ${selected ? "bg-white/[0.05]" : "hover:bg-white/[0.02]"}`}>
      <td className="py-2 pl-5 pr-3 min-w-0">
        <button onClick={onSelect} title="Preview document" className="flex items-center gap-2 w-full text-left min-w-0">
          <FileIcon fileType={doc.file_type} />
          <span className={`truncate font-medium transition-colors ${selected ? "text-[#2563eb]" : "hover:text-[#2563eb]"}`}>
            {doc.file_name}
          </span>
        </button>
        {doc.status === "failed" && doc.processing_error && (
          <p className="text-[9px] text-red-400/70 mt-0.5 truncate pl-[22px]" title={doc.processing_error}>{doc.processing_error}</p>
        )}
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1.5">
          <select
            value={doc.doc_category ?? ""}
            onChange={(e) => updateTenderDocumentCategory(doc.id, e.target.value as TenderDocCategory).then(onChanged)}
            className="bg-white/5 border border-white/10 rounded-lg px-1.5 py-1 text-[10px] text-white/60 max-w-full"
          >
            <option value="" className="bg-[#0a0a0b] text-white">Uncategorized</option>
            {TENDER_DOC_CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#0a0a0b] text-white">{humanize(c)}</option>)}
          </select>
        </div>
        {doc.discipline && <span className="font-mono text-[9px] text-white/30">{doc.discipline}</span>}
      </td>
      <td className="py-2 pr-3"><StatusBadge value={doc.status} /></td>
      <td className="py-2 pr-5 text-right whitespace-nowrap">
        {doc.status === "failed" && (
          <button
            disabled={retrying}
            onClick={async () => { setRetrying(true); await processTenderDocument(doc.id); onChanged(); setRetrying(false); }}
            className="text-white/40 hover:text-white transition-colors text-[10px] font-mono uppercase tracking-widest mr-2.5"
          >
            {retrying ? "Retrying…" : "Retry"}
          </button>
        )}
        <button
          disabled={deleting}
          onClick={() => setConfirmOpen(true)}
          className="transition-colors text-[10px] font-mono uppercase tracking-widest text-white/25 hover:text-red-400"
        >
          {deleting ? "Removing…" : "Remove"}
        </button>
        {confirmOpen && (
          <RemoveConfirmModal
            fileName={doc.file_name}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={handleConfirmedRemove}
          />
        )}
      </td>
    </tr>
  );
}
