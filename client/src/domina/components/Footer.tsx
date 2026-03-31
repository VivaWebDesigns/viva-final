import { Facebook, Instagram, Youtube } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { Link } from "wouter";
import { useLanguage } from "@domina/i18n/LanguageContext";
import logoPng from "@assets/image_1_(5)_1772575534808_1773059817248.png";
import { PrivacyPolicyModal } from "@/components/PrivacyPolicyModal";

const SOCIAL_LINKS = [
  { icon: Facebook, label: "Facebook", href: "#", color: "text-[#1877F2]" },
  { icon: Instagram, label: "Instagram", href: "#", color: "text-[#E4405F]" },
  { icon: Youtube, label: "YouTube", href: "#", color: "text-[#FF0000]" },
  { icon: SiTiktok, label: "TikTok", href: "#", color: "text-white" },
];

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-border py-10 bg-[#021824] relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent shadow-[0_0_90px_35px_rgba(59,130,246,0.15)] pointer-events-none" />
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div className="flex flex-col gap-6">
            <Link href="/" className="flex items-center" data-testid="link-footer-logo">
              {(() => {
                const P = window.__PREVIEW__?.payload;
                if (P?.logoUrl) return <img src={P.logoUrl} alt={P.businessName} className="h-10 w-auto object-contain" />;
                if (P?.businessName) return <span className="font-bold text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{P.businessName}</span>;
                return <img src={logoPng} alt="Charlotte Painting Pro" className="h-10 w-auto object-contain" />;
              })()}
            </Link>
            
            <div className="flex items-center gap-4 md:hidden justify-center">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${social.color} hover:opacity-80 transition-opacity p-1`}
                  aria-label={social.label}
                  data-testid={`link-footer-social-${social.label.toLowerCase()}`}
                >
                  <social.icon size={20} />
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-8">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>{t.footer.pages}</h4>
              <nav className="flex flex-col gap-2">
                <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-home">{t.nav.home}</Link>
                <Link href="/services" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-services">{t.nav.services}</Link>
                <Link href="/portfolio" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-portfolio">{t.nav.portfolio}</Link>
                <Link href="/gallery" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-gallery">{t.nav.gallery}</Link>
                <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-about">{t.nav.about}</Link>
                <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-contact">{t.nav.contact}</Link>
              </nav>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>{t.footer.services}</h4>
              <nav className="flex flex-col gap-2">
                <Link href="/services/interior-painting" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-interior">{t.nav.interiorPainting}</Link>
                <Link href="/services/exterior-painting" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-exterior">{t.nav.exteriorPainting}</Link>
                <Link href="/services/kitchen-cabinet-painting" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-cabinets">{t.nav.cabinetPainting}</Link>
                <Link href="/services/deck-staining" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-deck">{t.nav.deckStaining}</Link>
                <Link href="/services/fence-staining" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-fence">{t.nav.fenceStaining}</Link>
                <Link href="/services/commercial-painting" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-commercial">{t.nav.commercialPainting}</Link>
              </nav>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} {t.footer.copyright}
            </p>
            <PrivacyPolicyModal className="text-muted-foreground text-sm hover:text-foreground transition-colors" />
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${social.color} hover:opacity-80 transition-opacity p-1`}
                aria-label={social.label}
                data-testid={`link-footer-social-desktop-${social.label.toLowerCase()}`}
              >
                <social.icon size={20} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
