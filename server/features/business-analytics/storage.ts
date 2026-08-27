import { and, desc, eq, gt } from "drizzle-orm";
import {
  googleBusinessReviews,
  googleIntegrationConnections,
  googleOAuthStates,
} from "@shared/schema";
import { db } from "../../db";
import type { GoogleProvider } from "./googleAuth";

export async function createGoogleOAuthState(input: {
  stateHash: string;
  provider: GoogleProvider;
  userId: string;
  expiresAt: Date;
}) {
  await db.insert(googleOAuthStates).values(input);
}

export async function consumeGoogleOAuthState(stateHash: string) {
  return db.transaction(async (tx) => {
    const [state] = await tx.select().from(googleOAuthStates).where(and(
      eq(googleOAuthStates.stateHash, stateHash),
      gt(googleOAuthStates.expiresAt, new Date()),
    )).limit(1);
    if (!state) return null;
    await tx.delete(googleOAuthStates).where(eq(googleOAuthStates.stateHash, stateHash));
    return state;
  });
}

export async function getGoogleConnection(provider: GoogleProvider) {
  const [connection] = await db.select().from(googleIntegrationConnections)
    .where(eq(googleIntegrationConnections.provider, provider))
    .limit(1);
  return connection ?? null;
}

export async function listGoogleConnections() {
  return db.select().from(googleIntegrationConnections)
    .orderBy(googleIntegrationConnections.provider);
}

export async function upsertGoogleConnection(input: {
  provider: GoogleProvider;
  encryptedRefreshToken: string;
  scopes: string;
  accountEmail?: string | null;
  propertyId?: string | null;
}) {
  const [connection] = await db.insert(googleIntegrationConnections).values({
    ...input,
    status: "connected",
    lastError: null,
  }).onConflictDoUpdate({
    target: googleIntegrationConnections.provider,
    set: {
      encryptedRefreshToken: input.encryptedRefreshToken,
      scopes: input.scopes,
      accountEmail: input.accountEmail ?? null,
      propertyId: input.propertyId ?? null,
      status: "connected",
      lastError: null,
      updatedAt: new Date(),
    },
  }).returning();
  return connection;
}

export async function updateGoogleConnection(
  provider: GoogleProvider,
  values: Partial<{
    externalAccountId: string | null;
    propertyId: string | null;
    locationId: string | null;
    locationTitle: string | null;
    status: string;
    lastSyncedAt: Date | null;
    lastError: string | null;
  }>,
) {
  const [connection] = await db.update(googleIntegrationConnections).set({
    ...values,
    updatedAt: new Date(),
  }).where(eq(googleIntegrationConnections.provider, provider)).returning();
  return connection ?? null;
}

export interface SyncedGoogleReview {
  googleReviewName: string;
  locationId: string;
  reviewerName: string | null;
  starRating: number;
  comment: string | null;
  reviewCreatedAt: Date;
  reviewUpdatedAt: Date | null;
  replyComment: string | null;
  replyUpdatedAt: Date | null;
}

export async function upsertGoogleReviews(connectionId: string, reviews: SyncedGoogleReview[]) {
  if (reviews.length === 0) return;
  const syncedAt = new Date();
  await db.transaction(async (tx) => {
    for (const review of reviews) {
      await tx.insert(googleBusinessReviews).values({
        connectionId,
        ...review,
        syncedAt,
      }).onConflictDoUpdate({
        target: googleBusinessReviews.googleReviewName,
        set: {
          reviewerName: review.reviewerName,
          starRating: review.starRating,
          comment: review.comment,
          reviewCreatedAt: review.reviewCreatedAt,
          reviewUpdatedAt: review.reviewUpdatedAt,
          replyComment: review.replyComment,
          replyUpdatedAt: review.replyUpdatedAt,
          syncedAt,
        },
      });
    }
  });
}

export async function listStoredGoogleReviews(locationId: string, limit = 5_000) {
  return db.select().from(googleBusinessReviews)
    .where(eq(googleBusinessReviews.locationId, locationId))
    .orderBy(desc(googleBusinessReviews.reviewCreatedAt))
    .limit(limit);
}
