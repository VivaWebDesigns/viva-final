import { Link } from "wouter";
import { Phone, Mail } from "lucide-react";
import { SiFacebook, SiInstagram, SiTiktok, SiWhatsapp } from "react-icons/si";
import logoImg from "@assets/20BD1DF0-9B30-47F2-8E16-D17C4A22B42A_1771857217327.PNG";
import { t } from "@/content";

export default function Footer() {
  return (
    <footer className="bg-[#111] text-gray-400" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block mb-6">
              <img src={logoImg} alt="Viva Web Designs" className="h-12 w-auto brightness-110" />
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              {t("footer.tagline")}
            </p>
            <div className="flex items-center gap-3">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-[#0D9488] hover:bg-white/10 transition-all duration-200" aria-label="Facebook" data-testid="link-facebook">
                <SiFacebook className="w-5 h-5" />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-[#0D9488] hover:bg-white/10 transition-all duration-200" aria-label="Instagram" data-testid="link-instagram">
                <SiInstagram className="w-5 h-5" />
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-[#0D9488] hover:bg-white/10 transition-all duration-200" aria-label="TikTok" data-testid="link-tiktok">
                <SiTiktok className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-6">{t("footer.linksTitle")}</h3>
            <ul className="space-y-3">
              <li><Link href="/" className="text-gray-500 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-home">{t("footer.links.home")}</Link></li>
              <li><Link href="/paquetes#paquetes-list" className="text-gray-500 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-paquetes">{t("footer.links.packages")}</Link></li>
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
                <a href={`tel:+1234567890`} className="text-gray-400 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-phone">{t("global.phone")}</a>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <a href={`mailto:${t("global.email")}`} className="text-gray-400 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-email">{t("global.email")}</a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-6">{t("footer.socialTitle")}</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="flex items-center gap-3 text-gray-500 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-fb">
                  <SiFacebook className="w-4 h-4" />
                  Facebook
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center gap-3 text-gray-500 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-ig">
                  <SiInstagram className="w-4 h-4" />
                  Instagram
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center gap-3 text-gray-500 text-sm hover:text-white transition-colors duration-200" data-testid="link-footer-tk">
                  <SiTiktok className="w-4 h-4" />
                  TikTok
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-20 pt-8 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-3">
            <p className="text-gray-600 text-sm" data-testid="text-copyright">
              &copy; {new Date().getFullYear()} {t("global.company")}. {t("footer.copyright")}
            </p>
          </div>
          <p className="text-gray-600 text-sm text-center sm:text-left" data-testid="text-footer-statement">
            {t("footer.statement")}
          </p>
          <p className="text-gray-600 text-xs text-center sm:text-left mt-3" data-testid="text-service-area">
            {t("footer.serviceArea")}
          </p>
        </div>
      </div>
    </footer>
  );
}
