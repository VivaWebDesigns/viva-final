import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrivacyPolicyModal } from "@/components/PrivacyPolicyModal";

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-2 pb-1 border-b border-gray-200">{title}</h3>
      <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function TermsContent() {
  const company = "Viva Web Designs";
  const phone = "(704) 222-7067";
  const email = "info@vivawebdesigns.com";
  const effectiveDate = "April 3, 2026";

  return (
    <div className="text-sm">
      {/* ── Spanish ── */}
      <h2 className="text-base font-bold text-gray-900 mb-1">Términos y Condiciones de SMS</h2>
      <p className="text-xs text-gray-500 mb-5">Fecha de vigencia: {effectiveDate}</p>

      <p className="text-sm text-gray-700 leading-relaxed mb-6">
        Al aceptar recibir mensajes SMS de {company}, aceptas estos Términos y Condiciones de SMS.
      </p>

      <TermsSection title="1. Descripción del programa">
        <p>{company} puede enviar mensajes SMS relacionados con tu consulta, información solicitada, citas, recordatorios, actualizaciones del proyecto y soporte al cliente.</p>
      </TermsSection>

      <TermsSection title="2. Consentimiento">
        <p>Solo recibirás mensajes SMS si das tu consentimiento a través de nuestro formulario web u otro método claro de suscripción.</p>
        <p>El consentimiento no es una condición de compra.</p>
      </TermsSection>

      <TermsSection title="3. Frecuencia de mensajes">
        <p>La frecuencia de los mensajes puede variar.</p>
      </TermsSection>

      <TermsSection title="4. Tarifas de mensajes y datos">
        <p>Pueden aplicarse tarifas de mensajes y datos.</p>
      </TermsSection>

      <TermsSection title="5. Cancelación">
        <p>Puedes dejar de recibir mensajes en cualquier momento respondiendo <strong>STOP</strong> a cualquier mensaje.</p>
        <p>Después de responder STOP, es posible que recibas un mensaje final de confirmación y luego no recibirás más mensajes SMS, a menos que vuelvas a suscribirte.</p>
      </TermsSection>

      <TermsSection title="6. Ayuda">
        <p>Responde <strong>HELP</strong> para obtener ayuda.</p>
        <p>También puedes contactarnos en:</p>
        <div className="ml-2 space-y-0.5 mt-1">
          <p><strong>{company}</strong></p>
          <p>{phone}</p>
          <p>{email}</p>
        </div>
      </TermsSection>

      <TermsSection title="7. Privacidad">
        <p>
          Tu información será tratada de acuerdo con nuestra{" "}
          <PrivacyPolicyModal
            trigger={
              <span className="text-[#0D9488] hover:text-[#0F766E] underline underline-offset-2 transition-colors font-medium cursor-pointer">
                Política de Privacidad
              </span>
            }
          />
          .
        </p>
      </TermsSection>

      <TermsSection title="8. Cambios">
        <p>Podemos actualizar estos Términos y Condiciones de SMS en cualquier momento. Los cambios se publicarán en esta página con una nueva fecha de vigencia.</p>
      </TermsSection>

      <TermsSection title="9. Contacto">
        <p>Si tienes preguntas sobre estos Términos y Condiciones de SMS, contáctanos:</p>
        <div className="ml-2 space-y-0.5 mt-1">
          <p><strong>{company}</strong></p>
          <p>{phone}</p>
          <p>{email}</p>
        </div>
      </TermsSection>

      {/* ── Divider ── */}
      <div className="border-t-2 border-gray-200 my-8" />

      {/* ── English ── */}
      <h2 className="text-base font-bold text-gray-900 mb-1">SMS Terms &amp; Conditions</h2>
      <p className="text-xs text-gray-500 mb-5">Effective Date: {effectiveDate}</p>

      <p className="text-sm text-gray-700 leading-relaxed mb-6">
        By opting in to receive SMS messages from {company}, you agree to these SMS Terms &amp; Conditions.
      </p>

      <TermsSection title="1. Program Description">
        <p>{company} may send SMS messages related to your inquiry, requested information, appointments, reminders, project updates, and customer support.</p>
      </TermsSection>

      <TermsSection title="2. Consent">
        <p>You will only receive SMS messages if you provide consent through our website form or another clear opt-in method.</p>
        <p>Consent is not a condition of purchase.</p>
      </TermsSection>

      <TermsSection title="3. Message Frequency">
        <p>Message frequency may vary.</p>
      </TermsSection>

      <TermsSection title="4. Message and Data Rates">
        <p>Message and data rates may apply.</p>
      </TermsSection>

      <TermsSection title="5. Opt-Out">
        <p>You can opt out at any time by replying <strong>STOP</strong> to any message.</p>
        <p>After you reply STOP, you may receive a final confirmation message and then no further SMS messages will be sent unless you opt in again.</p>
      </TermsSection>

      <TermsSection title="6. Help">
        <p>Reply <strong>HELP</strong> for help.</p>
        <p>You can also contact us at:</p>
        <div className="ml-2 space-y-0.5 mt-1">
          <p><strong>{company}</strong></p>
          <p>{phone}</p>
          <p>{email}</p>
        </div>
      </TermsSection>

      <TermsSection title="7. Privacy">
        <p>
          Your information will be handled in accordance with our{" "}
          <PrivacyPolicyModal
            trigger={
              <span className="text-[#0D9488] hover:text-[#0F766E] underline underline-offset-2 transition-colors font-medium cursor-pointer">
                Privacy Policy
              </span>
            }
          />
          .
        </p>
      </TermsSection>

      <TermsSection title="8. Changes">
        <p>We may update these SMS Terms &amp; Conditions at any time. Updates will be posted on this page with a new effective date.</p>
      </TermsSection>

      <TermsSection title="9. Contact">
        <p>If you have questions about these SMS Terms &amp; Conditions, contact:</p>
        <div className="ml-2 space-y-0.5 mt-1">
          <p><strong>{company}</strong></p>
          <p>{phone}</p>
          <p>{email}</p>
        </div>
      </TermsSection>
    </div>
  );
}

interface TermsAndConditionsModalProps {
  trigger?: React.ReactNode;
  className?: string;
}

export function TermsAndConditionsModal({ trigger, className }: TermsAndConditionsModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className={className} style={{ cursor: "pointer" }}>
          {trigger}
        </span>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={className ?? "text-gray-500 text-sm hover:text-white transition-colors duration-200"}
          data-testid="link-terms-conditions"
        >
          Terms &amp; Conditions
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl p-0 flex flex-col w-[95vw] sm:w-full"
          style={{ height: "90vh", maxHeight: "90vh" }}
          data-testid="dialog-terms-conditions"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="text-lg font-bold">SMS Terms &amp; Conditions</DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">Viva Web Designs</p>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4" style={{ flex: "1 1 0", minHeight: 0 }}>
            <TermsContent />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
