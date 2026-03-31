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

export interface QuoMessage {
  id: string;
  object: string;
  createdAt: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  content: string;
  status: string;
  userId: string | null;
}

export interface GetMessagesOptions {
  phoneNumberId: string;
  participants?: string[];
  maxResults?: number;
}

export async function getMessages(opts: GetMessagesOptions): Promise<QuoMessage[]> {
  const params = new URLSearchParams();
  params.set("phoneNumberId", opts.phoneNumberId);
  if (opts.participants && opts.participants.length > 0) {
    opts.participants.forEach((p) => params.append("participants[]", p));
  }
  if (opts.maxResults) {
    params.set("maxResults", String(opts.maxResults));
  }
  const url = `${QUO_BASE}/messages?${params.toString()}`;
  const res = await fetch(url, { headers: quoHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`QUO getMessages failed (${res.status}): ${body}`);
  }
  const json = await res.json() as { data: QuoMessage[] };
  return json.data ?? [];
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
