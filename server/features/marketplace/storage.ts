import { db } from "../../db";
import {
  marketplacePendingOutreach,
  MARKETPLACE_PENDING_OUTREACH_NON_TERMINAL_STATUSES,
  type MarketplacePendingOutreach,
} from "@shared/schema";
import { and, eq, inArray, isNotNull, isNull, or, ilike, desc, count } from "drizzle-orm";

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

export async function captureReplyOnPendingOutreach(
  id: string,
  data: {
    lastReplyText:        string;
    extractedPhone:       string;
    replyPhoneNormalized: string | null;
    replyMatchConfidence: string;
    replyMatchMethod:     string;
    replyReceivedAt:      Date;
    manualReviewReason?:  string | null;
    messageStatus:        string;
    threadIdentifier?:    string | null;
  }
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({
      lastReplyText:        data.lastReplyText,
      extractedPhone:       data.extractedPhone,
      replyPhoneNormalized: data.replyPhoneNormalized,
      replyMatchConfidence: data.replyMatchConfidence,
      replyMatchMethod:     data.replyMatchMethod,
      replyReceivedAt:      data.replyReceivedAt,
      messageStatus:        data.messageStatus,
      ...(data.manualReviewReason !== undefined && { manualReviewReason: data.manualReviewReason }),
      ...(data.threadIdentifier   !== undefined && { threadIdentifier:   data.threadIdentifier }),
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

/**
 * Returns the most recent pending outreach record for the given seller URL,
 * across ALL statuses (including terminal: converted, skipped).
 * Used by the extension lookup route so the popup can resume from the correct stage.
 */
export async function findLatestPendingOutreachBySellerUrl(
  normalizedSellerProfileUrl: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .select()
    .from(marketplacePendingOutreach)
    .where(eq(marketplacePendingOutreach.sellerProfileUrl, normalizedSellerProfileUrl))
    .orderBy(desc(marketplacePendingOutreach.createdAt))
    .limit(1);
  return result;
}

export interface ListPendingOutreachFilters {
  page:       number;
  limit:      number;
  status?:    string;
  search?:    string;
  hasPhone?:  boolean;
  hasCrmLead?: boolean;
}

export interface ListPendingOutreachResult {
  items: MarketplacePendingOutreach[];
  total: number;
  page:  number;
  limit: number;
}

export async function listPendingOutreach(
  filters: ListPendingOutreachFilters
): Promise<ListPendingOutreachResult> {
  const { page, limit, status, search, hasPhone, hasCrmLead } = filters;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (status) {
    conditions.push(eq(marketplacePendingOutreach.messageStatus, status));
  }

  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(
        ilike(marketplacePendingOutreach.sellerFullName,       term),
        ilike(marketplacePendingOutreach.listingTitleRaw,      term),
        ilike(marketplacePendingOutreach.replyPhoneNormalized, term),
        ilike(marketplacePendingOutreach.extractedPhone,       term)
      )
    );
  }

  if (hasPhone === true) {
    conditions.push(
      or(
        isNotNull(marketplacePendingOutreach.replyPhoneNormalized),
        isNotNull(marketplacePendingOutreach.extractedPhone)
      )
    );
  } else if (hasPhone === false) {
    conditions.push(
      and(
        isNull(marketplacePendingOutreach.replyPhoneNormalized),
        isNull(marketplacePendingOutreach.extractedPhone)
      )
    );
  }

  if (hasCrmLead === true) {
    conditions.push(isNotNull(marketplacePendingOutreach.crmLeadId));
  } else if (hasCrmLead === false) {
    conditions.push(isNull(marketplacePendingOutreach.crmLeadId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ count: count() })
    .from(marketplacePendingOutreach)
    .where(where);

  const items = await db
    .select()
    .from(marketplacePendingOutreach)
    .where(where)
    .orderBy(desc(marketplacePendingOutreach.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: Number(totalRow?.count ?? 0),
    page,
    limit,
  };
}

export async function approveManualReview(
  id: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({
      messageStatus:      "reply_received",
      manualReviewReason: null,
      updatedAt:          new Date(),
    })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export async function rejectManualReview(
  id: string
): Promise<MarketplacePendingOutreach | undefined> {
  const [result] = await db
    .update(marketplacePendingOutreach)
    .set({
      messageStatus:      "skipped",
      manualReviewReason: "Manual review rejected by admin",
      updatedAt:          new Date(),
    })
    .where(eq(marketplacePendingOutreach.id, id))
    .returning();
  return result;
}

export async function getManyPendingOutreachByIds(
  ids: string[]
): Promise<MarketplacePendingOutreach[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(marketplacePendingOutreach)
    .where(inArray(marketplacePendingOutreach.id, ids));
}

export async function bulkSkipPendingOutreach(
  ids: string[]
): Promise<{ updatedIds: string[]; count: number; newStatus: string }> {
  const results = await db
    .update(marketplacePendingOutreach)
    .set({ messageStatus: "skipped", updatedAt: new Date() })
    .where(inArray(marketplacePendingOutreach.id, ids))
    .returning({ id: marketplacePendingOutreach.id });
  const updatedIds = results.map(r => r.id);
  return { updatedIds, count: updatedIds.length, newStatus: "skipped" };
}

export async function bulkApprovePendingOutreach(
  ids: string[]
): Promise<{ updatedIds: string[]; count: number; newStatus: string }> {
  const results = await db
    .update(marketplacePendingOutreach)
    .set({ messageStatus: "reply_received", manualReviewReason: null, updatedAt: new Date() })
    .where(inArray(marketplacePendingOutreach.id, ids))
    .returning({ id: marketplacePendingOutreach.id });
  const updatedIds = results.map(r => r.id);
  return { updatedIds, count: updatedIds.length, newStatus: "reply_received" };
}

export async function getPendingOutreachSummary(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      status: marketplacePendingOutreach.messageStatus,
      count:  count(),
    })
    .from(marketplacePendingOutreach)
    .groupBy(marketplacePendingOutreach.messageStatus);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.status] = Number(row.count);
  }
  return result;
}
