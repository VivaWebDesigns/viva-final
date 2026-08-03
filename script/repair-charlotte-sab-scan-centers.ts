import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../server/db";
import {
  crmCompanies,
  crmLeads,
  localFalconImportBatches,
  localFalconProspectProfiles,
} from "../shared/schema";

const BATCH_ID = "charlotte-plumbing-sab-2026-08-03";

const scanLocationSchema = z.object({
  place_id: z.string().min(1),
  company_name: z.string().min(1),
  center_lat: z.coerce.number().min(-90).max(90),
  center_lng: z.coerce.number().min(-180).max(180),
  scan_city: z.string().min(1),
  scan_state_code: z.string().regex(/^[A-Z]{2}$/),
  scan_zip: z.string().min(1),
});

const scanLocationsSchema = z.array(scanLocationSchema).length(36);

async function main() {
  const sourcePath = process.argv.find((argument) => argument.endsWith(".json"));
  const apply = process.argv.includes("--apply");
  if (!sourcePath) {
    throw new Error("Pass the verified scan-center JSON file path");
  }

  const locations = scanLocationsSchema.parse(JSON.parse(await readFile(sourcePath, "utf8")));
  const locationByPlaceId = new Map(locations.map((location) => [location.place_id, location]));
  if (locationByPlaceId.size !== locations.length) {
    throw new Error("The scan-center file contains duplicate Place IDs");
  }

  const rows = await db.select({
    profileId: localFalconProspectProfiles.id,
    placeId: localFalconProspectProfiles.placeId,
    companyName: localFalconProspectProfiles.companyName,
    leadId: crmLeads.id,
    companyId: crmCompanies.id,
    currentLeadCity: crmLeads.city,
    currentCompanyCity: crmCompanies.city,
  }).from(localFalconProspectProfiles)
    .innerJoin(
      localFalconImportBatches,
      eq(localFalconProspectProfiles.batchRecordId, localFalconImportBatches.id),
    )
    .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
    .innerJoin(crmCompanies, eq(crmLeads.companyId, crmCompanies.id))
    .where(eq(localFalconImportBatches.batchId, BATCH_ID));

  if (rows.length !== locations.length) {
    throw new Error(`Expected ${locations.length} imported rows for ${BATCH_ID}; found ${rows.length}`);
  }

  const missingMappings = rows.filter((row) => !locationByPlaceId.has(row.placeId));
  const missingProfiles = locations.filter(
    (location) => !rows.some((row) => row.placeId === location.place_id),
  );
  if (missingMappings.length || missingProfiles.length) {
    throw new Error(
      `Place ID mismatch: ${missingMappings.length} imported rows and ${missingProfiles.length} mappings are unmatched`,
    );
  }

  const preview = rows.map((row) => {
    const location = locationByPlaceId.get(row.placeId)!;
    if (row.companyName !== location.company_name) {
      throw new Error(`Company name mismatch for ${row.placeId}`);
    }
    return {
      companyName: row.companyName,
      from: `${row.currentLeadCity ?? row.currentCompanyCity ?? "Unknown"}`,
      to: `${location.scan_city}, ${location.scan_state_code} ${location.scan_zip}`,
    };
  });

  console.table(preview);
  if (!apply) {
    console.log(`Dry run complete for ${rows.length} records. Re-run with --apply to update production.`);
    return;
  }

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const location = locationByPlaceId.get(row.placeId)!;
      const now = new Date();
      await tx.update(localFalconProspectProfiles).set({
        scanCenterLat: String(location.center_lat),
        scanCenterLng: String(location.center_lng),
        scanCity: location.scan_city,
        scanState: location.scan_state_code,
        scanZip: location.scan_zip,
      }).where(and(
        eq(localFalconProspectProfiles.id, row.profileId),
        eq(localFalconProspectProfiles.placeId, row.placeId),
      ));
      await tx.update(crmLeads).set({
        city: location.scan_city,
        state: location.scan_state_code,
        updatedAt: now,
      }).where(eq(crmLeads.id, row.leadId));
      await tx.update(crmCompanies).set({
        city: location.scan_city,
        state: location.scan_state_code,
        zip: location.scan_zip,
        updatedAt: now,
      }).where(eq(crmCompanies.id, row.companyId));
    }
  });

  const verification = await db.select({
    placeId: localFalconProspectProfiles.placeId,
    scanCity: localFalconProspectProfiles.scanCity,
    scanState: localFalconProspectProfiles.scanState,
    scanZip: localFalconProspectProfiles.scanZip,
  }).from(localFalconProspectProfiles)
    .innerJoin(
      localFalconImportBatches,
      eq(localFalconProspectProfiles.batchRecordId, localFalconImportBatches.id),
    )
    .where(eq(localFalconImportBatches.batchId, BATCH_ID));

  const verificationFailures = verification.filter((row) => {
    const location = locationByPlaceId.get(row.placeId);
    return !location
      || row.scanCity !== location.scan_city
      || row.scanState !== location.scan_state_code
      || row.scanZip !== location.scan_zip;
  });
  if (verification.length !== rows.length || verificationFailures.length) {
    throw new Error(`Post-update verification failed for ${verificationFailures.length} records`);
  }

  console.log(`Applied scan-center locations to ${rows.length} imported records.`);
  console.log(`Verified ${verification.length} scan-center mappings.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
