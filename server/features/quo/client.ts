const QUO_BASE = "https://api.openphone.com/v1";

function quoHeaders() {
  const key = process.env.QUO_API_KEY;
  if (!key) throw new Error("QUO_API_KEY is not configured");
  return {
    Authorization: key,
    "Content-Type": "application/json",
  };
}

export interface QuoPhoneNumber {
  id: string;
  formattedNumber: string;
  name: string | null;
  users: Array<{ id: string; email: string; firstName: string; lastName: string }>;
}

let cachedPhoneNumbers: QuoPhoneNumber[] | null = null;
let cacheExpiresAt = 0;

export async function getPhoneNumbers(): Promise<QuoPhoneNumber[]> {
  if (cachedPhoneNumbers && Date.now() < cacheExpiresAt) {
    return cachedPhoneNumbers;
  }
  const res = await fetch(`${QUO_BASE}/phone-numbers`, { headers: quoHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`QUO phone-numbers failed (${res.status}): ${body}`);
  }
  const json = await res.json() as { data: QuoPhoneNumber[] };
  cachedPhoneNumbers = json.data ?? [];
  cacheExpiresAt = Date.now() + 60 * 60 * 1000;
  return cachedPhoneNumbers;
}

export interface SendSMSOptions {
  to: string;
  content: string;
  phoneNumberId: string;
}

export async function sendSMS(opts: SendSMSOptions) {
  const payload = {
    content: opts.content,
    from: opts.phoneNumberId,
    to: [opts.to],
  };
  console.log("[QUO] sendSMS →", JSON.stringify({ to: opts.to, from: opts.phoneNumberId }));
  const res = await fetch(`${QUO_BASE}/messages`, {
    method: "POST",
    headers: quoHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  console.log("[QUO] sendSMS ←", res.status, body.substring(0, 500));
  if (!res.ok) {
    throw new Error(`QUO send SMS failed (${res.status}): ${body}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}
