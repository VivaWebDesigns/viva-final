import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { getPhoneNumbers, sendSMS } from "./client";
import { z } from "zod";
import { normalizePhoneDigits, toE164Phone } from "@shared/phone";

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

router.post(
  "/sms",
  requireRole("admin", "developer", "sales_rep"),
  async (req, res) => {
    const parsed = sendSMSSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const { to: rawTo, content, phoneNumberId: providedId } = parsed.data;

    const to = toE164(rawTo);
    if (!to) {
      return res.status(400).json({ message: "Invalid phone number — must be a 10-digit US number or E.164 format" });
    }

    try {
      let fromId = providedId;
      if (!fromId) {
        const numbers = await getPhoneNumbers();
        if (!numbers.length) {
          return res.status(502).json({ message: "No QUO phone numbers found on this account" });
        }
        fromId = numbers[0].id;
      }

      const result = await sendSMS({ to, content, phoneNumberId: fromId });
      return res.status(202).json(result);
    } catch (err: any) {
      console.error("[QUO] send-sms error:", err.message);
      return res.status(502).json({ message: err.message });
    }
  }
);

export default router;
