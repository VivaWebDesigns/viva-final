import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertInquirySchema, utmAttributionSchema } from "@shared/schema";
import { ZodError } from "zod";
import featureRoutes from "./features";
import { enqueueJob } from "./features/workflow/queue";
import { initSocket } from "./features/chat/socket";
import { normalizePhoneDigits, isValidUSPhone } from "@shared/phone";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  initSocket(httpServer);

  app.use("/api", featureRoutes);

  // ── POST /api/contacts ─────────────────────────────────────────────
  // Public contact form submission.
  // Primary record is persisted synchronously; CRM ingest + email are
  // enqueued as durable async jobs so the request path is always fast
  // and the response is never blocked by external providers.
  app.post("/api/contacts", async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      if (data.phone) {
        const normalized = normalizePhoneDigits(data.phone);
        if (!isValidUSPhone(normalized)) {
          return res.status(400).json({ message: "Invalid phone number. Please enter a 10-digit US number." });
        }
        data.phone = normalized;
      }
      const attribution = utmAttributionSchema.parse(req.body);

      if (attribution.honeypot) {
        return res.status(201).json({ id: "ok" });
      }

      // 1. Primary persistence — always completes synchronously
      const contact = await storage.createContact(data);

      // 2. Enqueue durable async jobs (fire-and-forget, zero latency impact)
      await Promise.all([
        enqueueJob(
          "crm_ingest",
          {
            formData: {
              name: data.name,
              email: data.email,
              phone: data.phone,
              business: data.business ?? undefined,
              city: data.city ?? undefined,
              trade: data.trade ?? undefined,
              message: data.message ?? undefined,
            },
            attribution,
            sourceType: "contact_form",
          },
          contact.id,
          "contact_form",
        ),
        enqueueJob(
          "email_notification",
          {
            to: "info@vivawebdesigns.com",
            subject: `New Contact Form Submission — ${data.name}`,
            html: `
              <h2>New Contact Form Submission</h2>
              <table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:15px;">
                <tr><td><strong>Name</strong></td><td>${data.name}</td></tr>
                <tr><td><strong>Phone</strong></td><td>${data.phone}</td></tr>
                ${data.email ? `<tr><td><strong>Email</strong></td><td>${data.email}</td></tr>` : ""}
                ${data.city ? `<tr><td><strong>City</strong></td><td>${data.city}</td></tr>` : ""}
                ${data.trade ? `<tr><td><strong>Trade</strong></td><td>${data.trade}</td></tr>` : ""}
                ${data.message ? `<tr><td><strong>Message</strong></td><td>${data.message}</td></tr>` : ""}
              </table>
            `,
          },
          `email:${contact.id}:contact_form`,
          "contact_form",
        ),
      ]).catch((err) => {
        console.error("[routes] enqueue error (non-blocking):", err);
      });

      // 3. Immediate 201 — no external provider in the critical path
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Contact form error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // ── POST /api/inquiries ────────────────────────────────────────────
  // Public demo inquiry form submission.
  // Same pattern as /api/contacts.
  app.post("/api/inquiries", async (req, res) => {
    try {
      const data = insertInquirySchema.parse(req.body);
      if (data.phone) {
        const normalized = normalizePhoneDigits(data.phone);
        if (!isValidUSPhone(normalized)) {
          return res.status(400).json({ message: "Invalid phone number. Please enter a 10-digit US number." });
        }
        data.phone = normalized;
      }
      const attribution = utmAttributionSchema.parse(req.body);

      if (attribution.honeypot) {
        return res.status(201).json({ id: "ok" });
      }

      // 1. Primary persistence — always completes synchronously
      const contact = await storage.createContact({
        name: data.name,
        email: data.email,
        phone: data.phone,
        city: data.zipCode,
        service: data.service,
        message: data.message,
      });

      // 2. Enqueue durable async jobs
      await Promise.all([
        enqueueJob(
          "crm_ingest",
          {
            formData: {
              name: data.name,
              email: data.email,
              phone: data.phone,
              zipCode: data.zipCode,
              service: data.service,
              message: data.message,
            },
            attribution,
            sourceType: "demo_inquiry",
          },
          contact.id,
          "demo_inquiry",
        ),
        enqueueJob(
          "email_notification",
          {
            to: "info@vivawebdesigns.com",
            subject: `New Inquiry — ${data.name}`,
            html: `
              <h2>New Inquiry from Demo Site</h2>
              <table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:15px;">
                <tr><td><strong>Name</strong></td><td>${data.name}</td></tr>
                <tr><td><strong>Email</strong></td><td>${data.email}</td></tr>
                <tr><td><strong>Phone</strong></td><td>${data.phone}</td></tr>
                ${data.zipCode ? `<tr><td><strong>Zip Code</strong></td><td>${data.zipCode}</td></tr>` : ""}
                ${data.service ? `<tr><td><strong>Service</strong></td><td>${data.service}</td></tr>` : ""}
                ${data.message ? `<tr><td><strong>Message</strong></td><td>${data.message}</td></tr>` : ""}
              </table>
            `,
          },
          `email:${contact.id}:demo_inquiry`,
          "demo_inquiry",
        ),
      ]).catch((err) => {
        console.error("[routes] enqueue error (non-blocking):", err);
      });

      // 3. Immediate 201
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Inquiry form error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  return httpServer;
}
