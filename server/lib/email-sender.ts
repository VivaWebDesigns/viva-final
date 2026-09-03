const MATT_CARNEY_EMAIL = "matt@vivawebdesigns.com";

export function emailSenderDisplayName(
  email: string,
  fallbackName = "Viva Web Designs",
): string {
  return email.trim().toLowerCase() === MATT_CARNEY_EMAIL
    ? "Matt Carney"
    : fallbackName;
}

export function formatEmailSender(
  email: string,
  fallbackName = "Viva Web Designs",
): string {
  return `${emailSenderDisplayName(email, fallbackName)} <${email.trim()}>`;
}
