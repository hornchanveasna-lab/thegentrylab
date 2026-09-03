import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthTender } from "@/lib/auth-tender";
import { useCurrentOrg, createTender, PROJECT_TYPES, PROJECT_TYPE_LABELS, type ProjectType } from "@/lib/tender-data";
import { PageShell, inputCls, labelCls } from "@/components/tender/shared";

export const Route = createFileRoute("/tender/new")({
  component: NewTender,
});

function NewTender() {
  const { user } = useAuthTender();
  const { orgId } = useCurrentOrg(user?.id);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [consultant, setConsultant] = useState("");
  const [location, setLocation] = useState("");
  const [tenderReference, setTenderReference] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [projectType, setProjectType] = useState<ProjectType | "">("");
  const [contractType, setContractType] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [biddingCompany, setBiddingCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || !orgId) return <div className="min-h-screen bg-white" />;

  async function handleSubmit() {
    if (!name.trim() || !user || !orgId) return;
    setSaving(true); setError(null);
    try {
      const tender = await createTender(orgId, user.id, {
        name: name.trim(),
        client: client.trim() || undefined,
        consultant: consultant.trim() || undefined,
        location: location.trim() || undefined,
        tender_reference: tenderReference.trim() || undefined,
        issue_date: issueDate || undefined,
        submission_deadline: submissionDeadline ? new Date(submissionDeadline).toISOString() : undefined,
        project_type: projectType || undefined,
        contract_type: contractType.trim() || undefined,
        currency,
        bidding_company: biddingCompany.trim() || undefined,
      });
      navigate({ to: "/tender/$tenderId", params: { tenderId: tender.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tender");
      setSaving(false);
    }
  }

  return (
    <PageShell title="Create Tender">
      <div className="max-w-2xl flex flex-col gap-5">
        <Field label="Tender name *"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="ABC Manufacturing Factory — Design and Build" /></Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Client"><input className={inputCls} value={client} onChange={(e) => setClient(e.target.value)} /></Field>
          <Field label="Consultant"><input className={inputCls} value={consultant} onChange={(e) => setConsultant(e.target.value)} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Location"><input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Phnom Penh, Cambodia" /></Field>
          <Field label="Tender reference"><input className={inputCls} value={tenderReference} onChange={(e) => setTenderReference(e.target.value)} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Issue date"><input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
          <Field label="Submission deadline"><input type="datetime-local" className={inputCls} value={submissionDeadline} onChange={(e) => setSubmissionDeadline(e.target.value)} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Project type">
            <select className={inputCls} value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)}>
              <option value="" className="bg-white text-gray-900">— Select —</option>
              {PROJECT_TYPES.map((pt) => <option key={pt} value={pt} className="bg-white text-gray-900">{PROJECT_TYPE_LABELS[pt]}</option>)}
            </select>
          </Field>
          <Field label="Contract type"><input className={inputCls} value={contractType} onChange={(e) => setContractType(e.target.value)} placeholder="Lump Sum, D&B, EPC…" /></Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Currency">
            <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["USD", "KHR", "EUR", "GBP", "SGD"].map((c) => <option key={c} value={c} className="bg-white text-gray-900">{c}</option>)}
            </select>
          </Field>
          <Field label="Bidding company"><input className={inputCls} value={biddingCompany} onChange={(e) => setBiddingCompany(e.target.value)} placeholder="Defaults to your company if blank" /></Field>
        </div>

        {error && <p className="text-[12px] text-red-600">{error}</p>}

        <button onClick={handleSubmit} disabled={saving || !name.trim()}
          className="py-3.5 rounded-2xl text-[13px] font-bold disabled:opacity-40 mt-2"
          style={{ backgroundColor: "#0696D7", color: "#ffffff" }}>
          {saving ? "Creating…" : "Create tender"}
        </button>
      </div>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}
