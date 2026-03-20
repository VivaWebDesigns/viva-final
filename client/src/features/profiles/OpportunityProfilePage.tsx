/**
 * OpportunityProfilePage
 *
 * Thin route wrapper that renders the unified ProfileShell in "opportunity"
 * context. Replaces the bespoke OpportunityDetailPage route so every profile
 * entry point shows the same consistent shell.
 *
 * Legacy route preserved: /admin/pipeline/opportunities/:id now points here.
 * OpportunityDetailPage.tsx is kept intact (nondestructive).
 */

import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProfileShell from "./ProfileShell";

export default function OpportunityProfilePage({ id }: { id: string }) {
  const [, navigate] = useLocation();

  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid={`page-opportunity-profile-${id}`}>
      {/* Back nav */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-gray-500 hover:text-gray-900"
          onClick={() => navigate("/admin/pipeline")}
          data-testid="button-back-to-pipeline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Pipeline
        </Button>
      </div>

      {/* Unified profile shell — opportunity context */}
      <div className="flex-1 overflow-y-auto">
        <ProfileShell entry={{ type: "opportunity", id }} />
      </div>
    </div>
  );
}
