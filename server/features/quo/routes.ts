import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { getPhoneNumbers, sendSMS, getMessages } from "./client";
import { z } from "zod";
import { normalizePhoneDigits, toE164Phone } from "@shared/phone";
import * as crmStorage from "../crm/storage";
import { db } from "../../db";
import { crmLeads, crmContacts } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

function toE164(raw: string): string | null {
  const digits = normalizePhoneDigits(raw);
  if (digits.length === 10) return toE164Phone(digits);
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return raw;
  return null;
}

const sendSMSSchema = z.object({
  to: z.string().min(7, "Phone number is required"),
  content: z.string().min(1, "Message cannot be empty").max(1600, "Message is too long"),
  phoneNumberId: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
});

router.get(
  "/phone-numbers",
  requireRole("admin", "developer"),
  async (_req, res) => {
    try {
      const numbers = await getPhoneNumbers();
      return res.json({ data: numbers });
    } catch (err: any) {
      console.error("[QUO] phone-numbers error:", err.message);
      return res.status(502).json({ message: err.message });
    }
  }
);

router.get(
  "/conversations/:leadId",
  requireRole("admin", "developer", "sales_rep"),
  async (req, res) => {
    const leadId = req.params.leadId as string;

    try {
      const [lead] = await db
        .select({
          id: crmLeads.id,
          contactId: crmLeads.contactId,
          contactPhone: crmContacts.phone,
        })
        .from(crmLeads)
        .leftJoin(crmContacts, eq(crmLeads.contactId, crmContacts.id))
        .where(eq(crmLeads.id, leadId))
        .limit(1);

      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      const rawPhone = lead.contactPhone;

      if (rawPhone) {
        const participantE164 = toE164(rawPhone);
        if (participantE164) {
          try {
            const numbers = await getPhoneNumbers();
            if (numbers.length > 0) {
              const fetchPromises = numbers.map((num) =>
                getMessages({
                  phoneNumberId: num.id,
                  participants: [participantE164],
                  maxResults: 100,
                }).catch((err) => {
                  console.error(`[QUO] getMessages failed for phoneNumberId=${num.id}:`, err.message);
                  return [];
                })
              );

              const allResults = await Promise.all(fetchPromises);
              const quoMessages = allResults.flat();

              for (const msg of quoMessages) {
                const fromE164 = toE164(msg.from) ?? msg.from;
                const toE164Val = (msg.to?.[0] ? toE164(msg.to[0]) : null) ?? (msg.to?.[0] ?? "");
                await crmStorage.upsertSmsMessage({
                  leadId,
                  direction: msg.direction,
                  fromNumber: fromE164,
                  toNumber: toE164Val,
                  content: msg.content,
                  senderName: null,
                  openPhoneMessageId: msg.id,
                  sentAt: new Date(msg.createdAt),
                });
              }
            }
          } catch (syncErr: any) {
            console.error("[QUO] conversations sync error:", syncErr.message);
          }
        }
      }

      const messages = await crmStorage.getSmsMessages(leadId);
      return res.json({ data: messages });
    } catch (err: any) {
      console.error("[QUO] conversations error:", err.message);
      return res.status(502).json({ message: err.message });
    }
  }
);

router.post(
  "/sms",
  requireRole("admin", "developer", "sales_rep"),
  async (req, res) => {
    const parsed = sendSMSSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const { to: rawTo, content, phoneNumberId: providedId, leadId, contactId } = parsed.data;

    const to = toE164(rawTo);
    if (!to) {
      return res.status(400).json({ message: "Invalid phone number — must be a 10-digit US number or E.164 format" });
    }

    try {
      let fromId = providedId;
      let fromNumber: string | null = null;
      if (!fromId) {
        const numbers = await getPhoneNumbers();
        if (!numbers.length) {
          return res.status(502).json({ message: "No QUO phone numbers found on this account" });
        }
        fromId = numbers[0].id;
        fromNumber = numbers[0].formattedNumber;
      } else {
        const numbers = await getPhoneNumbers();
        const match = numbers.find((n) => n.id === fromId);
        fromNumber = match?.formattedNumber ?? null;
      }

      const result = await sendSMS({ to, content, phoneNumberId: fromId });

      const senderName = req.authUser?.name ?? null;

      if (leadId) {
        try {
          await crmStorage.addLeadNote({
            leadId,
            userId: req.authUser!.id,
            type: "sms",
            content,
            metadata: { to: rawTo, contactId: contactId ?? null, via: "quo" },
          });
        } catch (noteErr: any) {
          console.error("[QUO] failed to log SMS activity note:", noteErr.message);
        }

        try {
          const openPhoneMessageId = result?.data?.id ?? result?.id ?? null;
          await crmStorage.createSmsMessage({
            leadId,
            direction: "outbound",
            fromNumber: fromNumber ?? fromId,
            toNumber: to,
            content,
            senderName,
            openPhoneMessageId: typeof openPhoneMessageId === "string" ? openPhoneMessageId : null,
            sentAt: new Date(),
          });
        } catch (smsErr: any) {
          console.error("[QUO] failed to persist outbound SMS message:", smsErr.message);
        }
      }

      return res.status(202).json(result);
    } catch (err: any) {
      console.error("[QUO] send-sms error:", err.message);
      return res.status(502).json({ message: err.message });
    }
  }
);

export default router;
