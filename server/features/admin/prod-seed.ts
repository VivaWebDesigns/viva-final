/**
 * Production Admin Seeding
 *
 * Runs on server startup in ALL environments (including production).
 * Creates the initial admin user from env vars if one does not already exist.
 * Fully idempotent — safe to run on every restart.
 *
 * Required env vars:
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_PASSWORD
 */

import { db } from "../../db";
import { user } from "@shared/schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth/auth";

export async function seedAdminUser(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("[prod-seed] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping.");
    return;
  }

  try {
    const [existing] = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existing) {
      if (existing.role !== "admin") {
        await db.update(user).set({ role: "admin" }).where(eq(user.id, existing.id));
        console.log(`[prod-seed] Promoted ${email} → admin`);
      } else {
        console.log(`[prod-seed] Admin user already exists (${email})`);
      }
      return;
    }

    const result = await auth.api.signUpEmail({
      body: { name: "Admin", email, password },
    });

    if (result?.user?.id) {
      await db.update(user).set({ role: "admin" }).where(eq(user.id, result.user.id));
      console.log(`[prod-seed] Created admin user: ${email}`);
    }
  } catch (err: any) {
    console.error(`[prod-seed] Failed to seed admin user (${email}):`, err.message);
  }
}
