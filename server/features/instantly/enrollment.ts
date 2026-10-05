import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { instantlyEnrollments } from "@shared/schema";
import { reportSendBlockedReason } from "@shared/reportOutreach";
import { db } from "../../db";
import { getFileBuffer, uploadColdEmailImage } from "../../services/storage";
import { getReportOutreachStates } from "../crm/reportOutreach";

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

/**
 * Publishes images and stages eligible leads as "ready". Nothing is sent to
 * Instantly here; enrolled rows are never downgraded.
 */
export async function prepareInstantlyEnrollment() {
  const { eligible, excluded } = selectInstantlyCandidates(await loadCandidateRows());
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
  return { prepared, failed, excludedCount: excluded.length };
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
  return updated;
}
