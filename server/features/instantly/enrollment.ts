import crypto from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { followupTasks, instantlyEnrollments, type InstantlyEnrollment } from "@shared/schema";
import { REPORT_INITIAL_TASK_TITLE, reportSendBlockedReason } from "@shared/reportOutreach";
import { db } from "../../db";
import { getFileBuffer, uploadColdEmailImage } from "../../services/storage";
import { getReportOutreachStates } from "../crm/reportOutreach";
import { addLeadsToCampaign, removeLead, updateLeadVariables } from "./client";

export interface InstantlyCandidateRow {
  leadId: string;
  reportId: string;
  email: string | null;
  businessName: string;
  searchPhrase: string;
  snapshotStorageKey: string | null;
  source: string | null;
  reportEmailCount: number;
  disposition: string | null;
  enrollmentStatus: string | null;
}

export type InstantlyExclusionReason =
  | "crm_only"
  | "no_snapshot"
  | "no_email"
  | "already_emailed"
  | "outreach_stopped"
  | "duplicate_email"
  | "already_enrolled";

export interface InstantlyCandidateSelection {
  eligible: InstantlyCandidateRow[];
  excluded: Array<{ leadId: string; businessName: string; reason: InstantlyExclusionReason }>;
}

/** Pure selection rules so the exclusions are testable without a database. */
export function selectInstantlyCandidates(rows: InstantlyCandidateRow[]): InstantlyCandidateSelection {
  const eligible: InstantlyCandidateRow[] = [];
  const excluded: InstantlyCandidateSelection["excluded"] = [];
  const seenEmails = new Set<string>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase() ?? "";
    let reason: InstantlyExclusionReason | null = null;
    if (row.source !== "local_falcon") reason = "crm_only";
    else if (!row.snapshotStorageKey) reason = "no_snapshot";
    else if (!email.includes("@")) reason = "no_email";
    else if (row.enrollmentStatus && row.enrollmentStatus !== "ready") reason = "already_enrolled";
    else if (row.reportEmailCount > 0) reason = "already_emailed";
    else if (reportSendBlockedReason(row.reportEmailCount, row.disposition)) reason = "outreach_stopped";
    else if (seenEmails.has(email)) reason = "duplicate_email";
    if (reason) {
      excluded.push({ leadId: row.leadId, businessName: row.businessName, reason });
      continue;
    }
    seenEmails.add(email);
    eligible.push({ ...row, email });
  }
  return { eligible, excluded };
}

/** SAB + Email Ready leads with their newest finished report, oldest lead first. */
async function loadCandidateRows(): Promise<InstantlyCandidateRow[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (l.id)
      l.id AS "leadId",
      p.id AS "reportId",
      COALESCE(NULLIF(TRIM(c.email), ''), NULLIF(TRIM(co.email), '')) AS email,
      COALESCE(NULLIF(TRIM(p.company_name), ''), co.name, l.title) AS "businessName",
      p.scan_keyword AS "searchPhrase",
      p.snapshot_storage_key AS "snapshotStorageKey",
      l.source,
      l.created_at AS "createdAt",
      e.status AS "enrollmentStatus"
    FROM crm_leads l
    JOIN local_falcon_prospect_profiles p ON p.lead_id = l.id
    LEFT JOIN crm_contacts c ON c.id = l.contact_id
    LEFT JOIN crm_companies co ON co.id = l.company_id
    LEFT JOIN instantly_enrollments e ON e.lead_id = l.id
    WHERE EXISTS (SELECT 1 FROM crm_lead_tags lt JOIN crm_tags t ON t.id = lt.tag_id WHERE lt.lead_id = l.id AND t.slug = 'sab')
      AND EXISTS (SELECT 1 FROM crm_lead_tags lt JOIN crm_tags t ON t.id = lt.tag_id WHERE lt.lead_id = l.id AND t.slug = 'email-ready')
    ORDER BY l.id, p.snapshot_storage_key IS NULL, p.snapshot_generated_at DESC NULLS LAST, p.scan_date DESC
  `);
  const rows = (result.rows as Array<Record<string, any>>)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const states = await getReportOutreachStates(rows.map(row => row.leadId as string));
  return rows.map(row => ({
    leadId: row.leadId,
    reportId: row.reportId,
    email: row.email ?? null,
    businessName: row.businessName,
    searchPhrase: row.searchPhrase,
    snapshotStorageKey: row.snapshotStorageKey ?? null,
    source: row.source ?? null,
    reportEmailCount: states.get(row.leadId)?.reportEmailCount ?? 0,
    disposition: states.get(row.leadId)?.reportOutreachDisposition ?? null,
    enrollmentStatus: row.enrollmentStatus ?? null,
  }));
}

export async function previewInstantlyEnrollment() {
  const selection = selectInstantlyCandidates(await loadCandidateRows());
  const excludedCounts: Partial<Record<InstantlyExclusionReason, number>> = {};
  for (const item of selection.excluded) excludedCounts[item.reason] = (excludedCounts[item.reason] ?? 0) + 1;
  return {
    eligibleCount: selection.eligible.length,
    excludedCounts,
    excluded: selection.excluded,
  };
}

/** Reports for the leads that would be staged, so their snapshots can be redrawn before launch. */
export async function listInstantlyRedrawQueue() {
  const { eligible } = selectInstantlyCandidates(await loadCandidateRows());
  if (!eligible.length) return [];
  const generated = await db.execute(sql`
    SELECT id, snapshot_generated_at AS "snapshotGeneratedAt" FROM local_falcon_prospect_profiles
    WHERE id IN (${sql.join(eligible.map(row => sql`${row.reportId}`), sql`, `)})
  `);
  const generatedAt = new Map((generated.rows as Array<{ id: string; snapshotGeneratedAt: Date | null }>)
    .map(row => [row.id, row.snapshotGeneratedAt]));
  return eligible.map(row => ({
    reportId: row.reportId,
    businessName: row.businessName,
    snapshotGeneratedAt: generatedAt.get(row.reportId) ?? null,
  }));
}

/** Copies a report's finished snapshot to the cold-email image domain. Content-hashed, so re-runs are no-ops. */
async function publishColdEmailImage(reportId: string, snapshotStorageKey: string) {
  const file = await getFileBuffer(snapshotStorageKey);
  const sha = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const published = await uploadColdEmailImage(file.buffer, `scans/${reportId}/${sha}.png`);
  return { imageUrl: published.url, imageSha256: sha };
}

/** Splits staged leads into those that still qualify and those that no longer do. */
export function partitionReadyEnrollments<T extends { leadId: string }>(ready: T[], eligibleLeadIds: Set<string>) {
  return {
    stillEligible: ready.filter(enrollment => eligibleLeadIds.has(enrollment.leadId)),
    noLongerEligible: ready.filter(enrollment => !eligibleLeadIds.has(enrollment.leadId)),
  };
}

/**
 * Rechecks every staged lead against the current rules. A lead that was
 * retagged, emailed by hand or opted out since staging is stopped, never sent.
 */
async function recheckReadyEnrollments() {
  const selection = selectInstantlyCandidates(await loadCandidateRows());
  const eligibleByLeadId = new Map(selection.eligible.map(row => [row.leadId, row]));
  const ready = await db.select().from(instantlyEnrollments)
    .where(eq(instantlyEnrollments.status, "ready"))
    .orderBy(instantlyEnrollments.createdAt);
  const { stillEligible, noLongerEligible } = partitionReadyEnrollments(ready, new Set(eligibleByLeadId.keys()));
  if (noLongerEligible.length) {
    await db.update(instantlyEnrollments).set({
      status: "stopped",
      lastError: "No longer qualifies for Instantly (rechecked before sending).",
      updatedAt: new Date(),
    }).where(inArray(instantlyEnrollments.id, noLongerEligible.map(enrollment => enrollment.id)));
  }
  return { selection, eligibleByLeadId, stillEligible, retired: noLongerEligible.map(enrollment => enrollment.businessName) };
}

/**
 * Publishes images and stages eligible leads as "ready". Nothing is sent to
 * Instantly here; enrolled rows are never downgraded.
 */
export async function prepareInstantlyEnrollment() {
  const { selection: { eligible, excluded }, retired } = await recheckReadyEnrollments();
  const failed: Array<{ leadId: string; businessName: string; error: string }> = [];
  let prepared = 0;
  for (const row of eligible) {
    try {
      const image = await publishColdEmailImage(row.reportId, row.snapshotStorageKey!);
      const values = {
        reportId: row.reportId,
        email: row.email!,
        businessName: row.businessName,
        searchPhrase: row.searchPhrase,
        imageUrl: image.imageUrl,
        imageSha256: image.imageSha256,
        lastError: null,
        updatedAt: new Date(),
      };
      await db.insert(instantlyEnrollments).values({ leadId: row.leadId, status: "ready", ...values })
        .onConflictDoUpdate({
          target: instantlyEnrollments.leadId,
          set: values,
          setWhere: eq(instantlyEnrollments.status, "ready"),
        });
      prepared++;
    } catch (error: any) {
      failed.push({ leadId: row.leadId, businessName: row.businessName, error: error.message });
    }
  }
  return { prepared, failed, excludedCount: excluded.length, retired };
}

/**
 * Called after a report snapshot is regenerated. Republishes the image for a
 * staged lead; an enrolled lead is flagged until Instantly holds the new URL.
 */
export async function refreshInstantlyEnrollmentImage(reportId: string) {
  const [enrollment] = await db.select().from(instantlyEnrollments)
    .where(eq(instantlyEnrollments.reportId, reportId)).limit(1);
  if (!enrollment || enrollment.status === "stopped") return null;
  const [report] = (await db.execute(sql`
    SELECT snapshot_storage_key AS "snapshotStorageKey" FROM local_falcon_prospect_profiles WHERE id = ${reportId}
  `)).rows as Array<{ snapshotStorageKey: string | null }>;
  if (!report?.snapshotStorageKey) return null;
  const image = await publishColdEmailImage(reportId, report.snapshotStorageKey);
  if (image.imageSha256 === enrollment.imageSha256) return enrollment;
  const [updated] = await db.update(instantlyEnrollments).set({
    imageUrl: image.imageUrl,
    imageSha256: image.imageSha256,
    imageSyncedAt: enrollment.status === "ready" ? enrollment.imageSyncedAt : null,
    updatedAt: new Date(),
  }).where(eq(instantlyEnrollments.id, enrollment.id)).returning();
  return updated.status === "enrolled" ? syncInstantlyLeadImage(updated) : updated;
}

/** The merge fields the Instantly campaign template uses. */
export function instantlyCustomVariables(enrollment: Pick<InstantlyEnrollment, "leadId" | "searchPhrase" | "imageUrl">) {
  return {
    searchPhrase: enrollment.searchPhrase,
    reportImageUrl: enrollment.imageUrl,
    crmLeadId: enrollment.leadId,
  };
}

/** Pushes the current image URL to Instantly; a failure leaves imageSyncedAt null so the admin page shows it. */
export async function syncInstantlyLeadImage(enrollment: InstantlyEnrollment) {
  if (enrollment.status !== "enrolled" || !enrollment.instantlyLeadId) return enrollment;
  try {
    await updateLeadVariables(enrollment.instantlyLeadId, instantlyCustomVariables(enrollment));
    const [synced] = await db.update(instantlyEnrollments)
      .set({ imageSyncedAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(instantlyEnrollments.id, enrollment.id)).returning();
    return synced;
  } catch (error: any) {
    const [failed] = await db.update(instantlyEnrollments)
      .set({ lastError: `Image sync failed: ${error.message}`, updatedAt: new Date() })
      .where(eq(instantlyEnrollments.id, enrollment.id)).returning();
    return failed;
  }
}

export async function retryInstantlyImageSyncs() {
  const pending = await db.select().from(instantlyEnrollments).where(and(
    eq(instantlyEnrollments.status, "enrolled"),
    sql`${instantlyEnrollments.imageSyncedAt} IS NULL`,
  ));
  let synced = 0;
  for (const enrollment of pending) {
    if ((await syncInstantlyLeadImage(enrollment)).imageSyncedAt) synced++;
  }
  return { attempted: pending.length, synced };
}

const INSTANTLY_BATCH_SIZE = 500;

/**
 * Sends every "ready" lead to the Instantly campaign. Leads Instantly already
 * holds anywhere in the workspace are skipped and marked as errors, never re-added.
 */
export async function pushReadyEnrollmentsToInstantly() {
  const { eligibleByLeadId, stillEligible: ready, retired } = await recheckReadyEnrollments();
  let enrolled = 0;
  const skipped: string[] = [];
  for (let start = 0; start < ready.length; start += INSTANTLY_BATCH_SIZE) {
    const batch = ready.slice(start, start + INSTANTLY_BATCH_SIZE);
    const { campaignId, result } = await addLeadsToCampaign(batch.map(enrollment => ({
      // The CRM's current address wins over the one captured at staging time.
      email: eligibleByLeadId.get(enrollment.leadId)!.email!,
      company_name: enrollment.businessName,
      custom_variables: instantlyCustomVariables(enrollment),
    })));
    const created = new Map((result.created_leads ?? []).map(lead => [lead.index, lead.id]));
    const now = new Date();
    for (const [index, enrollment] of batch.entries()) {
      const instantlyLeadId = created.get(index);
      if (!instantlyLeadId) {
        skipped.push(enrollment.businessName);
        await db.update(instantlyEnrollments).set({
          status: "error",
          lastError: "Instantly skipped this lead (already in the workspace or invalid email).",
          updatedAt: now,
        }).where(eq(instantlyEnrollments.id, enrollment.id));
        continue;
      }
      await db.update(instantlyEnrollments).set({
        status: "enrolled",
        instantlyLeadId,
        instantlyCampaignId: campaignId,
        enrolledAt: now,
        imageSyncedAt: now,
        lastError: null,
        updatedAt: now,
      }).where(eq(instantlyEnrollments.id, enrollment.id));
      enrolled++;
    }
    // Instantly owns the first email now; the manual Gmail task would double-send.
    const enrolledLeadIds = batch.filter((_, index) => created.has(index)).map(enrollment => enrollment.leadId);
    if (enrolledLeadIds.length) {
      await db.update(followupTasks).set({ completed: true, completedAt: now }).where(and(
        inArray(followupTasks.leadId, enrolledLeadIds),
        eq(followupTasks.completed, false),
        inArray(followupTasks.title, [REPORT_INITIAL_TASK_TITLE, "Contact lead"]),
      ));
    }
  }
  return { attempted: ready.length, enrolled, skipped, retired };
}

/** Removes a lead from the Instantly sequence after the CRM stops its outreach. */
export async function stopInstantlyEnrollment(leadId: string, reason: string) {
  const [enrollment] = await db.select().from(instantlyEnrollments)
    .where(eq(instantlyEnrollments.leadId, leadId)).limit(1);
  if (!enrollment || enrollment.status === "stopped") return;
  if (enrollment.status === "enrolled" && enrollment.instantlyLeadId) {
    try {
      await removeLead(enrollment.instantlyLeadId);
    } catch (error: any) {
      await db.update(instantlyEnrollments)
        .set({ lastError: `Could not remove from Instantly: ${error.message}`, updatedAt: new Date() })
        .where(eq(instantlyEnrollments.id, enrollment.id));
      return;
    }
  }
  await db.update(instantlyEnrollments)
    .set({ status: "stopped", lastError: reason, updatedAt: new Date() })
    .where(eq(instantlyEnrollments.id, enrollment.id));
}

export async function getInstantlyEnrollmentStatus(leadId: string) {
  const [enrollment] = await db.select({ status: instantlyEnrollments.status })
    .from(instantlyEnrollments).where(eq(instantlyEnrollments.leadId, leadId)).limit(1);
  return enrollment?.status ?? null;
}

export async function summarizeInstantlyEnrollments() {
  const rows = await db.select().from(instantlyEnrollments);
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return {
    counts,
    imageSyncPending: rows.filter(row => row.status === "enrolled" && !row.imageSyncedAt).length,
    problems: rows.filter(row => row.lastError && row.status !== "stopped")
      .map(row => ({ leadId: row.leadId, businessName: row.businessName, status: row.status, error: row.lastError })),
  };
}
