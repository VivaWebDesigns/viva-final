/**
 * Shared entity mutation hooks for the unified profile system.
 *
 * Each hook:
 *  - Calls the authoritative REST endpoint for the entity type
 *  - Invalidates the unified profile cache on success so ProfileShell
 *    always shows fresh data after any edit
 *  - Also invalidates the raw entity list cache so tables/boards stay current
 *
 * Centralized invalidation lives in invalidateProfile() — a single function
 * that handles both the profile cache and the type-specific raw caches.
 */

import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PROFILE_KEYS } from "../hooks";
import type { ProfileEntry } from "../types";

// ── Shared invalidation ───────────────────────────────────────────────────────

function invalidateProfile(entry: ProfileEntry): void {
  queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
}

// ── Company ───────────────────────────────────────────────────────────────────

export interface EditCompanyValues {
  name?: string;
  dba?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  industry?: string | null;
  preferredLanguage?: string | null;
  notes?: string | null;
}

export function useEditCompany(companyId: string, entry: ProfileEntry) {
  return useMutation<void, Error, EditCompanyValues>({
    mutationFn: async (values) => {
      await apiRequest("PUT", `/api/crm/companies/${companyId}`, values);
    },
    onSuccess: () => {
      invalidateProfile(entry);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
    },
  });
}

// ── Contact ───────────────────────────────────────────────────────────────────

export interface EditContactValues {
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  title?: string | null;
  preferredLanguage?: string | null;
  notes?: string | null;
}

export function useEditContact(contactId: string, entry: ProfileEntry) {
  return useMutation<void, Error, EditContactValues>({
    mutationFn: async (values) => {
      await apiRequest("PUT", `/api/crm/contacts/${contactId}`, values);
    },
    onSuccess: () => {
      invalidateProfile(entry);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
  });
}

// ── Lead ──────────────────────────────────────────────────────────────────────

export interface EditLeadValues {
  title?: string;
  value?: string | null;
  source?: string | null;
  city?: string | null;
  state?: string | null;
  timezone?: string | null;
  notes?: string | null;
}

export function useEditLead(leadId: string, entry: ProfileEntry) {
  return useMutation<void, Error, EditLeadValues>({
    mutationFn: async (values) => {
      await apiRequest("PUT", `/api/crm/leads/${leadId}`, values);
    },
    onSuccess: () => {
      invalidateProfile(entry);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", leadId] });
    },
  });
}

// ── Opportunity ───────────────────────────────────────────────────────────────

export interface EditOpportunityValues {
  title?: string;
  value?: string | null;
  websitePackage?: "empieza" | "crece" | "domina" | null;
  status?: "open" | "won" | "lost";
  expectedCloseDate?: string | null;
  probability?: number | null;
  notes?: string | null;
}

export function useEditOpportunity(opportunityId: string, entry: ProfileEntry) {
  return useMutation<void, Error, EditOpportunityValues>({
    mutationFn: async (values) => {
      await apiRequest("PUT", `/api/pipeline/opportunities/${opportunityId}`, values);
    },
    onSuccess: () => {
      invalidateProfile(entry);
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", opportunityId] });
    },
  });
}
