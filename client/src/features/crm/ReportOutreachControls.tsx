import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { STALE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CrmTag } from "@shared/schema";
import {
  REPORT_OUTREACH_SEGMENT_LABELS,
  type ReportOutreachFilter,
  type ReportOutreachSegment,
} from "@shared/reportOutreach";
import { useAdminLang } from "@/i18n/LanguageContext";

export interface OutreachBadgeState {
  reportEmailCount?: number;
  reportViewCount?: number;
  reportCtaClickCount?: number;
  reportOutreachSegment?: ReportOutreachSegment;
  reportNeedsAttention?: boolean;
}

export function ReportOutreachBadge({ state, testId }: { state?: OutreachBadgeState | null; testId?: string }) {
  const segment = state?.reportOutreachSegment;
  if (!segment || segment === "not_started") return null;
  let label = REPORT_OUTREACH_SEGMENT_LABELS[segment];
  let className = "bg-cyan-100 text-cyan-800 border-cyan-200";
  if (segment === "engaged") {
    label = (state?.reportCtaClickCount ?? 0) > 0 ? "Clicked report — personal touch" : "Viewed report — personal touch";
    className = "bg-amber-100 text-amber-900 border-amber-300";
  } else if (segment === "send_email_two" && state?.reportNeedsAttention) {
    label = "Email 2 due";
    className = "bg-orange-100 text-orange-900 border-orange-300";
  } else if (segment === "no_engagement") {
    className = "bg-slate-100 text-slate-700 border-slate-300";
  } else if (segment === "stopped") {
    className = "bg-red-50 text-red-700 border-red-200";
  } else if (segment === "responded") {
    className = "bg-emerald-100 text-emerald-800 border-emerald-300";
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {(state?.reportEmailCount ?? 0) > 0 && (
        <Badge variant="outline" className="text-xs bg-white text-cyan-800 border-cyan-200" data-testid={testId ? `${testId}-count` : undefined}>
          {Math.min(state?.reportEmailCount ?? 0, 2)} of 2 sent
        </Badge>
      )}
      <Badge variant="outline" className={`text-xs ${className}`} data-testid={testId}>{label}</Badge>
    </span>
  );
}

export function ReportOutreachAndTagFilters({
  reportOutreach,
  onReportOutreachChange,
  tagIds,
  onTagIdsChange,
  testIdPrefix,
}: {
  reportOutreach: ReportOutreachFilter | "all";
  onReportOutreachChange: (value: ReportOutreachFilter | "all") => void;
  tagIds: string[];
  onTagIdsChange: (ids: string[]) => void;
  testIdPrefix: string;
}) {
  const { t } = useAdminLang();
  const { data: allTags = [] } = useQuery<CrmTag[]>({
    queryKey: ["/api/crm/tags"],
    staleTime: STALE.SLOW,
  });

  return (
    <>
      <Select value={reportOutreach} onValueChange={(value) => onReportOutreachChange(value as ReportOutreachFilter | "all")}>
        <SelectTrigger className="w-full sm:w-56" data-testid={`${testIdPrefix}-report-outreach-filter`} aria-label="Report outreach filter">
          <SelectValue placeholder="Report outreach" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Report outreach: All</SelectItem>
          <SelectItem value="report_any">All report outreach</SelectItem>
          <SelectItem value="needs_attention">Needs attention</SelectItem>
          <SelectItem value="one_sent">1 of 2 sent</SelectItem>
          <SelectItem value="two_sent">2 of 2 sent</SelectItem>
          <SelectItem value="engaged">Viewed/clicked — personal touch</SelectItem>
          <SelectItem value="awaiting_response">Awaiting response</SelectItem>
          <SelectItem value="no_engagement">No engagement</SelectItem>
          <SelectItem value="stopped">Stopped</SelectItem>
        </SelectContent>
      </Select>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full sm:w-60 justify-between font-normal" data-testid={`${testIdPrefix}-tag-filter`}>
            <span className="truncate">
              {tagIds.length ? allTags.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.name).join(" + ") : t.crm.allTags}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>{t.crm.matchAllTags}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {allTags.map((tag) => (
            <DropdownMenuCheckboxItem
              key={tag.id}
              checked={tagIds.includes(tag.id)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => onTagIdsChange(
                checked ? [...new Set([...tagIds, tag.id])].sort() : tagIds.filter((id) => id !== tag.id),
              )}
            >
              {tag.name}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!tagIds.length} onSelect={() => onTagIdsChange([])}>
            {t.crm.clearTagFilters}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
