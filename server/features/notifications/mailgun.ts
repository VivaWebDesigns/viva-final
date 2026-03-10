interface MailgunConfig {
  apiKey: string;
  domain: string;
  fromEmail: string;
  fromName: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
}

function getConfig(): MailgunConfig | null {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) return null;
  return {
    apiKey,
    domain,
    fromEmail: process.env.MAILGUN_FROM_EMAIL || `noreply@${domain}`,
    fromName: process.env.MAILGUN_FROM_NAME || "Viva Web Designs",
  };
}

export function isConfigured(): boolean {
  return getConfig() !== null;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options?: { replyTo?: string; tags?: string[] }
): Promise<SendResult> {
  const config = getConfig();
  if (!config) {
    console.log("[Mailgun] Not configured — skipping email send");
    return { success: true, status: "skipped" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("from", `${config.fromName} <${config.fromEmail}>`);
    formData.append("to", to);
    formData.append("subject", subject);
    formData.append("html", html);

    if (options?.replyTo) {
      formData.append("h:Reply-To", options.replyTo);
    }
    if (options?.tags) {
      options.tags.forEach((tag) => formData.append("o:tag", tag));
    }

    const response = await fetch(
      `https://api.mailgun.net/v3/${config.domain}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Mailgun] Send failed (${response.status}):`, errorBody);
      return {
        success: false,
        status: "failed",
        error: `HTTP ${response.status}: ${errorBody}`,
      };
    }

    const result = await response.json() as { id?: string };
    console.log(`[Mailgun] Email sent — ID: ${result.id}`);
    return {
      success: true,
      status: "sent",
      messageId: result.id,
    };
  } catch (error: any) {
    console.error("[Mailgun] Send error:", error.message);
    return {
      success: false,
      status: "failed",
      error: error.message,
    };
  }
}
