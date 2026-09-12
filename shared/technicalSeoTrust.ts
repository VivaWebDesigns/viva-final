import type { TechnicalSeoGrade, TechnicalSeoIssue, TechnicalSeoScanResult } from "./technicalSeo";

function grade(score: number): Exclude<TechnicalSeoGrade["grade"], "Not assessed"> {
  return score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
}

function trustIssue(id: string, name: string, severity: TechnicalSeoIssue["severity"], observation: string, evidence: string, interpretation: string, recommendedAction: string, affectedUrls: string[] = []): TechnicalSeoIssue {
  return { id, name, severity, category: "Trust & conversion", observation, evidence, interpretation, recommendedAction, confidence: "confirmed", evidenceStatus: "confirmed", affectedUrls, rankingImpact: interpretation, gradeKey: "trust_conversion" };
}

function manualTrustIssue(id: string, name: string, observation: string, evidence: string, interpretation: string, recommendedAction: string, affectedUrls: string[] = []): TechnicalSeoIssue {
  return { ...trustIssue(id, name, "medium", observation, evidence, interpretation, recommendedAction, affectedUrls), confidence: "limited", evidenceStatus: "manual_verification" };
}

function hasField(fields: string[], pattern: RegExp) {
  return fields.some((field) => pattern.test(field));
}

export function assessTrustConversion(result: TechnicalSeoScanResult) {
  const audit = result.siteAudit;
  if (!audit) return null;
  const successful = audit.pages.filter((page) => page.statusCode === 200);
  const evidence = successful.flatMap((page) => page.evidence ? [{ page, evidence: page.evidence }] : []);
  const signals = evidence.map((item) => item.evidence.contentSignals);
  const ctas = evidence.flatMap((item) => item.evidence.ctas.map((cta) => ({ ...cta, pageUrl: item.page.url })));
  const forms = evidence.flatMap((item) => item.evidence.forms.map((form) => ({ ...form, pageUrl: item.page.url })));
  const professionalEmail = successful.some((page) => (page.contact?.emails ?? []).some((email) => !/@(?:gmail|yahoo|hotmail|outlook|aol)\./i.test(email)));
  const hasAbout = signals.some((signal) => signal.about);
  const hasCredentials = signals.some((signal) => signal.credentials);
  const hasPolicies = signals.some((signal) => signal.policies);
  const hasReviews = signals.some((signal) => signal.reviews);
  const hasPrivacy = signals.some((signal) => signal.privacy);
  const hasLicensingInsurance = signals.some((signal) => signal.licensingInsurance);
  const renderedText = `${result.profiles.simulatedGooglebotRendered.visibleTextSample ?? ""} ${result.profiles.simulatedGooglebotRendered.metaDescription ?? ""}`;
  const hasSpecificCapacity = signals.some((signal) => signal.specificCapacity) || /\b(?:space for (?:just )?|capacity (?:of )?|limited to )\d+\s*(?:-|to)\s*\d+\s+(?:dogs?|pets?)\b/i.test(renderedText);
  const hasPricing = signals.some((signal) => signal.pricing);
  const hasSocial = successful.some((page) => (page.signals?.socialLinks ?? []).length > 0);
  const usefulForms = forms.filter((form) => form.hasContactField && !!form.submitLabel);
  const hasRequiredFields = usefulForms.some((form) => form.requiredFields > 0);
  const hasPhoneField = usefulForms.some((form) => hasField(form.fields, /phone|tel|mobile/i));
  const hasServiceContextField = usefulForms.some((form) => hasField(form.fields, /dog|pet|service|date|stay|appointment|booking/i));
  const dependableLeadPath = ctas.some((cta) => cta.usable && ["phone", "email", "form", "booking"].includes(cta.type)) || usefulForms.length > 0;
  const bookingIntent = ctas.filter((cta) => /\b(book|schedule|reserve|appointment)\b/i.test(cta.label));
  const emailBooking = bookingIntent.some((cta) => cta.type === "email");
  const strongBooking = bookingIntent.some((cta) => cta.usable && ["booking", "form"].includes(cta.type));
  const usefulPrimaryAction = strongBooking || ctas.some((cta) => cta.usable && cta.type === "phone");
  const highTrustService = /\b(dog|pet|boarding|daycare|child|medical|dental|health|home care|senior care|attorney|legal|contractor|roof|plumb|electric)\b/i.test(audit.context?.trade ?? "");

  let trustPoints = 0;
  trustPoints += hasAbout ? 10 : 0;
  trustPoints += professionalEmail ? 5 : 0;
  trustPoints += hasCredentials ? 8 : 0;
  trustPoints += hasPolicies ? 12 : 0;
  trustPoints += hasReviews ? 15 : 0;
  trustPoints += hasSocial ? 5 : 0;
  trustPoints += hasPrivacy ? 5 : 0;
  trustPoints += hasLicensingInsurance ? 3 : 0;
  trustPoints += hasSpecificCapacity ? 2 : 0;
  trustPoints = Math.min(60, trustPoints);

  let conversionPoints = 0;
  conversionPoints += dependableLeadPath ? 8 : 0;
  conversionPoints += strongBooking ? 10 : emailBooking ? 3 : usefulPrimaryAction ? 8 : 0;
  conversionPoints += usefulForms.length ? 5 : 0;
  conversionPoints += hasRequiredFields ? 2 : 0;
  conversionPoints += hasPhoneField ? 2 : 0;
  conversionPoints += hasServiceContextField ? 3 : 0;
  conversionPoints += hasPricing ? 5 : 0;
  conversionPoints += hasPolicies || signals.some((signal) => signal.faq) ? 5 : 0;
  conversionPoints = Math.min(40, conversionPoints);

  let score = trustPoints + conversionPoints;
  const caps: string[] = [];
  if (!hasReviews && !hasPolicies) { score = Math.min(score, 69); caps.push("neither onsite social proof nor customer policies were confirmed"); }
  else if (!hasReviews || !hasPolicies) { score = Math.min(score, 79); caps.push(!hasReviews ? "onsite social proof was not confirmed" : "customer policies were not confirmed"); }
  if (!dependableLeadPath) { score = Math.min(score, 69); caps.push("no dependable lead path was confirmed"); }
  if (emailBooking && !strongBooking) { score = Math.min(score, 69); caps.push("the booking-intent CTA relies on email instead of a booking or connected form journey"); }

  const issues: TechnicalSeoIssue[] = [];
  if (!hasPolicies) issues.push(trustIssue("customer-policies-not-confirmed", "Customer policies not confirmed", "high", "No clearly identifiable requirements, safety, deposit, scheduling, or cancellation policies were detected.", `${successful.length} successful pages checked.`, "Visitors receive less evidence that the business has a consistent process for protecting customers and delivering the service.", "Publish the policies and requirements customers need before committing to the service."));
  if (!hasPrivacy) issues.push(trustIssue("privacy-policy-not-confirmed", "Business privacy policy not confirmed", "medium", "No business-owned privacy-policy page or link was detected across the crawled pages.", `${successful.length} successful pages checked.`, "A site collecting inquiry or analytics data should explain how the business handles visitor information.", "Publish and link a business-specific privacy policy from the form and site footer."));
  if (highTrustService && !hasLicensingInsurance) issues.push(trustIssue("licensing-insurance-not-confirmed", "Licensing or insurance proof not confirmed", "medium", "No explicit licensed, insured, bonded, or insurance-coverage statement was detected.", `${successful.length} successful pages checked.`, "Customers evaluating a high-trust service receive less third-party or operational reassurance about accountability.", "Display applicable licensing, insurance, bonding, or equivalent accountability information; do not claim credentials the business does not hold."));
  if (emailBooking && !strongBooking) issues.push(trustIssue("booking-cta-uses-email", "Booking call to action relies on email", "high", "A booking-intent call to action opens an email application rather than a booking workflow or connected inquiry form.", bookingIntent.map((cta) => `${cta.pageUrl}: ${cta.label} → ${cta.destination ?? "no destination"}`).join("; "), "A visitor ready to book may encounter device-dependent behavior and must construct the inquiry without guided next steps.", "Send booking-intent buttons to a dedicated availability, meet-and-greet, or booking form that captures the information needed for follow-up.", [...new Set(bookingIntent.map((cta) => cta.pageUrl))]));
  if (usefulForms.length && !hasRequiredFields) issues.push(trustIssue("lead-form-no-required-fields", "Lead form has no required fields", "low", "A recognizable lead form was detected, but none of its visible fields were marked as required.", usefulForms.map((form) => `${form.pageUrl}: ${form.fields.join(", ") || "no fields"}`).join("; "), "Empty or incomplete submissions are easier to send and may not provide a dependable way to respond.", "Require the minimum fields needed to identify and answer a legitimate inquiry.", [...new Set(usefulForms.map((form) => form.pageUrl))]));
  if (usefulForms.length && (!hasPhoneField || !hasServiceContextField)) issues.push(trustIssue("lead-form-lacks-decision-context", "Lead form lacks important inquiry context", "medium", "The detected lead form does not capture both a phone number and service-specific details.", usefulForms.map((form) => `${form.pageUrl}: ${form.fields.join(", ") || "no fields"}`).join("; "), "The business must spend additional follow-up effort collecting the basic information needed to qualify and schedule the inquiry.", "Add only the fields relevant to the service, such as phone, requested service or dates, and the customer or subject details needed for the next step.", [...new Set(usefulForms.map((form) => form.pageUrl))]));
  const formsWithoutVisibleAction = usefulForms.filter((form) => !form.action);
  if (formsWithoutVisibleAction.length) issues.push(manualTrustIssue("form-submission-needs-verification", "Form submission destination needs verification", "The form has recognizable fields and a submit control, but no submission action is exposed in the inspected HTML.", formsWithoutVisibleAction.map((form) => `${form.pageUrl}: ${form.method}; fields ${form.fields.join(", ")}`).join("; "), "A JavaScript-handled form may work correctly, but the stored evidence alone cannot confirm successful delivery or the post-submit experience.", "Submit a controlled test inquiry and verify delivery, validation, confirmation messaging, and mobile behavior.", [...new Set(formsWithoutVisibleAction.map((form) => form.pageUrl))]));
  const familyHomePositioning = /\b(family|our home|home away from home)\b/i.test(renderedText) && hasSpecificCapacity;
  const institutionalClaims = renderedText.match(/\b(?:expert staff|spacious play areas?)\b/gi) ?? [];
  if (familyHomePositioning && institutionalClaims.length) issues.push(manualTrustIssue("business-claims-need-verification", "Marketing claims need consistency verification", "The page combines small family-home positioning with broader facility or staffing claims that the automated scan cannot independently verify.", `Positioning includes a specific small capacity; claims detected: ${[...new Set(institutionalClaims)].join(", ")}.`, "If the claims are not supported or explained, visitors may discount otherwise authentic owner and safety information.", "Verify each claim, replace unsupported template language, and explain accurately who provides care and what the play environment includes.", [successful[0]?.url].filter(Boolean)));

  return {
    score,
    grade: grade(score),
    trustPoints,
    conversionPoints,
    caps,
    issues,
    metrics: { hasAbout, professionalEmail, hasCredentials, hasPolicies, hasReviews, hasPrivacy, hasLicensingInsurance, hasSpecificCapacity, hasPricing, hasSocial, dependableLeadPath, strongBooking, emailBooking, usefulForm: usefulForms.length > 0, hasRequiredFields, hasPhoneField, hasServiceContextField },
  };
}
