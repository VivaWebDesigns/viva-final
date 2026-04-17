import { Link } from "wouter";
import { Phone, Mail } from "lucide-react";
import { SiFacebook, SiInstagram, SiTiktok, SiWhatsapp } from "react-icons/si";
import logoImg from "@assets/Viva_1772823591549.png";
import { t } from "@/content";
import { PrivacyPolicyModal } from "@/components/PrivacyPolicyModal";

export default function Footer() {
  return (
    <footer className="text-gray-400 bg-[#021824] relative overflow-hidden" data-testid="footer">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent shadow-[0_0_100px_40px_rgba(59,130,246,0.15)] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block mb-6">
              <img src={logoImg} alt="Viva Web Designs" className="h-10 lg:h-[51px] w-auto" />
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              {t("footer.tagline")}
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-6">{t("footer.linksTitle")}</h3>
            <ul className="space-y-3">
              <li><Link href="/" className="text-gray-500 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-home">{t("footer.links.home")}</Link></li>
              <li><Link href="/paquetes" className="text-gray-500 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-paquetes">{t("footer.links.packages")}</Link></li>
              <li><Link href="/paquetes/empieza" className="text-gray-500 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-empieza">{t("footer.links.planEmpieza")}</Link></li>
              <li><Link href="/paquetes/crece" className="text-gray-500 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-crece">{t("footer.links.planCrece")}</Link></li>
              <li><Link href="/paquetes/domina" className="text-gray-500 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-domina">{t("footer.links.planDomina")}</Link></li>
              <li><Link href="/contacto" className="text-gray-500 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-contact">{t("footer.links.contact")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-6">{t("footer.contactTitle")}</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <SiWhatsapp className="w-5 h-5 text-[#25D366] flex-shrink-0 mt-0.5" />
                <a href={t("global.whatsappUrl")} target="_blank" rel="noopener noreferrer" className="text-gray-400 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-whatsapp">{t("footer.whatsapp")}</a>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <a href={`tel:+19809490548`} className="text-gray-400 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-phone">{t("global.phone")}</a>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <a href={`mailto:${t("global.email")}`} className="text-gray-400 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-email">{t("global.email")}</a>
              </li>
            </ul>
          </div>

          <div className="hidden lg:block">
            {/* Spacer to maintain grid layout if needed, or just remove the column */}
          </div>
        </div>

        <div className="mt-20 pt-8 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-3">
            <p className="text-gray-600 text-sm" data-testid="text-copyright">
              &copy; {new Date().getFullYear()} {t("global.company")}. {t("footer.copyright")}
            </p>
            <PrivacyPolicyModal />
          </div>
          <p className="text-gray-600 text-sm text-center sm:text-left" data-testid="text-footer-statement">
            {t("footer.statement")}
          </p>
          <p className="text-gray-600 text-xs text-center sm:text-left mt-3" data-testid="text-service-area">
            Atendemos a clientes hispanohablantes en todo Estados Unidos.
          </p>
        </div>
      </div>
    </footer>
  );
}
