import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema } from "@shared/schema";
import { ZodError } from "zod";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/contacts", async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(data);

      await resend.emails.send({
        from: "Viva Web Designs <info@vivawebdesigns.com>",
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
      });

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

  return httpServer;
}
