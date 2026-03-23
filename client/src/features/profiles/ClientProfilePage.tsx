/**
 * ClientProfilePage
 *
 * Thin route wrapper that renders the unified ProfileShell in "company" context.
 * Replaces the bespoke client profile adapter layer so every profile entry point
 * shows the same consistent shell.
 *
 * Route: /admin/clients/:id
 * The legacy ClientProfilePage at features/clients/ClientProfilePage.tsx is
 * preserved intact (nondestructive).
 *
 * Unified profile architecture entry points:
 *   Lead        → /admin/crm/leads/:id         → profiles/LeadProfilePage
 *   Opportunity → /admin/pipeline/opportunities/:id → profiles/OpportunityProfilePage
 *   Client      → /admin/clients/:id           → profiles/ClientProfilePage  ← this file
 */

import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProfileShell from "./ProfileShell";

export default function ClientProfilePage({ id }: { id: string }) {
  const [, navigate] = useLocation();

  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid={`page-client-profile-${id}`}>
      {/* Back nav */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-gray-500 hover:text-gray-900"
          onClick={() => navigate("/admin/clients")}
          data-testid="button-back-to-clients"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Button>
      </div>

      {/* Unified profile shell — company context */}
      <div className="flex-1 overflow-y-auto">
        <ProfileShell entry={{ type: "company", id }} />
      </div>
    </div>
  );
}
