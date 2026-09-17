import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { backlinkSnapshots } from "@shared/schema";
import { backlinkHistoryInput } from "./schema";
import type { BacklinkStore } from "./service";
import type { BacklinkReport } from "./report";

export const backlinkStore: BacklinkStore = {
  async claim(plan, actor) {
    const { requests: _requests, ...request } = plan;
    const [created] = await db.insert(backlinkSnapshots).values({
      cacheKey: plan.cache_key, fingerprint: plan.fingerprint, domain: plan.domain,
      kind: plan.kind, requestedBy: actor, request,
    }).onConflictDoNothing({ target: backlinkSnapshots.cacheKey }).returning();
    if (created) return { created: true, snapshot: created };
    const [existing] = await db.select().from(backlinkSnapshots).where(eq(backlinkSnapshots.cacheKey, plan.cache_key));
    if (!existing) throw new Error("Snapshot claim could not be read; no provider requests submitted.");
    return { created: false, snapshot: existing };
  },
  async saveSection(id, key, section) {
    await db.update(backlinkSnapshots).set({ sections: sql`jsonb_set(${backlinkSnapshots.sections}, ARRAY[${key}]::text[], ${JSON.stringify(section)}::jsonb, true)` })
      .where(and(eq(backlinkSnapshots.id, id), eq(backlinkSnapshots.status, "running")));
  },
  async finish(id, report) {
    const [saved] = await db.update(backlinkSnapshots).set({ status: report.status, report, completedAt: new Date() })
      .where(and(eq(backlinkSnapshots.id, id), eq(backlinkSnapshots.status, "running"))).returning();
    if (!saved) throw new Error("Snapshot completion could not be saved; retrieve history before retrying.");
    return saved;
  },
};

export async function getBacklinkHistory(input: z.infer<typeof backlinkHistoryInput>) {
  const filters = [eq(backlinkSnapshots.domain, input.domain)];
  if (input.kind) filters.push(eq(backlinkSnapshots.kind, input.kind));
  if (input.snapshot_id) filters.push(eq(backlinkSnapshots.id, input.snapshot_id));
  if (input.snapshot_id) {
    const [snapshot] = await db.select().from(backlinkSnapshots).where(and(...filters)).limit(1);
    if (!snapshot) throw new Error("No saved snapshot with that ID exists for this domain.");
    return { snapshot_id: snapshot.id, domain: snapshot.domain, kind: snapshot.kind, status: snapshot.status,
      created_at: snapshot.createdAt, completed_at: snapshot.completedAt, report: snapshot.report,
      ...(snapshot.status === "running" ? { partial_receipts: snapshot.sections } : {}), charged_this_call_usd: 0 };
  }
  const snapshots = await db.select({ id: backlinkSnapshots.id, domain: backlinkSnapshots.domain, kind: backlinkSnapshots.kind,
    status: backlinkSnapshots.status, createdAt: backlinkSnapshots.createdAt, completedAt: backlinkSnapshots.completedAt,
    summary: sql<BacklinkReport["summary"] | null>`${backlinkSnapshots.report}->'summary'`,
    receipt: sql<BacklinkReport["receipt"] | null>`${backlinkSnapshots.report}->'receipt'`,
    competitors: sql<string[]>`${backlinkSnapshots.request}->'competitors'`,
  }).from(backlinkSnapshots).where(and(...filters)).orderBy(desc(backlinkSnapshots.createdAt), desc(backlinkSnapshots.id))
    .limit(input.limit + 1).offset(input.offset);
  return { domain: input.domain, snapshots: snapshots.slice(0, input.limit),
    next_offset: snapshots.length > input.limit ? input.offset + input.limit : null, charged_this_call_usd: 0,
    note: "Use snapshot_id to read full saved details. Compare snapshots with the same scope; index changes are not proof of ranking impact." };
}
