import { db } from "../../db";
import { sql } from "drizzle-orm";

const TAG = "[backfill:seller-url-product-id]";

/**
 * One-time idempotent backfill: strips the ?product_id= query parameter (and any
 * remaining trailing slash) from seller_profile_url values in marketplace_pending_outreach.
 *
 * Root cause: Facebook Marketplace listing pages append the listing-specific ?product_id=
 * to the seller's profile URL. The extension captures and stores this URL as-is. Each ad
 * by the same seller has a different product_id, so all eq()-based duplicate guards see
 * them as different sellers and silently pass.
 *
 * Records with profile.php?id= URLs are NOT affected (they do not contain ?product_id=).
 * Safe to run on every startup — only rows containing '?product_id=' are modified.
 */
export async function backfillSellerUrlProductId(): Promise<void> {
  const result = await db.execute(
    sql`UPDATE marketplace_pending_outreach
        SET seller_profile_url =
          regexp_replace(split_part(seller_profile_url, '?product_id=', 1), '/+$', '')
        WHERE seller_profile_url LIKE '%?product_id=%'`
  );
  const rowCount = (result as { rowCount?: number }).rowCount ?? 0;
  if (rowCount > 0) {
    console.log(`${TAG} stripped ?product_id= from ${rowCount} record(s)`);
  } else {
    console.log(`${TAG} no records needed backfill`);
  }
}
