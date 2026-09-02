/**
 * LeadProfilePage
 *
 * Thin route wrapper that renders the unified ProfileShell in "lead" context.
 * Replaces the bespoke LeadDetailPage route so every profile entry point
 * shows the same consistent shell.
 *
 * Legacy route preserved: /admin/crm/leads/:id now points here.
 * LeadDetailPage.tsx is kept intact (nondestructive).
 */

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminLang } from "@/i18n/LanguageContext";
import ProfileShell from "./ProfileShell";

interface LeadNavigationItem {
  id: string;
  title: string;
}

interface LeadNavigationResponse {
  previous: LeadNavigationItem | null;
  next: LeadNavigationItem | null;
}

export default function LeadProfilePage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { t } = useAdminLang();
  const leadContextSearch = window.location.search;
  const { data: navigation, isLoading: isNavigationLoading } = useQuery<LeadNavigationResponse>({
    queryKey: [`/api/crm/leads/${id}/navigation${leadContextSearch}`],
  });

  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid={`page-lead-profile-${id}`}>
      {/* Back nav */}
      <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-gray-500 hover:text-gray-900"
          onClick={() => navigate(`/admin/crm${leadContextSearch}`)}
          data-testid="button-back-to-leads"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.pipeline.backToLeads}
        </Button>

        <div className="flex items-center gap-1" aria-label="Lead navigation">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isNavigationLoading || !navigation?.previous}
            onClick={() => navigation?.previous && navigate(`/admin/crm/leads/${navigation.previous.id}${leadContextSearch}`)}
            title={navigation?.previous?.title ?? t.common.previous}
            data-testid="button-previous-lead"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t.common.previous}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isNavigationLoading || !navigation?.next}
            onClick={() => navigation?.next && navigate(`/admin/crm/leads/${navigation.next.id}${leadContextSearch}`)}
            title={navigation?.next?.title ?? t.common.next}
            data-testid="button-next-lead"
          >
            <span className="hidden sm:inline">{t.common.next}</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Unified profile shell — lead context */}
      <div className="flex-1 overflow-y-auto">
        <ProfileShell entry={{ type: "lead", id }} />
      </div>
    </div>
  );
}
