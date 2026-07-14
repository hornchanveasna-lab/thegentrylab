import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { Avatar, CompanySelect, ConfirmationDialog } from "@/components/cm/shared";
import {
  useCMDirectoryContacts,
  createCMDirectoryContact,
  updateCMDirectoryContact,
  deleteCMDirectoryContact,
  uploadCMContactPhoto,
  useCMLinkedMembersByContact,
  type CMDirectoryContact,
  type CMLinkedMember,
} from "@/lib/cm-data";

export const Route = createFileRoute("/cm/directory")({
  head: () => ({ meta: [{ title: "Directory — Construction Management App" }] }),
  component: CMDirectoryPage,
});

const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";

function NewContactSheet({ ownerId, onClose, onCreated }: { ownerId: string; onClose: () => void; onCreated: () => void }) {
  const { t } = useCMLang();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [trade, setTrade] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createCMDirectoryContact(ownerId, {
        name: name.trim(),
        company: company.trim() || null,
        company_id: companyId,
        trade: trade.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contact");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-[#0d0d0e] rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mt-3 sm:hidden" />
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <h2 className="font-extrabold text-base tracking-tight text-white">{t("directory.new")}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 pb-8 pt-2 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("directory.name")}</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("directory.namePlaceholder")} required autoFocus disabled={saving} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("directory.company")}</span>
              <CompanySelect ownerId={ownerId} value={companyId} disabled={saving}
                onChange={(id, resolvedName) => { setCompanyId(id); setCompany(resolvedName); }} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("directory.trade")}</span>
              <input className={inputCls} value={trade} onChange={(e) => setTrade(e.target.value)} placeholder={t("directory.tradePlaceholder")} disabled={saving} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("directory.phone")}</span>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>{t("directory.email")}</span>
              <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{t("directory.notes")}</span>
            <textarea className={`${inputCls} resize-y min-h-[56px]`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
          </label>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
          <button type="submit" disabled={saving || !name.trim()}
            className="w-full mt-1 py-3.5 rounded-2xl text-[13px] uppercase tracking-widest text-black font-bold transition-all disabled:opacity-40"
            style={{ backgroundColor: "#ff5100" }}>
            {saving ? t("directory.adding") : t("directory.add")}
          </button>
        </form>
      </div>
    </div>
  );
}

function ContactCard({ contact, ownerId, onChanged, linked }: { contact: CMDirectoryContact; ownerId: string; onChanged: () => void; linked?: CMLinkedMember }) {
  const { t } = useCMLang();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDelete = async () => {
    setConfirmingDelete(false);
    setBusy(true);
    try { await deleteCMDirectoryContact(contact.id); onChanged(); } finally { setBusy(false); }
  };

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCMContactPhoto(ownerId, contact.id, file);
      await updateCMDirectoryContact(contact.id, { photo_url: url });
      onChanged();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-[#0d0d0e] px-5 py-4 flex items-start justify-between gap-3">
      <div className="min-w-0 flex items-center gap-3">
        <label className="relative shrink-0 cursor-pointer">
          <Avatar name={contact.name} photoUrl={contact.photo_url ?? linked?.avatar_url} size={40} />
          <input type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={(e) => { handlePhoto(e.target.files?.[0]); e.target.value = ""; }} />
          {uploading && <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white/70 text-[9px]">…</span>}
        </label>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[13px] font-bold text-white leading-tight">{contact.name}</h3>
            {linked && (
              <span className="font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(255,81,0,0.15)", color: "#ff5100" }}>
                {t("directory.linkedBadge")}
              </span>
            )}
          </div>
          <p className="text-[12px] text-white/45 mt-0.5">
            {[contact.trade, contact.company].filter(Boolean).join(" · ") || "—"}
          </p>
          {(contact.phone || contact.email) && (
            <p className="font-mono text-[10px] text-white/30 mt-1">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</p>
          )}
          {contact.notes && <p className="text-[11px] text-white/35 mt-1.5">{contact.notes}</p>}
        </div>
      </div>
      <button onClick={() => setConfirmingDelete(true)} disabled={busy} className="text-white/25 hover:text-red-400 shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">×</button>
      {confirmingDelete && (
        <ConfirmationDialog message={t("directory.confirmRemove", { name: contact.name })} confirmLabel={t("common.delete")}
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}

function CMDirectoryPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const queryClient = useQueryClient();
  const { data: contacts, isLoading } = useCMDirectoryContacts(user?.id);
  const { data: linkedMembers } = useCMLinkedMembersByContact(user?.id);
  const linkedByContact = new Map((linkedMembers ?? []).map((m) => [m.contact_id, m]));
  const [showNew, setShowNew] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cm_directory_contacts", user?.id] });
    setShowNew(false);
  };

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()}
          className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
          style={{ backgroundColor: "#ff5100" }}>
          {t("common.signInGoogle")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-6 pb-28">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/cm" className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight text-white">{t("directory.title")}</h1>
        </div>

        {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
        {!isLoading && (contacts?.length ?? 0) === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 py-16 flex flex-col items-center justify-center text-center px-4">
            <p className="text-white/40 text-sm mb-4">{t("directory.noneYet")}</p>
            <button onClick={() => setShowNew(true)}
              className="px-5 py-2.5 rounded-full text-[11px] font-mono uppercase tracking-widest"
              style={{ backgroundColor: "rgba(255,81,0,0.12)", color: "#ff5100" }}>
              {t("directory.addFirst")}
            </button>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {(contacts ?? []).map((c) => <ContactCard key={c.id} contact={c} ownerId={user.id} onChanged={invalidate} linked={linkedByContact.get(c.id)} />)}
        </div>
      </main>

      <button
        onClick={() => setShowNew(true)}
        aria-label={t("directory.new")}
        className="fixed bottom-7 right-6 w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_8px_24px_rgba(255,81,0,0.4)] active:scale-95 transition-transform"
        style={{ backgroundColor: "#ff5100" }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </button>

      {showNew && user && <NewContactSheet ownerId={user.id} onClose={() => setShowNew(false)} onCreated={invalidate} />}
    </div>
  );
}
