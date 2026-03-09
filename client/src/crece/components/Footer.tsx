import { Link } from "wouter";
import { useLanguage } from "@crece/hooks/use-language";
import { SiFacebook, SiInstagram, SiYoutube, SiTiktok } from "react-icons/si";
import logoImg from "@assets/icon_1772859694792.png";

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-border py-10 bg-[#021824] relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent shadow-[0_0_80px_30px_rgba(59,130,246,0.12)] pointer-events-none" />
      <div className="container mx-auto px-4 md:px-6 flex flex-col items-center gap-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center w-full gap-6">
          <Link href="/" className="flex items-center" data-testid="link-footer-logo">
            {(() => {
              const P = (window as any).__PREVIEW__?.payload;
              if (P?.logoUrl) return <img src={P.logoUrl} alt={P.businessName} className="h-9 w-auto" />;
              if (P?.businessName) return <span className="font-bold text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{P.businessName}</span>;
              return <img src={logoImg} alt="Charlotte Painting Pro" className="h-9 w-auto" />;
            })()}
          </Link>

          <nav className="flex flex-wrap justify-center gap-6">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-home">{t("nav.home")}</Link>
            <Link href="/services" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-services">{t("nav.services")}</Link>
            <Link href="/gallery" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-gallery">{t("nav.gallery")}</Link>
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-about">{t("nav.about")}</Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-contact">{t("nav.contact")}</Link>
          </nav>
        </div>

        <div className="flex items-center gap-5">
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" data-testid="link-footer-facebook" className="transition-opacity hover:opacity-80">
            <SiFacebook size={22} color="#1877F2" />
          </a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" data-testid="link-footer-instagram" className="transition-opacity hover:opacity-80">
            <SiInstagram size={22} color="#E4405F" />
          </a>
          <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" data-testid="link-footer-youtube" className="transition-opacity hover:opacity-80">
            <SiYoutube size={22} color="#FF0000" />
          </a>
          <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" data-testid="link-footer-tiktok" className="transition-opacity hover:opacity-80">
            <SiTiktok size={22} color="#000000" />
          </a>
        </div>

        <p className="text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} {((window as any).__PREVIEW__?.payload?.businessName) || "Charlotte Painting Pro"}. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
