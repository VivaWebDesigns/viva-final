/**
 * Stripe Billing Routes
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY       — Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET   — Stripe webhook endpoint secret (whsec_...)
 *
 * Webhook endpoint: POST /api/billing/webhook
 */

import { Router, type Request, type Response } from "express";
import { requireRole, requireAuth } from "../auth/middleware";
import { db } from "../../db";
import { stripeCustomers, stripeWebhookEvents } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try {
    const Stripe = require("stripe");
    return new Stripe(key, { apiVersion: "2024-11-20.acacia" });
  } catch {
    return null;
  }
}

function isStripeConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}


// ── Status endpoint ───────────────────────────────────────────────────

router.get("/status", requireRole("admin", "developer"), (_req, res) => {
  res.json({
    configured: isStripeConfigured(),
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test",
  });
});

// ── Webhook (raw body required for signature verification) ────────────

router.post("/webhook", async (req: Request, res: Response) => {
  let event: any = req.body;
  if (!event || !event.type) {
    return res.status(400).json({ message: "Invalid event body" });
  }

  const stripeEventId = event.id ?? `evt_${Date.now()}`;
  const type = event.type ?? "unknown";

  const [existing] = await db
    .select()
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));

  if (existing) {
    return res.json({ received: true, duplicate: true });
  }

  const [logged] = await db.insert(stripeWebhookEvents).values({
    stripeEventId,
    type,
    processed: false,
    rawPayload: JSON.stringify(event),
  }).returning();

  await processWebhookEvent(logged.id, type, event);
  res.json({ received: true });
});

async function processWebhookEvent(id: string, type: string, event: any) {
  try {
    switch (type) {
      case "customer.created":
      case "customer.updated": {
        const cust = event.data?.object;
        if (cust?.id) {
          const existing = await db.select().from(stripeCustomers).where(eq(stripeCustomers.stripeCustomerId, cust.id));
          if (!existing.length) {
            await db.insert(stripeCustomers).values({
              entityType: "contact",
              entityId: cust.metadata?.entityId ?? cust.id,
              stripeCustomerId: cust.id,
              email: cust.email ?? null,
            });
          }
        }
        break;
      }
      default:
        break;
    }
    await db.update(stripeWebhookEvents).set({ processed: true, processedAt: new Date() })
      .where(eq(stripeWebhookEvents.id, id));
  } catch (err) {
    console.error("[billing] webhook processing error:", err);
  }
}

// ── Recent webhook events ─────────────────────────────────────────────

router.get("/events", requireRole("admin", "developer"), async (_req, res) => {
  try {
    const events = await db
      .select()
      .from(stripeWebhookEvents)
      .orderBy(desc(stripeWebhookEvents.createdAt))
      .limit(50);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── Customers ─────────────────────────────────────────────────────────

router.get("/customers", requireRole("admin", "developer"), async (_req, res) => {
  try {
    const customers = await db
      .select()
      .from(stripeCustomers)
      .orderBy(desc(stripeCustomers.createdAt))
      .limit(100);
    res.json(customers);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/customers", requireRole("admin", "developer"), async (req, res) => {
  try {
    const { entityType, entityId, email, name } = z.object({
      entityType: z.string().default("company"),
      entityId: z.string(),
      email: z.string().email().optional(),
      name: z.string().optional(),
    }).parse(req.body);

    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ message: "Stripe not configured. Set STRIPE_SECRET_KEY to enable." });
    }

    const existing = await db.select().from(stripeCustomers)
      .where(and(eq(stripeCustomers.entityType, entityType), eq(stripeCustomers.entityId, entityId)));
    if (existing.length) {
      return res.json(existing[0]);
    }

    const stripeCustomer = await stripe.customers.create({
      email,
      name,
      metadata: { entityType, entityId },
    });

    const [saved] = await db.insert(stripeCustomers).values({
      entityType,
      entityId,
      stripeCustomerId: stripeCustomer.id,
      email: email ?? null,
    }).returning();

    res.status(201).json(saved);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
