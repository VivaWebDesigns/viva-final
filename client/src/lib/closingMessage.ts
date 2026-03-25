const CLOSING_SMS_EN = (name: string) =>
  `Hey ${name}, thanks again for your time. If anything changes or you decide to move forward, feel free to reach out at info@vivawebdesigns.com. We'd love the opportunity to work with you.`;

const CLOSING_SMS_ES = (name: string) =>
  `Hola ${name}, gracias nuevamente por tu tiempo. Si algo cambia o decides avanzar, no dudes en comunicarte con nosotros en info@vivawebdesigns.com. Nos encantaría tener la oportunidad de trabajar contigo`;

export function getClosingSms(name: string, language: string | null | undefined): string {
  const safeName = name || "there";
  return language === "es" ? CLOSING_SMS_ES(safeName) : CLOSING_SMS_EN(safeName);
}
