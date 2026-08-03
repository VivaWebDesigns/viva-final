import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../server/db";
import {
  localFalconImportBatches,
  localFalconProspectProfiles,
} from "../shared/schema";

const EXCLUDED_BATCH_ID = "charlotte-plumbing-sab-2026-08-03";

const rankings = [
  {
    leadId: "19854d22-c086-49dc-908f-b50accc33157",
    companyName: "Albert and Son Plumbing LLC",
    tier: "2",
    reason: "The company website redirects to its former web agency, but fading reviews and capacity constraints weaken the timing.",
  },
  {
    leadId: "c6cf0226-9d8f-4637-b80b-13439b10b8c8",
    companyName: "All Good Plumbing, LLC",
    tier: "3",
    reason: "Healthy 335-review business buying Thumbtack leads while its templated site targets the wrong market.",
  },
  {
    leadId: "03bd8a57-6f29-446d-b585-1c5646992746",
    companyName: "Boda Plumbing, Inc.",
    tier: "3",
    reason: "Review production is accelerating while four nearly empty service pages miss every high-intent plumbing search.",
  },
  {
    leadId: "c1475e42-1149-4051-a5d5-48fc8ab7c187",
    companyName: "Building Trust Plumbing, LLC",
    tier: "2",
    reason: "The site targets the wrong city and contains unfinished content, but the recent review campaign has already stalled.",
  },
  {
    leadId: "642a0ae6-d48c-4c0e-b02f-6f57bd6cd4f1",
    companyName: "ClearDrop Solutions LLC",
    tier: "2",
    reason: "Free Google Sites page with no service content, but the company has only thirteen reviews and no clear spend signal.",
  },
  {
    leadId: "0e33563d-c82b-4b0a-9aed-beb00eab46ce",
    companyName: "Clog Busterz Inc.",
    tier: "3",
    reason: "Active 126-review company with strong commercial work, but its rebuild erased local targeting and omits proven services.",
  },
  {
    leadId: "db3022f2-9766-49ea-b310-dccd5bb07ac3",
    companyName: "Clog Busterz Plumbing Inc.",
    tier: "1",
    reason: "Two-review secondary listing of the established Clog Busterz business, not a distinct website-sales prospect.",
  },
  {
    leadId: "3eb484cf-3d99-44e9-aed7-0eaad3c6d237",
    companyName: "Copperheads Plumbing",
    tier: "3",
    reason: "Active ads and paid lead channels feed a broken SPA whose city pages canonicalize themselves out of Google.",
  },
  {
    leadId: "b7702e3c-1a2a-43ab-a74f-f6785241b1a9",
    companyName: "Direct Service Plumbing",
    tier: "3",
    reason: "Steady 158-review operation with visible template placeholders, wrong-market targeting, and no pages for its biggest jobs.",
  },
  {
    leadId: "1eaee05c-c87b-4f18-9930-a48884650162",
    companyName: "Elite Plumbing LLC",
    tier: "3",
    reason: "Fast-growing review base paired with a one-page site, wrong-market content, and a canonical tag crediting another domain.",
  },
  {
    leadId: "2eef7c61-2b21-4754-9880-7ae6ec0db939",
    companyName: "FATman Plumbing Pro",
    tier: "3",
    reason: "Healthy sustained reviews and recent marketing activity sit behind a stale one-page service section.",
  },
  {
    leadId: "2ed699b6-399f-4e35-9971-cdb195834340",
    companyName: "Gene Plumbing inc",
    tier: "2",
    reason: "Eleven thin wrong-market pages create need, but the company has only nineteen reviews and no spend signal.",
  },
  {
    leadId: "73c2008a-8357-455a-a04a-37865cd098fe",
    companyName: "Happi Plumbing Corp",
    tier: "3",
    reason: "Large multi-truck company with explosive reviews and lead-chasing behavior, undermined by duplicate domains and thin pages.",
  },
  {
    leadId: "42279ecf-6612-49b5-a651-930031f9b63c",
    companyName: "Harvey's Plumbing",
    tier: "3",
    reason: "Improving review activity and valuable specialty work rely on a single spammy service page with no profile management.",
  },
  {
    leadId: "be35ca0a-725a-45f9-85e6-3d0ae2b904ac",
    companyName: "Huff Plumbing, Inc.",
    tier: "2",
    reason: "Broken forty-word homepage and conflicting addresses create obvious need, but business activity remains modest.",
  },
  {
    leadId: "d111f204-a09c-417d-9fd9-ef4802af56da",
    companyName: "LG Plumbing & Drain Services LLC",
    tier: "3",
    reason: "A 272-review company buying Thumbtack leads has zero service pages for its extensive high-value work.",
  },
  {
    leadId: "181fb723-50e4-48c4-a49b-b0f1f643bdcd",
    companyName: "Lowery Brothers Plumbing Company",
    tier: "2",
    reason: "Broken Wix structure and phone conflicts create need, but review velocity is fading and map visibility is already strong.",
  },
  {
    leadId: "e6cf7300-a31e-440e-a122-10b41a506b1f",
    companyName: "M.D. Plumbing, Water Heater & Sewer Repair",
    tier: "1",
    reason: "Market leader with thirty service pages and an active professional growth campaign; not a realistic website prospect.",
  },
  {
    leadId: "4e8fd33d-0351-4f3f-bffd-d1a316355e21",
    companyName: "Nadi Services",
    tier: "2",
    reason: "Deep but mis-targeted site and poor visibility create technical need, offset by low volume and questionable review signals.",
  },
  {
    leadId: "cb2bc32e-6325-4711-90b9-73613edd6c33",
    companyName: "Power Plumbing, LLC",
    tier: "2",
    reason: "Thin abandoned local-SEO build and zero review engagement, but review production has largely collapsed.",
  },
  {
    leadId: "253bbe58-dcb1-480a-a52b-e5bbc4ed84b5",
    companyName: "Red Fox Plumbing",
    tier: "3",
    reason: "Growing multi-person company with 354 organic reviews and no marketing support, while its site targets the wrong market.",
  },
  {
    leadId: "fd7811d0-91bf-4a52-b8ee-41c7fd34af25",
    companyName: "Roger Rooter Plumbing Service & Repair",
    tier: "2",
    reason: "Strong 155-review reputation sits on a nearly unindexable site, but reviews and owner engagement are declining.",
  },
  {
    leadId: "44ec9d6d-c8ae-4782-8c15-6636c735ab10",
    companyName: "TOLINY Plumbing and Electric",
    tier: "2",
    reason: "Stale split-domain site with shallow service pages, but the solo operation produces only low steady review volume.",
  },
  {
    leadId: "cd56e9d2-4044-40fb-a49a-7b7591301821",
    companyName: "The Water Heater Dude/The Air Dude",
    tier: "3",
    reason: "A 404-review multi-crew company with accelerating demand still has zero dedicated service pages.",
  },
  {
    leadId: "df0a9941-0144-4b0c-ba74-d02eb3736b91",
    companyName: "United Plumbing LLC",
    tier: "3",
    reason: "Recent SEO activity and steady reviews show buying intent, while thin pages and severe NAP conflicts remain unresolved.",
  },
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  const leadIds = rankings.map((ranking) => ranking.leadId);
  if (new Set(leadIds).size !== rankings.length) {
    throw new Error("The ranking list contains duplicate lead IDs");
  }

  const rows = await db.select({
    profileId: localFalconProspectProfiles.id,
    leadId: localFalconProspectProfiles.leadId,
    companyName: localFalconProspectProfiles.companyName,
    batchId: localFalconImportBatches.batchId,
    currentTier: localFalconProspectProfiles.tier,
  }).from(localFalconProspectProfiles)
    .innerJoin(
      localFalconImportBatches,
      eq(localFalconProspectProfiles.batchRecordId, localFalconImportBatches.id),
    )
    .where(and(
      inArray(localFalconProspectProfiles.leadId, leadIds),
      ne(localFalconImportBatches.batchId, EXCLUDED_BATCH_ID),
    ));

  const foundLeadIds = new Set(rows.map((row) => row.leadId));
  const missing = rankings.filter((ranking) => !foundLeadIds.has(ranking.leadId));
  if (missing.length) {
    throw new Error(`Missing CRM profiles for: ${missing.map((ranking) => ranking.companyName).join(", ")}`);
  }

  for (const row of rows) {
    const ranking = rankings.find((candidate) => candidate.leadId === row.leadId)!;
    if (row.companyName !== ranking.companyName) {
      throw new Error(
        `Company mismatch for ${ranking.leadId}: expected "${ranking.companyName}", found "${row.companyName}"`,
      );
    }
  }

  const preview = rankings.map((ranking) => {
    const profiles = rows.filter((row) => row.leadId === ranking.leadId);
    return {
      company: ranking.companyName,
      tier: ranking.tier,
      profiles: profiles.length,
      reason: ranking.reason,
    };
  });
  console.table(preview);

  if (!apply) {
    console.log(`Dry run complete: ${rankings.length} leads across ${rows.length} profile rows.`);
    return;
  }

  await db.transaction(async (tx) => {
    for (const ranking of rankings) {
      await tx.update(localFalconProspectProfiles).set({
        tier: ranking.tier,
        pitchType: "website",
        pitchSummary: ranking.reason,
      }).where(and(
        eq(localFalconProspectProfiles.leadId, ranking.leadId),
        inArray(
          localFalconProspectProfiles.id,
          rows
            .filter((row) => row.leadId === ranking.leadId)
            .map((row) => row.profileId),
        ),
      ));
    }
  });

  const verified = await db.select({
    leadId: localFalconProspectProfiles.leadId,
    tier: localFalconProspectProfiles.tier,
    reason: localFalconProspectProfiles.pitchSummary,
  }).from(localFalconProspectProfiles)
    .where(inArray(localFalconProspectProfiles.leadId, leadIds));

  const failures = verified.filter((row) => {
    const ranking = rankings.find((candidate) => candidate.leadId === row.leadId);
    return !ranking || row.tier !== ranking.tier || row.reason !== ranking.reason;
  });
  if (failures.length) {
    throw new Error(`Post-update verification failed for ${failures.length} profile rows`);
  }

  console.log(`Applied rankings to ${rankings.length} leads across ${verified.length} profile rows.`);
  console.log(`Tier distribution: 3=${rankings.filter((row) => row.tier === "3").length}, 2=${rankings.filter((row) => row.tier === "2").length}, 1=${rankings.filter((row) => row.tier === "1").length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
