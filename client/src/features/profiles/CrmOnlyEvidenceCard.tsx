import { Card } from "@/components/ui/card";
import type { LocalFalconCrmOnlyEvidence } from "@shared/localVisibility";

export default function CrmOnlyEvidenceCard({ evidence }: { evidence: LocalFalconCrmOnlyEvidence }) {
  const market = evidence.marketReference;
  return (
    <Card className="border-amber-200 bg-amber-50 p-5" data-testid="card-crm-only-evidence">
      <h2 className="font-semibold text-gray-900">CRM only — no top-20 visibility</h2>
      <p className="mt-2 text-sm font-medium text-amber-950">
        Market reference only: {market.city}, {market.state} {market.zip}
      </p>
      <p className="mt-2 text-sm text-gray-700">
        This is auxiliary-scan market information, not a validated business location. No prospect-facing report
        has been created. Automatic scan outreach is disabled; use manual follow-up.
      </p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-gray-500">Contact readiness</dt><dd>{evidence.contactTag}</dd></div>
        <div><dt className="text-gray-500">Search phrase</dt><dd>{evidence.scanKeyword}</dd></div>
      </dl>
      <a href={market.auxiliary_report_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-indigo-700 underline">
        Auxiliary evidence — operational use only
      </a>
      <p className="mt-2 break-all text-xs text-gray-500">Place ID: {evidence.placeId}</p>
    </Card>
  );
}
