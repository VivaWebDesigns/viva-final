import { Router, type Request } from "express";
import { handleInboundSms, handleSmsStatus } from "./scanText";
import { PUBLIC_SITE_URL, isValidTwilioSignature } from "./twilio";

// Public: Twilio calls these. Authenticated by X-Twilio-Signature over the exact public URL.
const router = Router();

function verified(req: Request) {
  const params = Object.fromEntries(Object.entries(req.body ?? {}).map(([key, value]) => [key, String(value)]));
  const ok = isValidTwilioSignature(req.get("x-twilio-signature"), `${PUBLIC_SITE_URL}${req.originalUrl}`, params);
  return ok ? params : null;
}

router.post("/sms/inbound", async (req, res) => {
  const params = verified(req);
  if (!params) return res.status(403).send("Invalid signature");
  try {
    await handleInboundSms(params);
    // Empty TwiML: no automatic reply. Twilio handles STOP/HELP itself.
    res.type("text/xml").send("<Response></Response>");
  } catch (error) {
    console.error("[twilio] inbound failed", error);
    res.status(500).send("Inbound processing failed");
  }
});

router.post("/sms/status", async (req, res) => {
  const params = verified(req);
  if (!params) return res.status(403).send("Invalid signature");
  try {
    await handleSmsStatus(params);
    res.sendStatus(204);
  } catch (error) {
    console.error("[twilio] status callback failed", error);
    res.status(500).send("Status processing failed");
  }
});

export default router;
