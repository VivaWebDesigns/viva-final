import { db } from "../../db";
import {
  marketplacePendingOutreach,
  MARKETPLACE_PENDING_OUTREACH_NON_TERMINAL_STATUSES,
  type MarketplacePendingOutreach,
} from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";

type InsertMarketplacePendingOutreachFull = typeof marketplacePendingOutreach.$inferInsert;

export async function createPendingOutreach(
  data: InsertMarketplacePendingOutreachFull
): Promise<MarketplacePendingOutreach> {
  const [result] = await db
    .insert(marketplacePendingOutreach)
    .values(data)
    .returning();
  return result;
}

export async function getPendingOutreachById(
  id: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .select()
    .from(marketplacePendingOutreach)
    .where(eq(marketplacePendingOutreach.id, id));
  return result;
}

export async function updatePendingOutreach(
  id: string,
  data: Partial<Pick<
    MarketplacePendingOutreach,
    | "messageStatus"
    | "outreachMessage"
    | "outreachSentAt"
    | "replyReceivedAt"
    | "extractedPhone"
    | "threadIdentifier"
    | "crmLeadId"
    | "convertedAt"
  >>
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export async function markPendingOutreachMessageSent(
  id: string,
  updates: {
    outreachSentAt: Date;
    outreachMessage?: string | null;
  }
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({
      messageStatus:  "awaiting_reply",
      outreachSentAt: updates.outreachSentAt,
      ...(updates.outreachMessage !== undefined && { outreachMessage: updates.outreachMessage }),
      updatedAt: new Date(),
    })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export async function findActivePendingOutreachBySellerUrl(
  normalizedSellerProfileUrl: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .select()
    .from(marketplacePendingOutreach)
    .where(
      and(
        eq(marketplacePendingOutreach.sellerProfileUrl, normalizedSellerProfileUrl),
        inArray(
          marketplacePendingOutreach.messageStatus,
          [...MARKETPLACE_PENDING_OUTREACH_NON_TERMINAL_STATUSES]
        )
      )
    )
    .limit(1);
  return result;
}
