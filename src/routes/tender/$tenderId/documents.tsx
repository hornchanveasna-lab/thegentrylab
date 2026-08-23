import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthTender } from "@/lib/auth-tender";
import {
  useCurrentOrg, useTenderDocuments, uploadTenderDocument, deleteTenderDocument,
  updateTenderDocumentCategory, processTenderDocument, TENDER_DOC_CATEGORIES, type TenderDocCategory, type TenderDocument,
} from "@/lib/tender-data";
import { TenderShell, Card, StatusBadge, EmptyState, LoadingSpinner, humanize } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/$tenderId/documents")({
  component: TenderDocuments,
});

function TenderDocuments() {
  const { tenderId } = Route.useParams();
  const { user } = useAuthTender();
  const { orgId } = useCurrentOrg(user?.id);
  const { data: documents = [], isLoading } = useTenderDocuments(tenderId);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!user || !orgId) return <div className="min-h-screen bg-[#0a0a0b]" />;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length || !orgId) return;
    setUploading(true); setUploadError(null);
    try {
      const files = Array.from(fileList);
      for (const file of files) {
        // webkitRelativePath is set for folder-picker uploads and preserves
        // the original tender-package folder structure (e.g. "01 Instructions
        // to Tenderers/ITT.pdf"); plain file picks fall back to just the name.
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        await uploadTenderDocument(orgId, tenderId, file, relativePath);
      }
      await queryClient.invalidateQueries({ queryKey: ["tender_documents", tenderId] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Group by top-level folder (first path segment) to mirror the uploaded
  // structure in the UI, e.g. "01 Instructions to Tenderers/", "07 BOQ/".
  const groups = new Map<string, TenderDocument[]>();
  for (const doc of documents) {
    const folder = doc.relative_path.includes("/") ? doc.relative_path.split("/")[0] : "(root)";
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push(doc);
  }

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
        </div>
      }
    >
      {uploadError && <p className="text-[12px] text-red-400 mb-4">{uploadError}</p>}

      {isLoading ? (
        <LoadingSpinner />
      ) : documents.length === 0 ? (
        <EmptyState title="No documents uploaded yet"
          hint="Upload the full tender package — Instructions to Tenderers, conditions, specs, drawings, BOQ, forms. ZIP archives aren't auto-expanded yet; use “Upload Folder” to preserve structure." />
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from(groups.entries()).map(([folder, docs]) => (
            <Card key={folder} title={folder}>
              <div className="flex flex-col divide-y divide-white/6">
                {docs.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} tenderId={tenderId} onChanged={() => queryClient.invalidateQueries({ queryKey: ["tender_documents", tenderId] })} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </TenderShell>
  );
}

function DocumentRow({ doc, onChanged }: { doc: TenderDocument; tenderId: string; onChanged: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);

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
            <option value="">Uncategorized</option>
            {TENDER_DOC_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
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
        onClick={async () => { setDeleting(true); await deleteTenderDocument(doc); onChanged(); }}
        className="text-white/25 hover:text-red-400 transition-colors text-[11px] font-mono uppercase tracking-widest shrink-0"
      >
        Remove
      </button>
    </div>
  );
}
