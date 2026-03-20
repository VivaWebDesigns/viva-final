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

import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, STALE } from "@/lib/queryClient";
import type {
  ProfileEntry,
  ProfileEntryType,
  UnifiedProfileDto,
  UnifiedTimelineEvent,
} from "./types";

// ── Cache key factory ─────────────────────────────────────────────────────────

export const PROFILE_KEYS = {
  /** Matches all profile queries — use for broad invalidation only. */
  all: ["/api/profiles"] as const,

  /** Matches all profiles of a given entry type (e.g., all company profiles). */
  byType: (type: ProfileEntryType) => ["/api/profiles", type] as const,

  /** Exact key for one profile. Shared by useUnifiedProfile and useProfileTimeline. */
  detail: (entry: ProfileEntry) => ["/api/profiles", entry.type, entry.id] as const,
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

// ── useProfileMutations ───────────────────────────────────────────────────────

/**
 * Scaffold for profile-level mutations with centralized cache invalidation.
 *
 * invalidate()
 * ─────────────
 * Clears the profile cache for this entry AND the underlying entity caches
 * that feed into the profile (CRM leads, pipeline opportunities, etc.).
 * Call this from any mutation that changes data surfaced in the profile.
 *
 * Stub mutations
 * ──────────────
 * Each stub is wired to `invalidate` on success.  Replace the placeholder
 * mutationFn bodies as the corresponding API routes are built.
 */
export function useProfileMutations(entry: ProfileEntry) {
  // ── Centralized invalidation ────────────────────────────────────────────────

  function invalidate(): void {
    // Always clear this specific profile.
    queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });

    // Clear related raw-entity caches so detail pages stay in sync.
    switch (entry.type) {
      case "company":
        queryClient.invalidateQueries({ queryKey: ["/api/crm/companies", entry.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
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

  // ── Stub: add note ──────────────────────────────────────────────────────────
  // Will be wired to POST /api/crm/leads/:id/notes or POST /api/pipeline/activities
  // depending on entry type once the unified-write route is built.

  const addNote = useMutation<void, Error, { content: string }>({
    mutationFn: async (_payload) => {
      await apiRequest("POST", `/api/profiles/${entry.type}/${entry.id}/notes`, _payload);
    },
    onSuccess: invalidate,
  });

  // ── Stub: update status ─────────────────────────────────────────────────────
  // Will be wired to PATCH /api/crm/leads/:id (statusId) or pipeline stage changes.

  const updateStatus = useMutation<void, Error, { statusId: string }>({
    mutationFn: async (_payload) => {
      await apiRequest(
        "PATCH",
        `/api/profiles/${entry.type}/${entry.id}/status`,
        _payload,
      );
    },
    onSuccess: invalidate,
  });

  // ── Stub: assign owner ──────────────────────────────────────────────────────

  const assignOwner = useMutation<void, Error, { userId: string }>({
    mutationFn: async (_payload) => {
      await apiRequest(
        "PATCH",
        `/api/profiles/${entry.type}/${entry.id}/owner`,
        _payload,
      );
    },
    onSuccess: invalidate,
  });

  return {
    /** Invalidates this profile and all related entity caches. */
    invalidate,
    /** Add a note to this profile (stub — requires unified write route). */
    addNote,
    /** Update the status/stage (stub — requires unified write route). */
    updateStatus,
    /** Reassign the owning user (stub — requires unified write route). */
    assignOwner,
  } as const;
}

// ── Re-exports ────────────────────────────────────────────────────────────────
// Consumers only need to import from this file.

export type { ProfileEntry, ProfileEntryType, UnifiedProfileDto, UnifiedTimelineEvent };
