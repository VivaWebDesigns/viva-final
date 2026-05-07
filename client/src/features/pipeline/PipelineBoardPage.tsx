import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { STALE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, List, Phone, Building2, MapPin, UserRound } from "lucide-react";
import type { PipelineStage, PipelineOpportunity } from "@shared/schema";
import { formatPhoneDisplay } from "@shared/phone";
import QuickTaskModal from "@/components/QuickTaskModal";
import RecycledLeadIconStack from "@/components/RecycledLeadIconStack";
import { useAdminLang } from "@/i18n/LanguageContext";

type ContactSnap = { id: string; firstName: string; lastName: string | null; phone: string | null };
type CompanySnap = { id: string; name: string; city: string | null; industry: string | null };
type AssigneeSnap = { id: string; name: string };
type LeadRecycleSnap = { id: string; recycleCount: number };

interface BoardData {
  stages: PipelineStage[];
  board: Record<string, { stage: PipelineStage; opportunities: PipelineOpportunity[] }>;
  contactMap: Record<string, ContactSnap>;
  companyMap: Record<string, CompanySnap>;
  assigneeMap?: Record<string, AssigneeSnap>;
  leadRecycleMap?: Record<string, LeadRecycleSnap>;
}

const PKG_COLORS: Record<string, string> = {
  empieza: "bg-blue-100 text-blue-700",
  crece:   "bg-violet-100 text-violet-700",
  domina:  "bg-amber-100 text-amber-700",
};

function humanizeSlug(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function translateTrade(value: string, t: ReturnType<typeof useAdminLang>["t"]) {
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (t.crm.trades as Record<string, string>)[key] ?? humanizeSlug(value);
}

function normalizeDisplayName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function CardDisplay({
  opp,
  contactMap,
  companyMap,
  assigneeMap,
  leadRecycleMap,
  onTaskClick,
}: {
  opp: PipelineOpportunity;
  contactMap: Record<string, ContactSnap>;
  companyMap: Record<string, CompanySnap>;
  assigneeMap?: Record<string, AssigneeSnap>;
  leadRecycleMap?: Record<string, LeadRecycleSnap>;
  onTaskClick?: (opp: PipelineOpportunity) => void;
}) {
  const { t } = useAdminLang();
  const contact = opp.contactId ? contactMap[opp.contactId] : null;
  const company = opp.companyId ? companyMap[opp.companyId] : null;
  const contactName = contact ? `${contact.firstName}${contact.lastName ? " " + contact.lastName : ""}` : null;
  const pkg = (opp as any).websitePackage as string | null;
  const translatedIndustry = company?.industry ? translateTrade(company.industry, t) : null;
  const companyMatchesContact = Boolean(
    company?.name
    && contactName
    && normalizeDisplayName(company.name) === normalizeDisplayName(contactName)
  );
  const displayTitle = company && contactName && !companyMatchesContact
    ? `${company.name} – ${contactName}`
    : company?.name || contactName || opp.title;
  const assigneeName = assigneeMap
    ? (opp.assignedTo ? assigneeMap[opp.assignedTo]?.name ?? "Unknown rep" : "Unassigned")
    : null;
  const recycleCount = opp.leadId ? leadRecycleMap?.[opp.leadId]?.recycleCount ?? 0 : 0;

  return (
    <Card
      className="hover:shadow-md transition-all group cursor-default"
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <Link href={`/admin/pipeline/opportunities/${opp.id}`}>
              <span
                className="text-sm font-semibold text-slate-900 hover:text-[#0D9488] transition-colors line-clamp-1 block"
                data-testid={`text-opp-title-${opp.id}`}
              >
                {displayTitle}
              </span>
            </Link>

            {company && !companyMatchesContact && (
              <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate" data-testid={`text-opp-company-${opp.id}`}>{company.name}</span>
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1">
          {contact?.phone && (
            <div className="flex flex-col gap-0.5">
              <span
                className="flex items-center gap-1 text-xs text-slate-700 font-medium"
                data-testid={`link-phone-${opp.id}`}
              >
                <Phone className="w-3 h-3 flex-shrink-0" />
                {formatPhoneDisplay(contact.phone)}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
            {translatedIndustry && (
              <span data-testid={`text-opp-industry-${opp.id}`}>{translatedIndustry}</span>
            )}
            {company?.city && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                <span data-testid={`text-opp-city-${opp.id}`}>{company.city}</span>
              </span>
            )}
          </div>

          {(assigneeName || recycleCount > 0) && (
            <span className="flex items-center gap-1 text-xs text-slate-500" data-testid={`text-opp-assignee-${opp.id}`}>
              {assigneeName && (
                <>
                  <UserRound className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{assigneeName}</span>
                </>
              )}
              <RecycledLeadIconStack count={recycleCount} className={assigneeName ? "ml-0.5" : undefined} />
            </span>
          )}

          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2">
              {opp.value && parseFloat(opp.value) > 0 && (
                <span
                  className="flex items-center gap-0.5 text-xs font-semibold text-green-600"
                  data-testid={`text-opp-value-${opp.id}`}
                >
                  <DollarSign className="w-3 h-3" />
                  {parseFloat(opp.value).toLocaleString()}
                </span>
              )}
              {pkg && (
                <span
                  className={`text-[10px] font-semibold rounded px-1 py-0.5 uppercase tracking-wide ${PKG_COLORS[pkg] ?? "bg-gray-100 text-gray-600"}`}
                  data-testid={`badge-pkg-${opp.id}`}
                >
                  {pkg}
                </span>
              )}
            </div>

          </div>
        </div>

        {opp.status !== "open" && (
          <Badge
            variant={opp.status === "won" ? "default" : "destructive"}
            className="mt-2 text-xs"
          >
            {opp.status === "won" ? t.pipeline.closeWon.split("—")[1]?.trim() || "Won" : t.pipeline.closeLost.split("—")[1]?.trim() || "Lost"}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function OpportunityCard({
  opp,
  contactMap,
  companyMap,
  assigneeMap,
  leadRecycleMap,
  onTaskClick,
}: {
  opp: PipelineOpportunity;
  contactMap: Record<string, ContactSnap>;
  companyMap: Record<string, CompanySnap>;
  assigneeMap?: Record<string, AssigneeSnap>;
  leadRecycleMap?: Record<string, LeadRecycleSnap>;
  onTaskClick: (opp: PipelineOpportunity) => void;
}) {
  return (
    <div className="mb-2" data-testid={`card-opportunity-${opp.id}`}>
      <CardDisplay
        opp={opp}
        contactMap={contactMap}
        companyMap={companyMap}
        assigneeMap={assigneeMap}
        leadRecycleMap={leadRecycleMap}
        onTaskClick={onTaskClick}
      />
    </div>
  );
}

function StageColumn({
  stage,
  opportunities,
  contactMap,
  companyMap,
  assigneeMap,
  leadRecycleMap,
  onTaskClick,
}: {
  stage: PipelineStage;
  opportunities: PipelineOpportunity[];
  contactMap: Record<string, ContactSnap>;
  companyMap: Record<string, CompanySnap>;
  assigneeMap?: Record<string, AssigneeSnap>;
  leadRecycleMap?: Record<string, LeadRecycleSnap>;
  onTaskClick: (opp: PipelineOpportunity) => void;
}) {
  const { t } = useAdminLang();
  const totalValue = opportunities.reduce((sum, o) => sum + parseFloat(o.value || "0"), 0);

  return (
    <div
      className="flex-shrink-0 w-[272px] flex flex-col max-h-full"
      data-testid={`column-stage-${stage.slug}`}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
          <h3 className="text-sm font-semibold text-gray-700">{(t.pipeline.stageNames as Record<string, string>)[stage.slug] || stage.name}</h3>
          <Badge
            variant="secondary"
            className="text-xs h-5 px-1.5"
            data-testid={`badge-stage-count-${stage.slug}`}
          >
            {opportunities.length}
          </Badge>
        </div>
      </div>

      {totalValue > 0 && (
        <div className="text-xs text-gray-400 mb-2 px-1 flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          {totalValue.toLocaleString()}
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto min-h-[120px] px-1 pb-2 rounded-xl transition-all duration-150 bg-transparent"
      >
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.id}
            opp={opp}
            contactMap={contactMap}
            companyMap={companyMap}
            assigneeMap={assigneeMap}
            leadRecycleMap={leadRecycleMap}
            onTaskClick={onTaskClick}
          />
        ))}

        {opportunities.length === 0 && (
          <div
            className="flex items-center justify-center h-24 rounded-lg border-2 border-dashed transition-all duration-150 border-gray-200 text-gray-300"
          >
            <span className="text-xs font-medium">
              {t.pipeline.noOpportunities}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelineBoardPage() {
  const { t } = useAdminLang();
  const [taskOpp, setTaskOpp] = useState<PipelineOpportunity | null>(null);

  const { data, isLoading } = useQuery<BoardData>({
    queryKey: ["/api/pipeline/opportunities/board"],
    staleTime: STALE.FAST,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stages = data?.stages || [];
  const board = data?.board || {};
  const contactMap = data?.contactMap || {};
  const companyMap = data?.companyMap || {};
  const assigneeMap = data?.assigneeMap;
  const leadRecycleMap = data?.leadRecycleMap || {};

  return (
    <>
      <div className="h-full flex flex-col" data-testid="page-pipeline-board">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-pipeline-title">
              {t.pipeline.title}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t.pipeline.helperText}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/pipeline/list">
              <Button variant="outline" size="sm" data-testid="button-list-view">
                <List className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">{t.pipeline.listView}</span>
              </Button>
            </Link>
            <Link href="/admin/pipeline/stages">
              <Button variant="outline" size="sm" data-testid="button-manage-stages">
                <span className="hidden sm:inline">{t.pipeline.manageStages}</span>
                <span className="sm:hidden">Stages</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex-1 relative">
          <div
            className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none z-10 lg:hidden"
            aria-hidden="true"
          />
          <div
            className="h-full overflow-x-auto overscroll-x-contain touch-pan-x"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div
              className="flex gap-4 min-h-[400px] pb-4"
              style={{ minWidth: stages.length * 288 }}
            >
              {stages.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  opportunities={board[stage.id]?.opportunities || []}
                  contactMap={contactMap}
                  companyMap={companyMap}
                  assigneeMap={assigneeMap}
                  leadRecycleMap={leadRecycleMap}
                  onTaskClick={(opp) => setTaskOpp(opp)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <QuickTaskModal
        open={!!taskOpp}
        leadId={taskOpp?.leadId}
        onClose={() => setTaskOpp(null)}
        opportunityId={taskOpp?.id}
        contactId={taskOpp?.contactId}
        defaultTitle={taskOpp ? `Follow up with ${taskOpp.title}` : ""}
      />
    </>
  );
}
