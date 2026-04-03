import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-gray-900 mb-3 pb-1 border-b border-gray-200">{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function PrivacyPolicyContent() {
  const company = "Viva Web Designs LLC";
  const email = "info@vivawebdesigns.com";
  const phone = "(980) 949-0548";
  const effective = "January 1, 2025";
  const effectiveEs = "1 de enero de 2025";

  return (
    <div className="text-sm">

      {/* ── Spanish ── */}
      <h2 className="text-base font-bold text-gray-900 mb-1">Política de Privacidad</h2>
      <p className="text-xs text-gray-500 mb-6">Fecha de vigencia: {effectiveEs}</p>

      <p className="text-sm text-gray-700 leading-relaxed mb-8">
        {company} ("nosotros", "nuestro" o "nos") se compromete a proteger tu privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos, divulgamos y protegemos tu información cuando visitas nuestro sitio web o interactúas con nuestros servicios. Lee esta política detenidamente.
      </p>

      <PolicySection title="1. Información que recopilamos">
        <p>Podemos recopilar las siguientes categorías de información personal:</p>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li><strong>Información de contacto:</strong> Nombre, correo electrónico, número de teléfono y nombre del negocio cuando completas un formulario de contacto o solicitas una cotización.</li>
          <li><strong>Datos de uso:</strong> Dirección IP, tipo de navegador, páginas visitadas y tiempo en nuestro sitio, recopilados automáticamente mediante cookies y herramientas de análisis.</li>
          <li><strong>Comunicaciones:</strong> Mensajes que nos envías a través de formularios de contacto, correo electrónico o SMS.</li>
          <li><strong>Información comercial:</strong> Rubro, ciudad e intereses de servicio que compartes al consultar sobre nuestros servicios.</li>
        </ul>
      </PolicySection>

      <PolicySection title="2. Cómo usamos tu información">
        <p>Usamos la información que recopilamos para:</p>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Responder tus consultas y brindar atención al cliente</li>
          <li>Enviar actualizaciones de servicio, propuestas y comunicaciones relacionadas con tu cuenta</li>
          <li>Mejorar nuestro sitio web, servicios y materiales de marketing</li>
          <li>Cumplir con obligaciones legales</li>
          <li>Enviar comunicaciones por SMS y correo electrónico a las que te hayas suscrito</li>
        </ul>
      </PolicySection>

      <PolicySection title="3. Compartir tu información">
        <p>
          No vendemos, intercambiamos ni alquilamos tu información personal a terceros con fines de marketing o promoción. Podemos compartir tu información con proveedores de servicios de confianza que nos ayudan a operar nuestro sitio web y brindar nuestros servicios, sujeto a obligaciones de confidencialidad. Estos incluyen:
        </p>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Proveedores de alojamiento web y tecnología</li>
          <li>Plataformas de gestión de relaciones con clientes (CRM)</li>
          <li>Plataformas de envío de correo electrónico y SMS</li>
          <li>Proveedores de análisis</li>
        </ul>
        <p className="mt-3">
          También podemos divulgar tu información cuando lo exija la ley, para proteger nuestros derechos, o en conexión con una transferencia comercial como una fusión o adquisición.
        </p>
      </PolicySection>

      <PolicySection title="4. Cookies y tecnologías de seguimiento">
        <p>
          Nuestro sitio web utiliza cookies y tecnologías de seguimiento similares para mejorar tu experiencia de navegación, analizar el tráfico del sitio y entender cómo los visitantes interactúan con nuestro contenido. Puedes configurar tu navegador para rechazar todas las cookies o para indicar cuándo se envía una cookie. Sin embargo, algunas funciones de nuestro sitio pueden no funcionar correctamente sin cookies.
        </p>
      </PolicySection>

      <PolicySection title="5. Seguridad de los datos">
        <p>
          Implementamos medidas técnicas y organizativas apropiadas para proteger tu información personal contra el acceso no autorizado, la alteración, divulgación o destrucción. Sin embargo, ningún método de transmisión por internet o almacenamiento electrónico es 100% seguro, y no podemos garantizar una seguridad absoluta.
        </p>
      </PolicySection>

      <PolicySection title="6. Enlaces a terceros">
        <p>
          Nuestro sitio web puede contener enlaces a sitios web de terceros. No somos responsables de las prácticas de privacidad de esos sitios y te recomendamos revisar sus políticas de privacidad antes de proporcionar cualquier información personal.
        </p>
      </PolicySection>

      <PolicySection title="7. Privacidad de menores">
        <p>
          Nuestros servicios no están dirigidos a personas menores de 18 años. No recopilamos conscientemente información personal de menores. Si crees que un menor nos ha proporcionado información personal, contáctanos y tomaremos medidas para eliminarla.
        </p>
      </PolicySection>

      <PolicySection title="8. Tus derechos">
        <p>Según tu ubicación, es posible que tengas derecho a:</p>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Acceder a la información personal que tenemos sobre ti</li>
          <li>Solicitar la corrección de datos inexactos</li>
          <li>Solicitar la eliminación de tu información personal</li>
          <li>Cancelar la suscripción a comunicaciones de marketing en cualquier momento</li>
        </ul>
        <p className="mt-3">Para ejercer cualquiera de estos derechos, contáctanos en {email}.</p>
      </PolicySection>

      <PolicySection title="9. Cambios en esta política">
        <p>
          Podemos actualizar esta Política de Privacidad de vez en cuando. Te notificaremos de cualquier cambio significativo actualizando la fecha de vigencia en la parte superior de esta página. El uso continuo de nuestro sitio web después de que se publiquen los cambios constituye tu aceptación de la política actualizada.
        </p>
      </PolicySection>

      <PolicySection title="10. Términos de SMS y Política de Privacidad">
        <p>
          Al suscribirte a los mensajes SMS de {company}, aceptas recibir mensajes de texto para atención al cliente, actualizaciones del servicio y otras comunicaciones relacionadas con tu cuenta.
        </p>
        <p>
          Puedes cancelar el servicio SMS en cualquier momento. Solo responde <strong>STOP</strong>. Después de enviar el mensaje "STOP", recibirás un mensaje de confirmación de cancelación y ya no recibirás más mensajes SMS. Si deseas volver a suscribirte, regístrate como lo hiciste la primera vez.
        </p>
        <p>
          Si tienes problemas con el programa de mensajes, puedes responder <strong>HELP</strong> para obtener más ayuda.
        </p>
        <p>
          Los operadores no son responsables por mensajes retrasados o no entregados.
        </p>
        <p>
          Pueden aplicarse tarifas de mensajes y datos. La frecuencia de los mensajes puede variar. Si tienes preguntas sobre tu plan de mensajes o datos, lo mejor es contactar a tu proveedor de servicios inalámbricos.
        </p>
        <p>
          {company} no comparte números de teléfono móvil, datos de opt-in de mensajes de texto ni consentimiento con terceros o afiliados con fines de marketing o promoción.
        </p>
        <p>
          La información móvil solo puede compartirse con subcontratistas y proveedores de servicios que apoyan la prestación de servicios de SMS, como plataformas de mensajería, proveedores de telecomunicaciones o proveedores de atención al cliente. Esta información se utiliza únicamente para proporcionar y operar el servicio de mensajería.
        </p>
        <p>
          Todas las categorías anteriores excluyen los datos de opt-in de mensajes de texto y el consentimiento; esta información no se compartirá con terceros.
        </p>
      </PolicySection>

      <PolicySection title="11. Contáctanos">
        <p>Si tienes preguntas o inquietudes sobre esta Política de Privacidad, contáctanos:</p>
        <div className="mt-2 ml-2 space-y-1">
          <p><strong>{company}</strong></p>
          <p>Teléfono: {phone}</p>
          <p>Correo: {email}</p>
        </div>
      </PolicySection>

      {/* ── Divider ── */}
      <div className="border-t-2 border-gray-200 my-8" />

      {/* ── English ── */}
      <h2 className="text-base font-bold text-gray-900 mb-1">Privacy Policy</h2>
      <p className="text-xs text-gray-500 mb-6">Effective Date: {effective}</p>

      <p className="text-sm text-gray-700 leading-relaxed mb-8">
        {company} ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or interact with our services. Please read this policy carefully.
      </p>

      <PolicySection title="1. Information We Collect">
        <p>We may collect the following categories of personal information:</p>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li><strong>Contact Information:</strong> Name, email address, phone number, and business name when you fill out a contact form or request a quote.</li>
          <li><strong>Usage Data:</strong> IP address, browser type, pages visited, and time spent on our website, collected automatically via cookies and analytics tools.</li>
          <li><strong>Communications:</strong> Messages you send us via contact forms, email, or SMS.</li>
          <li><strong>Business Information:</strong> Trade, city, and service interests you share when inquiring about our services.</li>
        </ul>
      </PolicySection>

      <PolicySection title="2. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Respond to your inquiries and provide customer support</li>
          <li>Send service updates, proposals, and communications related to your account</li>
          <li>Improve our website, services, and marketing materials</li>
          <li>Comply with legal obligations</li>
          <li>Send SMS and email communications you have opted into</li>
        </ul>
      </PolicySection>

      <PolicySection title="3. Sharing of Your Information">
        <p>
          We do not sell, trade, or rent your personal information to third parties for marketing or promotional purposes. We may share your information with trusted service providers who assist us in operating our website and delivering our services, subject to confidentiality obligations. These include:
        </p>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Web hosting and technology providers</li>
          <li>Customer relationship management (CRM) platforms</li>
          <li>Email and SMS delivery platforms</li>
          <li>Analytics providers</li>
        </ul>
        <p className="mt-3">
          We may also disclose your information when required by law, to protect our rights, or in connection with a business transfer such as a merger or acquisition.
        </p>
      </PolicySection>

      <PolicySection title="4. Cookies and Tracking Technologies">
        <p>
          Our website uses cookies and similar tracking technologies to enhance your browsing experience, analyze site traffic, and understand how visitors interact with our content. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, some features of our website may not function properly without cookies.
        </p>
      </PolicySection>

      <PolicySection title="5. Data Security">
        <p>
          We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
        </p>
      </PolicySection>

      <PolicySection title="6. Third-Party Links">
        <p>
          Our website may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies before providing any personal information.
        </p>
      </PolicySection>

      <PolicySection title="7. Children's Privacy">
        <p>
          Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will take steps to delete it.
        </p>
      </PolicySection>

      <PolicySection title="8. Your Rights">
        <p>Depending on your location, you may have the right to:</p>
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your personal information</li>
          <li>Opt out of marketing communications at any time</li>
        </ul>
        <p className="mt-3">To exercise any of these rights, contact us at {email}.</p>
      </PolicySection>

      <PolicySection title="9. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any significant changes by updating the effective date at the top of this page. Your continued use of our website after changes are posted constitutes your acceptance of the updated policy.
        </p>
      </PolicySection>

      <PolicySection title="10. SMS Terms &amp; Privacy Policy">
        <p>
          By opting in to SMS messages from {company}, you agree to receive text messages for customer support, service updates, and other communications related to your account.
        </p>
        <p>
          You can cancel the SMS service at any time. Just text <strong>STOP</strong>. After you send the SMS message "STOP" to us, we will send you an SMS message to confirm that you have been unsubscribed. After this, you will no longer receive SMS messages from us. If you want to join again, just sign up as you did the first time and we will start sending SMS messages to you again.
        </p>
        <p>
          If you are experiencing issues with the messaging program, you can reply with the keyword <strong>HELP</strong> for more assistance.
        </p>
        <p>
          Carriers are not liable for delayed or undelivered messages.
        </p>
        <p>
          As always, message and data rates may apply for any messages sent to you from us and to us from you. Message frequency varies. If you have any questions about your text plan or data plan, it is best to contact your wireless provider.
        </p>
        <p>
          {company} does not share mobile numbers, text messaging originator opt-in data, or consent with any third parties or affiliates for marketing or promotional purposes.
        </p>
        <p>
          Mobile information may be shared only with subcontractors and service providers that support the delivery of SMS services, such as messaging platforms, telecommunications providers, or customer support vendors. This information is used solely to provide and operate the messaging service.
        </p>
        <p>
          All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
        </p>
      </PolicySection>

      <PolicySection title="11. Contact Us">
        <p>If you have questions or concerns about this Privacy Policy, please contact us:</p>
        <div className="mt-2 ml-2 space-y-1">
          <p><strong>{company}</strong></p>
          <p>Phone: {phone}</p>
          <p>Email: {email}</p>
        </div>
      </PolicySection>
    </div>
  );
}

interface PrivacyPolicyModalProps {
  trigger?: React.ReactNode;
  className?: string;
}

export function PrivacyPolicyModal({ trigger, className }: PrivacyPolicyModalProps) {
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
          data-testid="link-privacy-policy"
        >
          Privacy Policy
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl p-0 flex flex-col w-[95vw] sm:w-full"
          style={{ height: "90vh", maxHeight: "90vh" }}
          data-testid="dialog-privacy-policy"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="text-lg font-bold">Privacy Policy</DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">Viva Web Designs LLC</p>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4" style={{ flex: "1 1 0", minHeight: 0 }}>
            <PrivacyPolicyContent />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
