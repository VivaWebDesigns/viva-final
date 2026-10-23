// Wording approved in the Twilio A2P 10DLC campaign (CMa22f2dd06b0948e5e79351de8f08e293).
// Changing the script or message means the campaign description no longer matches.

export const SCAN_TEXT_CONSENT_SCRIPT =
  "May Viva Web Designs LLC send you one text with an image of your free Google Maps ranking report? " +
  "No purchase is required, and this won't sign you up for more texts. Message and data rates may apply. " +
  "Reply STOP to opt out or HELP for help. Our terms and privacy policy are at vivawebdesigns dot com, " +
  "slash terms and slash privacy-policy. Is that okay?";

export const SCAN_TEXT_READ_BACK = "We'll send your report to that number.";

export const SCAN_TEXT_MESSAGE =
  "Viva Web Designs LLC: Here is the free Google Maps ranking report you requested during our call. " +
  "Reply STOP to opt out or HELP for help.";

// Twilio's default opt-out and opt-in keywords on the messaging service.
const OPT_OUT_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE"];
const OPT_IN_KEYWORDS = ["START", "UNSTOP", "YES"];

function keywordOf(body: string) {
  return body.trim().replace(/[.!]+$/, "").toUpperCase();
}

export function optOutKeyword(body: string): string | null {
  const keyword = keywordOf(body);
  return OPT_OUT_KEYWORDS.includes(keyword) ? keyword : null;
}

export function isOptInKeyword(body: string): boolean {
  return OPT_IN_KEYWORDS.includes(keywordOf(body));
}

// Statuses that mean the scan never reached the lead, so another send is allowed.
export const SCAN_TEXT_FAILED_STATUSES = ["failed", "undelivered"];
