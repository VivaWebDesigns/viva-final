import { Link } from "wouter";
import { Phone, Mail, MapPin } from "lucide-react";
import { SiFacebook, SiInstagram, SiTiktok } from "react-icons/si";
import logoImg from "@assets/20BD1DF0-9B30-47F2-8E16-D17C4A22B42A_1771857217327.PNG";

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-300" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-1">
            <img src={logoImg} alt="Viva Web Designs" className="h-12 w-auto mb-6 brightness-110" />
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Ayudamos a contratistas latinos a crecer su negocio con marketing digital que genera resultados reales.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 transition-colors" aria-label="Facebook" data-testid="link-facebook">
                <SiFacebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 transition-colors" aria-label="Instagram" data-testid="link-instagram">
                <SiInstagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 transition-colors" aria-label="TikTok" data-testid="link-tiktok">
                <SiTiktok className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-6">Servicios</h3>
            <ul className="space-y-3">
              <li><Link href="/servicios" className="text-gray-400 text-sm transition-colors" data-testid="link-footer-web">Sitios Web Profesionales</Link></li>
              <li><Link href="/servicios" className="text-gray-400 text-sm transition-colors" data-testid="link-footer-seo">SEO y Google Maps</Link></li>
              <li><Link href="/servicios" className="text-gray-400 text-sm transition-colors" data-testid="link-footer-social">Redes Sociales</Link></li>
              <li><Link href="/servicios" className="text-gray-400 text-sm transition-colors" data-testid="link-footer-google">Google Ads</Link></li>
              <li><Link href="/servicios" className="text-gray-400 text-sm transition-colors" data-testid="link-footer-brand">Branding y Logo</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-6">Enlaces</h3>
            <ul className="space-y-3">
              <li><Link href="/" className="text-gray-400 text-sm transition-colors" data-testid="link-footer-home">Inicio</Link></li>
              <li><Link href="/servicios" className="text-gray-400 text-sm transition-colors" data-testid="link-footer-services">Servicios</Link></li>
              <li><Link href="/nosotros" className="text-gray-400 text-sm transition-colors" data-testid="link-footer-about">Nosotros</Link></li>
              <li><Link href="/contacto" className="text-gray-400 text-sm transition-colors" data-testid="link-footer-contact">Contacto</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-6">Contacto</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[hsl(340,82%,52%)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-gray-400 text-sm">Llámanos</p>
                  <a href="tel:+1234567890" className="text-white text-sm font-semibold" data-testid="link-footer-phone">(555) 123-4567</a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[hsl(340,82%,52%)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <a href="mailto:info@vivawebdesigns.com" className="text-white text-sm font-semibold" data-testid="link-footer-email">info@vivawebdesigns.com</a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[hsl(340,82%,52%)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-gray-400 text-sm">Ubicación</p>
                  <p className="text-white text-sm font-semibold">Servicio en todo EE.UU.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm" data-testid="text-copyright">
            &copy; {new Date().getFullYear()} Viva Web Designs. Todos los derechos reservados.
          </p>
          <p className="text-gray-500 text-sm">
            Hecho con orgullo para la comunidad latina.
          </p>
        </div>
      </div>
    </footer>
  );
}
