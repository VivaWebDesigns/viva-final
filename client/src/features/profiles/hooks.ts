/**
 * Unified Profile Hooks
 *
 * Three hooks that share a single HTTP request per profile via TanStack Query's
 * cache.  All hooks use the same query-key shape so they read from the same
 * cached slot — no duplicate network calls, no duplicate transformations.
 *
 * Query-key strategy
 * ──────────────────
 * ["/api/profiles", entry.type, entry.id]
 *
 * The TanStack default fetcher joins the key array with "/" which maps exactly
 * to the REST endpoints:
 *   ["company", "abc"] → /api/profiles/company/abc
 *   ["lead",    "abc"] → /api/profiles/lead/abc
 *   etc.
 *
 * Stale time: STALE.REALTIME (30 s) — shorter than the 1-min global default
 * because profile pages aggregate cross-domain data that changes frequently.
 */

import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { queryClient, apiRequest, STALE } from "@/lib/queryClient";
import type {
  ProfileEntry,
  ProfileEntryType,
  UnifiedProfileDto,
  UnifiedTimelineEvent,
  OrphanedOpportunityPayload,
} from "./types";
import { ProfileLinkageApiError } from "./types";

// ── Cache key factory ─────────────────────────────────────────────────────────

export const PROFILE_KEYS = {
  /** Matches all profile queries — use for broad invalidation only. */
  all: ["/api/profiles"] as const,

  /** Matches all profiles of a given entry type (e.g., all company profiles). */
  byType: (type: ProfileEntryType) => ["/api/profiles", type] as const,

  /** Exact key for one profile. Shared by useUnifiedProfile and useProfileTimeline. */
  detail: (entry: ProfileEntry) => ["/api/profiles", entry.type, entry.id] as const,

  /** Sub-resource reads owned by the profile layer. */
  notes: (companyId: string) => ["/api/profiles/company", companyId, "notes"] as const,
  tasks: (companyId: string) => ["/api/profiles/company", companyId, "tasks"] as const,
  files: (companyId: string) => ["/api/profiles/company", companyId, "files"] as const,
  billing: (companyId: string) => ["/api/profiles/company", companyId, "billing"] as const,
  activity: (companyId: string) => ["/api/profiles/company", companyId, "activity"] as const,
} as const;

// ── useUnifiedProfile ─────────────────────────────────────────────────────────

/**
 * Fetches the full UnifiedProfileDto for any profile entry point (company,
 * lead, or opportunity).  Data is cached under PROFILE_KEYS.detail(entry) and
 * shared with useProfileTimeline via TanStack Query's select mechanism.
 *
 * @param entry  The entity used as the profile anchor.
 * @param enabled  Optional override to disable the query (e.g. while an id is
 *                 being resolved).  Defaults to `true` when `entry.id` is set.
 */
export function useUnifiedProfile(
  entry: ProfileEntry,
  { enabled }: { enabled?: boolean } = {},
) {
  return useQuery<UnifiedProfileDto>({
    queryKey: PROFILE_KEYS.detail(entry),
    staleTime: STALE.REALTIME,
    refetchOnWindowFocus: true,
    enabled: enabled !== undefined ? enabled : Boolean(entry.id),
    // For opportunity entries: intercept the structured 422 PROFILE_LINKAGE_ERROR
    // response and re-throw it as a typed ProfileLinkageApiError that carries the
    // opportunity's own data.  All other status codes fall through to the standard
    // error path so global error-handling behaviour is unchanged.
    queryFn:
      entry.type === "opportunity"
        ? async () => {
            const url = PROFILE_KEYS.detail(entry).join("/");
            const res = await fetch(url, { credentials: "include" });

            if (res.status === 422) {
              let body: Record<string, unknown> = {};
              try {
                body = await res.json();
              } catch {
                // ignore parse failure — fall through to generic error below
              }
              if (body.code === "PROFILE_LINKAGE_ERROR") {
                throw new ProfileLinkageApiError(
                  typeof body.message === "string"
                    ? body.message
                    : "This opportunity has no linked company.",
                  typeof body.opportunityId === "string"
                    ? body.opportunityId
                    : entry.id,
                  (body.opportunity as OrphanedOpportunityPayload) ?? null,
                );
              }
            }

            if (!res.ok) {
              const text = (await res.text()) || res.statusText;
              throw new Error(`${res.status}: ${text}`);
            }

            return res.json() as Promise<UnifiedProfileDto>;
          }
        : undefined,
  });
}

// ── useProfileTimeline ────────────────────────────────────────────────────────

/**
 * Returns only the timeline event list from the profile DTO.
 *
 * Uses the *same* query key as useUnifiedProfile so no extra HTTP request is
 * made when both hooks are mounted for the same entry.  The `select` option
 * derives the slice from the cached value without re-fetching or re-mapping.
 *
 * @param entry   The entity used as the profile anchor.
 * @param enabled  Optional override to suspend the query.
 */
export function useProfileTimeline(
  entry: ProfileEntry,
  { enabled }: { enabled?: boolean } = {},
) {
  return useQuery<UnifiedProfileDto, Error, UnifiedTimelineEvent[]>({
    queryKey: PROFILE_KEYS.detail(entry),
    staleTime: STALE.REALTIME,
    refetchOnWindowFocus: true,
    enabled: enabled !== undefined ? enabled : Boolean(entry.id),
    select: (profile) => profile.timeline.events,
  });
}

// ── useInfiniteTimeline ───────────────────────────────────────────────────────

/**
 * Paginated timeline using cursor-based pagination against
 * GET /api/profiles/:type/:id/timeline?limit=&before=
 *
 * Returns a flat `events` array of all loaded events and TanStack Query
 * pagination helpers.  The TimelineSection renders these events and calls
 * `fetchNextPage()` when the user taps "Load more".
 *
 * This hook is separate from useProfileTimeline — it makes its own HTTP
 * requests rather than deriving from the profile DTO, giving it independent
 * control over pagination state.
 *
 * @param entry     The entity used as the profile anchor.
 * @param pageSize  Events per page (default 50, max 100 enforced by the server).
 */
export interface PaginatedTimelineResponse {
  events: UnifiedTimelineEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function useInfiniteTimeline(
  entry: ProfileEntry,
  { pageSize = 50, enabled }: { pageSize?: number; enabled?: boolean } = {},
) {
  const isEnabled = enabled !== undefined ? enabled : Boolean(entry.id);

  return useInfiniteQuery<PaginatedTimelineResponse, Error>({
    queryKey: ["/api/profiles", entry.type, entry.id, "timeline", pageSize],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (pageParam) params.set("before", pageParam as string);
      const url = `/api/profiles/${entry.type}/${entry.id}/timeline?${params}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json() as Promise<PaginatedTimelineResponse>;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

// ── useProfileMutations ───────────────────────────────────────────────────────

/**
 * Profile-level mutations with centralized cache invalidation.
 *
 * All three mutations are backed by real /api/profiles/... endpoints and
 * behave correctly for each entry type (company / lead / opportunity).
 *
 * invalidate()
 * ─────────────
 * Clears the profile cache for this entry AND the underlying entity caches
 * that feed into the profile. Call this from any mutation that changes data
 * surfaced in the profile.
 *
 * addNote     → POST /api/profiles/:type/:id/notes
 *               company → clientNotes, lead → crmLeadNotes, opportunity → pipelineActivities
 *
 * updateStatus → PATCH /api/profiles/:type/:id/status
 *               company → clientStatus field, lead → statusId, opportunity → stageId
 *
 * assignOwner → PATCH /api/profiles/:type/:id/owner
 *               company → accountOwnerId, lead/opportunity → assignedTo
 */
export function useProfileMutations(entry: ProfileEntry) {
  // ── Centralized invalidation ────────────────────────────────────────────────

  function invalidate(): void {
    queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });

    switch (entry.type) {
      case "company":
        queryClient.invalidateQueries({ queryKey: ["/api/crm/companies", entry.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
        queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.notes(entry.id) });
        break;

      case "lead":
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", entry.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", entry.id, "notes"] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", entry.id, "tags"] });
        break;

      case "opportunity":
        queryClient.invalidateQueries({
          queryKey: ["/api/pipeline/opportunities", entry.id],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/pipeline/opportunities", entry.id, "activities"],
        });
        break;
    }
  }

  // ── addNote ─────────────────────────────────────────────────────────────────
  // company  → POST /api/profiles/company/:id/notes  (clientNotes table)
  // lead     → POST /api/profiles/lead/:id/notes     (crmLeadNotes table)
  // opp      → POST /api/profiles/opportunity/:id/notes (pipelineActivities table)

  const addNote = useMutation<void, Error, { content: string; type?: string }>({
    mutationFn: async (payload) => {
      await apiRequest("POST", `/api/profiles/${entry.type}/${entry.id}/notes`, payload);
    },
    onSuccess: invalidate,
  });

  // ── updateStatus ────────────────────────────────────────────────────────────
  // company  → clientStatus (active/inactive/at_risk/churned/prospect)
  // lead     → statusId (lead status FK)
  // opp      → stageId (pipeline stage FK)

  const updateStatus = useMutation<void, Error, { statusId: string }>({
    mutationFn: async (payload) => {
      await apiRequest(
        "PATCH",
        `/api/profiles/${entry.type}/${entry.id}/status`,
        payload,
      );
    },
    onSuccess: invalidate,
  });

  // ── assignOwner ─────────────────────────────────────────────────────────────
  // company  → accountOwnerId
  // lead     → assignedTo
  // opp      → assignedTo

  const assignOwner = useMutation<void, Error, { userId: string }>({
    mutationFn: async (payload) => {
      await apiRequest(
        "PATCH",
        `/api/profiles/${entry.type}/${entry.id}/owner`,
        payload,
      );
    },
    onSuccess: invalidate,
  });

  return {
    /** Invalidates this profile and all related entity caches. */
    invalidate,
    /** Add a note to this profile. Routes to the correct domain table by entry type. */
    addNote,
    /** Update the status or stage for this profile. Routes by entry type. */
    updateStatus,
    /** Reassign the owning user for this profile. Routes by entry type. */
    assignOwner,
  } as const;
}

// ── Re-exports ────────────────────────────────────────────────────────────────
// Consumers only need to import from this file.

export type { ProfileEntry, ProfileEntryType, UnifiedProfileDto, UnifiedTimelineEvent };
