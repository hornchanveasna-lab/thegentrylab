import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useAuthTender } from "@/lib/auth-tender";
import { useCurrentOrg, createTender, PROJECT_TYPES, PROJECT_TYPE_LABELS, type ProjectType } from "@/lib/tender-data";
import { PageShell, Card, Button, Banner, PageLoading, inputCls, labelCls, linkCls } from "@/components/tender/shared";

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

  if (!user || !orgId) return <PageLoading />;

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
    <PageShell
      title="Create tender"
      subtitle="Only the name is required — everything else can be filled in later from Settings."
      action={<Link to="/tender" className={linkCls}>← Back to dashboard</Link>}
    >
      {/* Grouped into the four things a tender record actually is — what it
          is, who is involved, when it runs, what it is worth — instead of
          one undifferentiated column of eleven inputs. */}
      <div className="max-w-3xl flex flex-col gap-4">
        {error && <Banner tone="error">{error}</Banner>}

        <Card title="Identification">
          <div className="flex flex-col gap-4">
            <Field label="Tender name" required>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)}
                placeholder="ABC Manufacturing Factory — Design and Build" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Tender reference" hint="The employer's own number for this package">
                <input className={inputCls} value={tenderReference} onChange={(e) => setTenderReference(e.target.value)} placeholder="ITT-2026-014" />
              </Field>
              <Field label="Project type">
                <select className={inputCls} value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)}>
                  <option value="">— Select —</option>
                  {PROJECT_TYPES.map((pt) => <option key={pt} value={pt}>{PROJECT_TYPE_LABELS[pt]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Location">
              <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Phnom Penh, Cambodia" />
            </Field>
          </div>
        </Card>

        <Card title="Parties">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Client">
              <input className={inputCls} value={client} onChange={(e) => setClient(e.target.value)} />
            </Field>
            <Field label="Consultant">
              <input className={inputCls} value={consultant} onChange={(e) => setConsultant(e.target.value)} />
            </Field>
            <Field label="Bidding company" hint="Defaults to your company if left blank">
              <input className={inputCls} value={biddingCompany} onChange={(e) => setBiddingCompany(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Dates">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Issue date">
              <input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
            <Field label="Submission deadline" hint="Drives the closing-soon alerts on your dashboard">
              <input type="datetime-local" className={inputCls} value={submissionDeadline} onChange={(e) => setSubmissionDeadline(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Commercial">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Contract type">
              <input className={inputCls} value={contractType} onChange={(e) => setContractType(e.target.value)} placeholder="Lump Sum, D&B, EPC…" />
            </Field>
            <Field label="Currency">
              <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["USD", "KHR", "EUR", "GBP", "SGD"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </Card>

        <div className="flex items-center gap-2 pb-4">
          <Button variant="primary" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? "Creating…" : "Create tender"}
          </Button>
          <Link to="/tender" className="text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-colors px-2">Cancel</Link>
        </div>
      </div>
    </PageShell>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className={labelCls}>
        {label}
        {required && <span className="text-red-700 ml-0.5" aria-hidden="true">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-gray-500">{hint}</span>}
    </label>
  );
}
