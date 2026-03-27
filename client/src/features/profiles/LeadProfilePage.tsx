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

import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminLang } from "@/i18n/LanguageContext";
import ProfileShell from "./ProfileShell";

export default function LeadProfilePage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { t } = useAdminLang();

  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid={`page-lead-profile-${id}`}>
      {/* Back nav */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-gray-500 hover:text-gray-900"
          onClick={() => navigate("/admin/crm")}
          data-testid="button-back-to-leads"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.pipeline.backToLeads}
        </Button>
      </div>

      {/* Unified profile shell — lead context */}
      <div className="flex-1 overflow-y-auto">
        <ProfileShell entry={{ type: "lead", id }} />
      </div>
    </div>
  );
}
