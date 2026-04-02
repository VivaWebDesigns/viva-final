import { db } from "../../db";
import {
  marketplacePendingOutreach,
  MARKETPLACE_PENDING_OUTREACH_NON_TERMINAL_STATUSES,
  type InsertMarketplacePendingOutreach,
  type MarketplacePendingOutreach,
} from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function createPendingOutreach(
  data: Omit<InsertMarketplacePendingOutreach, "sellerFirstName" | "listingTitleNormalized"> & {
    sellerFirstName?: string | null;
    listingTitleNormalized?: string | null;
  }
): Promise<MarketplacePendingOutreach> {
  const [result] = await db
    .insert(marketplacePendingOutreach)
    .values(data as any)
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
