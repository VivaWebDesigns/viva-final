/**
 * Stripe Billing Routes
 *
 * Config precedence:
 *   1. DB-stored config (Integrations page → Stripe Configure)
 *   2. Environment variables: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 *
 * Webhook endpoint: POST /api/billing/webhook
 */

import { Router, type Request, type Response } from "express";
import { requireRole } from "../auth/middleware";
import { db } from "../../db";
import { stripeCustomers, stripeWebhookEvents } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { getLiveStripeConfig, getMaskedStripeStatus } from "../integrations/stripe-config";

const router = Router();

async function getStripe() {
  const config = await getLiveStripeConfig();
  if (!config.secretKey) return null;
  try {
    const Stripe = require("stripe");
    return new Stripe(config.secretKey, { apiVersion: "2024-11-20.acacia" });
  } catch {
    return null;
  }
}

// ── Status endpoint ───────────────────────────────────────────────────

router.get("/status", requireRole("admin", "developer"), async (_req, res) => {
  try {
    const status = await getMaskedStripeStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── Webhook (parsed body — signature verification ready) ──────────────

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

    const stripe = await getStripe();
    if (!stripe) {
      return res.status(503).json({ message: "Stripe not configured. Add credentials via the Integrations page or set STRIPE_SECRET_KEY." });
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
