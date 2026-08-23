import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthTender } from "@/lib/auth-tender";
import {
  useCurrentOrg, useTenderDocuments, uploadTenderDocument, deleteTenderDocument,
  updateTenderDocumentCategory, processTenderDocument, importTenderDocumentFromLink,
  TENDER_DOC_CATEGORIES, type TenderDocCategory, type TenderDocument,
} from "@/lib/tender-data";
import { TenderShell, Card, StatusBadge, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

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

function DocTree({ tree, tenderId, onChanged }: { tree: DocTreeFolder; tenderId: string; onChanged: () => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function toggle(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }
  return <DocTreeLevel folder={tree} depth={0} collapsed={collapsed} onToggle={toggle} tenderId={tenderId} onChanged={onChanged} />;
}

function DocTreeLevel({ folder, depth, collapsed, onToggle, tenderId, onChanged }: {
  folder: DocTreeFolder; depth: number; collapsed: Set<string>; onToggle: (path: string) => void;
  tenderId: string; onChanged: () => void;
}) {
  return (
    <div className="flex flex-col divide-y divide-white/6">
      {folder.folders.map((sub) => {
        const isCollapsed = collapsed.has(sub.path);
        return (
          <div key={sub.path}>
            <button
              onClick={() => onToggle(sub.path)}
              className="w-full flex items-center gap-2 py-2.5 hover:bg-white/[0.03] transition-colors text-left"
              style={{ paddingLeft: `${depth * 18}px` }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className={`shrink-0 transition-transform ${isCollapsed ? "" : "rotate-90"}`}>
                <path d="M2 1 L8 5 L2 9" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: "#2563eb" }}>
                <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="text-[12px] font-semibold truncate">{sub.name}</span>
              <span className="ml-auto font-mono text-[9px] text-white/30 shrink-0 pr-2">{countTreeFiles(sub)}</span>
            </button>
            {!isCollapsed && (
              <DocTreeLevel folder={sub} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} tenderId={tenderId} onChanged={onChanged} />
            )}
          </div>
        );
      })}
      {folder.files.map((doc) => (
        <div key={doc.id} style={{ paddingLeft: `${depth * 18 + 22}px` }}>
          <DocumentRow doc={doc} tenderId={tenderId} onChanged={onChanged} />
        </div>
      ))}
    </div>
  );
}

function TenderDocuments() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { orgId } = useCurrentOrg(user?.id);
  const { data: documents = [], isLoading } = useTenderDocuments(tenderId);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!user || !orgId) return <div className="min-h-screen bg-[#0a0a0b]" />;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length || !orgId) return;
    setUploading(true); setUploadError(null);
    const files = Array.from(fileList);
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    let bytesDone = 0;
    const startedAt = Date.now();
    setUploadProgress({ filesDone: 0, filesTotal: files.length, bytesDone: 0, bytesTotal: totalBytes, startedAt });
    try {
      let filesDone = 0;
      let priorFilesBytes = 0;
      for (const file of files) {
        // webkitRelativePath is set for folder-picker uploads and preserves
        // the original tender-package folder structure (e.g. "01 Instructions
        // to Tenderers/ITT.pdf"); plain file picks fall back to just the name.
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const basisBytes = priorFilesBytes;
        await uploadTenderDocument(orgId, tenderId, file, relativePath, (loaded) => {
          setUploadProgress((prev) => prev ? { ...prev, bytesDone: basisBytes + loaded } : prev);
        });
        filesDone += 1;
        priorFilesBytes += file.size;
        bytesDone = priorFilesBytes;
        setUploadProgress((prev) => prev ? { ...prev, filesDone, bytesDone } : prev);
      }
      await queryClient.invalidateQueries({ queryKey: ["tender_documents", tenderId] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
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
    setUploading(true); setUploadError(null);
    try {
      await importTenderDocumentFromLink(tenderId, url.trim());
      await queryClient.invalidateQueries({ queryKey: ["tender_documents", tenderId] });
      setLinkModalOpen(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setUploading(false);
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
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="px-3.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 disabled:opacity-40 transition-colors">
            Upload Files
          </button>
          <button onClick={() => folderInputRef.current?.click()} disabled={uploading}
            className="px-3.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest disabled:opacity-40"
            style={{ backgroundColor: "color-mix(in srgb, #2563eb 20%, transparent)", color: "#2563eb" }}>
            {uploading ? "Uploading…" : "Upload Folder"}
          </button>
          <button onClick={() => setLinkModalOpen(true)} disabled={uploading}
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
          uploading={uploading}
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
            hint="Upload the full tender package — Instructions to Tenderers, conditions, specs, drawings, BOQ, forms. Drag and drop files here, or use Upload Files / Upload Folder / Add by Link above. ZIP archives auto-expand into their own folder once processed." />
        ) : (
          <Card>
            <DocTree
              tree={tree}
              tenderId={tenderId}
              onChanged={() => queryClient.invalidateQueries({ queryKey: ["tender_documents", tenderId] })}
            />
          </Card>
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

function DocumentRow({ doc, onChanged }: { doc: TenderDocument; tenderId: string; onChanged: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current); }, []);

  function handleRemoveClick() {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      confirmTimeoutRef.current = setTimeout(() => setConfirmingRemove(false), 4000);
      return;
    }
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    setDeleting(true);
    deleteTenderDocument(doc).then(onChanged);
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium truncate">{doc.file_name}</p>
        <div className="flex items-center gap-2 mt-1">
          <select
            value={doc.doc_category ?? ""}
            onChange={(e) => updateTenderDocumentCategory(doc.id, e.target.value as TenderDocCategory).then(onChanged)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/60"
          >
            <option value="" className="bg-[#0a0a0b] text-white">Uncategorized</option>
            {TENDER_DOC_CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#0a0a0b] text-white">{humanize(c)}</option>)}
          </select>
          {doc.discipline && <span className="font-mono text-[9px] text-white/30">{doc.discipline}</span>}
        </div>
        {doc.status === "failed" && doc.processing_error && (
          <p className="text-[10px] text-red-400/80 mt-1 truncate" title={doc.processing_error}>{doc.processing_error}</p>
        )}
      </div>
      <StatusBadge value={doc.status} />
      {doc.status === "failed" && (
        <button
          disabled={retrying}
          onClick={async () => { setRetrying(true); await processTenderDocument(doc.id); onChanged(); setRetrying(false); }}
          className="text-white/40 hover:text-white transition-colors text-[11px] font-mono uppercase tracking-widest shrink-0"
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      )}
      <button
        disabled={deleting}
        onClick={handleRemoveClick}
        onBlur={() => setConfirmingRemove(false)}
        className={`transition-colors text-[11px] font-mono uppercase tracking-widest shrink-0 ${
          confirmingRemove ? "text-red-400 font-bold" : "text-white/25 hover:text-red-400"
        }`}
      >
        {deleting ? "Removing…" : confirmingRemove ? "Confirm remove?" : "Remove"}
      </button>
    </div>
  );
}
