import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthTender } from "@/lib/auth-tender";
import {
  useCurrentOrg, useTenderDocuments, uploadTenderDocument, deleteTenderDocument,
  updateTenderDocumentCategory, processTenderDocument, importTenderDocumentFromLink,
  getTenderDocumentUrl, TENDER_DOC_CATEGORIES, type TenderDocCategory, type TenderDocument,
} from "@/lib/tender-data";
import {
  TenderShell, Card, StatusBadge, EmptyState, LoadingSpinner, PageLoading, Button, Banner,
  Modal, humanize, selectCls, inputCls, ACCENT, ACCENT_TEXT,
} from "@/components/tender/shared";
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

function UploadProgressBar({ progress, onCancel }: { progress: UploadProgress; onCancel: () => void }) {
  const { filesDone, filesTotal, bytesDone, bytesTotal, startedAt } = progress;
  const pct = bytesTotal > 0 ? Math.min(100, (bytesDone / bytesTotal) * 100) : (filesDone / filesTotal) * 100;
  const elapsedSec = (Date.now() - startedAt) / 1000;
  const rate = bytesDone > 0 ? bytesDone / elapsedSec : 0; // bytes/sec
  const remainingBytes = Math.max(0, bytesTotal - bytesDone);
  const etaSec = rate > 0 ? remainingBytes / rate : null;

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex items-center justify-between mb-2 gap-3">
        <p className="text-[12px] text-gray-700">
          Uploading {filesDone}/{filesTotal} file{filesTotal !== 1 ? "s" : ""} · {formatBytes(bytesDone)} / {formatBytes(bytesTotal)}
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-[12px] text-gray-600 tabular-nums">
            {etaSec !== null ? `~${formatEta(etaSec)} left` : "estimating…"}
          </p>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: ACCENT }}
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: ACCENT }}>
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
        className={`font-medium transition-colors ${crumbs.length === 0 ? "text-gray-900" : "text-gray-600 hover:text-[#046C9B]"}`}
      >
        {rootLabel}
      </button>
      {crumbs.map((c, i) => {
        const segPath = crumbs.slice(0, i + 1).join("/");
        const isLast = i === crumbs.length - 1;
        return (
          <span key={segPath} className="flex items-center gap-1.5">
            <span className="text-gray-400" aria-hidden="true">/</span>
            <button
              onClick={() => onNavigate(segPath)}
              className={`transition-colors truncate max-w-[220px] ${isLast ? "text-gray-900 font-medium" : "text-gray-600 hover:text-[#046C9B]"}`}
            >
              {c}
            </button>
          </span>
        );
      })}
    </div>
  );
}

function FolderBrowser({ tree, onChanged, selectedId, onSelectFile }: {
  tree: DocTreeFolder; onChanged: () => void;
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
          <p className="text-[13px] text-gray-600 py-6 text-center">This folder is empty.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 -mt-1">
            {/* table-fixed makes the unwidthed Name column actually shrink
                (and truncate) to fit, instead of the browser sizing every
                column by content and pushing Category/Status/Actions off
                to the right behind a horizontal scrollbar. */}
            <table className="w-full text-[13px] border-collapse table-fixed">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="text-[12px] font-medium text-gray-600 pb-2 pl-5 pr-3">Name</th>
                  <th className="text-[12px] font-medium text-gray-600 pb-2 pr-3 w-[155px]">Category</th>
                  <th className="text-[12px] font-medium text-gray-600 pb-2 pr-3 w-[105px]">Status</th>
                  <th className="text-[12px] font-medium text-gray-600 pb-2 pr-5 w-[125px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {current.folders.map((sub) => (
                  <tr key={sub.path} onClick={() => setCurrentPath(sub.path)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <td colSpan={4} className="py-2.5 pl-5 pr-5">
                      <div className="flex items-center gap-2">
                        <FolderIcon size={15} />
                        <span className="font-medium text-gray-900 truncate flex-1">{sub.name}</span>
                        <span className="text-[11px] text-gray-500 shrink-0">{countTreeFiles(sub)} file{countTreeFiles(sub) !== 1 ? "s" : ""}</span>
                        <svg width="12" height="12" viewBox="0 0 10 10" className="shrink-0 text-gray-400">
                          <path d="M2 1 L8 5 L2 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </td>
                  </tr>
                ))}
                {current.files.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
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
          <p className="text-[13px] text-gray-600">Select a document to view it here.</p>
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
          <p className="text-[13px] font-medium text-gray-900 truncate">{doc.file_name}</p>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-[12px] font-medium text-gray-600 hover:text-[#046C9B] transition-colors">
            Open in new tab ↗
          </a>
        )}
      </div>
      {/* bg-gray-50, not the old bg-black/20 — that was a dark-theme leftover
          that only rendered light via an !important sweep in styles.css. */}
      <div className={`rounded-lg overflow-hidden bg-gray-50 border border-gray-200 ${ext === "pdf" ? "h-[75vh]" : "h-[70vh]"}`}>
        {loading ? (
          <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>
        ) : error ? (
          <div className="h-full flex items-center justify-center px-6 text-center">
            <p className="text-[13px] text-red-700">{error}</p>
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
            <p className="text-[13px] text-gray-600">Preview isn't available for .{ext} files.</p>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="text-[12px] font-medium hover:underline" style={{ color: ACCENT_TEXT }}>
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
  const abortControllerRef = useRef<AbortController | null>(null);

  if (!user || !orgId) return <PageLoading />;

  async function processUploadQueue() {
    if (!orgId) return;
    processingRef.current = true;
    setUploading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      while (uploadQueueRef.current.length > 0) {
        const item = uploadQueueRef.current.shift()!;
        const basisBytes = doneBytesRef.current;
        await uploadTenderDocument(orgId, tenderId, item.file, item.relativePath, (loaded) => {
          setUploadProgress((prev) => prev ? { ...prev, bytesDone: basisBytes + loaded } : prev);
        }, controller.signal);
        doneFilesRef.current += 1;
        doneBytesRef.current += item.file.size;
        const filesDone = doneFilesRef.current;
        const bytesDone = doneBytesRef.current;
        setUploadProgress((prev) => prev ? { ...prev, filesDone, bytesDone } : prev);
        await queryClient.invalidateQueries({ queryKey: ["tender_documents", tenderId] });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        uploadQueueRef.current = [];
        setUploadError(`Upload cancelled — ${doneFilesRef.current} file${doneFilesRef.current !== 1 ? "s" : ""} already uploaded stay in place.`);
      } else {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      }
    } finally {
      abortControllerRef.current = null;
      processingRef.current = false;
      setUploading(false);
      setUploadProgress(null);
      doneFilesRef.current = 0;
      doneBytesRef.current = 0;
    }
  }

  function cancelUpload() {
    abortControllerRef.current?.abort();
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length || !orgId) return;
    setUploadError(null);
    // webkitRelativePath is set for folder-picker uploads and preserves the
    // original tender-package folder structure (e.g. "01 Instructions to
    // Tenderers/ITT.pdf"); plain file picks fall back to just the name.
    const allItems = Array.from(fileList).map((file) => ({
      file,
      relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));

    // Guard against uploading the same file twice — e.g. clicking Upload
    // again while a large file/zip is still mid-processing. Checks both
    // already-uploaded documents and anything already queued this batch.
    const existingPaths = new Set(documents.map((d) => d.relative_path));
    const queuedPaths = new Set(uploadQueueRef.current.map((q) => q.relativePath));
    const items = allItems.filter((i) => !existingPaths.has(i.relativePath) && !queuedPaths.has(i.relativePath));
    const skipped = allItems.filter((i) => existingPaths.has(i.relativePath) || queuedPaths.has(i.relativePath));
    if (skipped.length > 0) {
      setUploadError(`Skipped ${skipped.length} file${skipped.length !== 1 ? "s" : ""} already in this tender: ${skipped.map((s) => s.file.name).join(", ")}`);
    }
    if (items.length === 0) return;

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
  const processed = documents.filter((d) => d.status === "processed").length;
  const failed = documents.filter((d) => d.status === "failed").length;

  return (
    <TenderShell tenderId={tenderId} title="Documents"
      subtitle={documents.length > 0
        ? `${documents.length} file${documents.length === 1 ? "" : "s"} · ${processed} processed${failed > 0 ? ` · ${failed} failed` : ""}`
        : undefined}
      action={
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={(e) => handleFiles(e.target.files)} />
          <input ref={folderInputRef} type="file" multiple className="hidden"
            {...{ webkitdirectory: "true", directory: "true" } as Record<string, string>}
            onChange={(e) => handleFiles(e.target.files)} />
          <Button onClick={() => fileInputRef.current?.click()}>Upload files</Button>
          <Button onClick={() => setLinkModalOpen(true)} disabled={linkImporting}>Add by link</Button>
          <Button variant="primary" onClick={() => folderInputRef.current?.click()}>
            {uploading ? "Add more…" : "Upload folder"}
          </Button>
        </div>
      }
    >
      {uploadError && <Banner tone="error" action={<Button size="sm" variant="ghost" onClick={() => setUploadError(null)}>Dismiss</Button>}>{uploadError}</Banner>}

      {uploadProgress && <UploadProgressBar progress={uploadProgress} onCancel={cancelUpload} />}

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
        className="relative rounded-lg transition-colors"
      >
        {dragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed pointer-events-none"
            style={{ borderColor: ACCENT, backgroundColor: "color-mix(in srgb, #0696D7 8%, white)" }}>
            <p className="text-[14px] font-semibold" style={{ color: ACCENT_TEXT }}>Drop files to upload</p>
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : documents.length === 0 ? (
          <EmptyState title="No documents uploaded yet"
            hint="Upload the full tender package — Instructions to Tenderers, conditions, specs, drawings, BOQ, forms. Drag and drop files here, or use the buttons above. ZIP and RAR archives auto-expand into their own folder once processed." />
        ) : (
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <div className="w-full lg:w-[400px] shrink-0">
              <FolderBrowser
                tree={tree}
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
    <Modal
      title="Add document by link"
      description={<>Paste a Google Drive or OneDrive/SharePoint share link. Make sure it's set to “Anyone with the link can view” — this only works for a single file, not a folder.</>}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={uploading}>Cancel</Button>
          <Button variant="primary" onClick={() => onSubmit(url)} disabled={uploading || !url.trim()}>
            {uploading ? "Importing…" : "Import"}
          </Button>
        </>
      }
    >
      <input
        autoFocus
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && url.trim() && !uploading) onSubmit(url); }}
        placeholder="https://drive.google.com/file/d/..."
        className={inputCls}
      />
    </Modal>
  );
}

function RemoveConfirmModal({ fileName, onCancel, onConfirm }: {
  fileName: string; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Modal
      title="Remove document?"
      description={<><span className="font-medium text-gray-900">{fileName}</span> and its extracted chunks will be removed permanently. This can't be undone.</>}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Remove forever</Button>
        </>
      }
    />
  );
}

function FileIcon({ fileType }: { fileType: string }) {
  const ext = fileType.toLowerCase();
  const color = ext === "pdf" ? "#b91c1c" : ext === "xlsx" || ext === "xls" || ext === "csv" ? "#15803d"
    : ext === "docx" || ext === "doc" ? "#1d4ed8" : ext === "zip" || ext === "rar" ? "#b45309" : "#6b7280";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color }}>
      <path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 2v6h6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DocumentRow({ doc, onChanged, selected, onSelect }: {
  doc: TenderDocument; onChanged: () => void; selected: boolean; onSelect: () => void;
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
    <tr className={`transition-colors ${selected ? "bg-[#0696D7]/[0.07]" : "hover:bg-gray-50"}`}>
      <td className="py-2.5 pl-5 pr-3 min-w-0">
        <button onClick={onSelect} title="Preview document" className="flex items-center gap-2 w-full text-left min-w-0">
          <FileIcon fileType={doc.file_type} />
          <span className={`truncate font-medium transition-colors ${selected ? "text-[#046C9B]" : "text-gray-900 hover:text-[#046C9B]"}`}>
            {doc.file_name}
          </span>
        </button>
        {doc.status === "failed" && doc.processing_error && (
          <p className="text-[11px] text-red-700 mt-0.5 truncate pl-[24px]" title={doc.processing_error}>{doc.processing_error}</p>
        )}
      </td>
      <td className="py-2.5 pr-3">
        <select
          value={doc.doc_category ?? ""}
          aria-label={`Category for ${doc.file_name}`}
          onChange={(e) => updateTenderDocumentCategory(doc.id, e.target.value as TenderDocCategory).then(onChanged)}
          className={`${selectCls} max-w-full`}
        >
          <option value="">Uncategorized</option>
          {TENDER_DOC_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
        </select>
        {doc.discipline && <span className="block text-[11px] text-gray-500 mt-0.5">{doc.discipline}</span>}
      </td>
      <td className="py-2.5 pr-3"><StatusBadge value={doc.status} /></td>
      <td className="py-2.5 pr-5 text-right whitespace-nowrap">
        <span className="inline-flex items-center gap-1 justify-end">
          {(doc.status === "failed" || doc.status === "uploaded") && (
            <Button
              size="sm"
              variant="ghost"
              disabled={retrying}
              title={doc.status === "uploaded" ? "Still shows Uploaded? Processing may have timed out (large zip/rar archives can exceed the 60s limit) — click to retry." : undefined}
              onClick={async () => { setRetrying(true); await processTenderDocument(doc.id); onChanged(); setRetrying(false); }}
            >
              {retrying ? "Retrying…" : "Retry"}
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={deleting} onClick={() => setConfirmOpen(true)}>
            {deleting ? "Removing…" : "Remove"}
          </Button>
        </span>
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
