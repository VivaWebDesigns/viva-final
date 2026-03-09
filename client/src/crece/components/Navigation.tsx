import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Phone, Languages } from "lucide-react";
import { Button } from "@crece/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@crece/hooks/use-language";
import logoImg from "@assets/image_1_(5)_1772575534808_1773059817248.png";
import { SiWhatsapp } from "react-icons/si";

export function Navigation() {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: t("nav.home"), href: "/" },
    { name: t("nav.services"), href: "/services" },
    { name: t("nav.gallery"), href: "/gallery" },
    { name: t("nav.about"), href: "/about" },
    { name: t("nav.contact"), href: "/contact" },
  ];

  return (
    <>
    <nav
      data-testid="navigation"
      className={`sticky ${(window as any).__PREVIEW__ ? "top-0" : "top-[44px]"} w-full z-50 bg-white transition-shadow duration-300 py-3 ${
        scrolled ? "shadow-md" : ""
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex justify-between items-center">
        <Link
          href="/"
          className="cursor-pointer flex items-center gap-2.5 group"
          data-testid="link-logo"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          {(() => {
            const P = (window as any).__PREVIEW__?.payload;
            if (P?.logoUrl) return <img src={P.logoUrl} alt={P.businessName} className="h-10 md:h-12 w-auto" />;
            if (P?.businessName) return <span className="font-bold text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{P.businessName}</span>;
            return <img src={logoImg} alt="Charlotte Painting Pro" className="h-10 md:h-12 w-auto" />;
          })()}
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium cursor-pointer transition-colors ${
                location === link.href ? "text-primary" : "text-foreground/60 hover:text-foreground"
              }`}
              onClick={() => {
                if (location === link.href) {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              data-testid={`link-nav-${link.href.replace("/", "") || "home"}`}
            >
              {link.name}
            </Link>
          ))}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "en" ? "es" : "en")}
            className="flex items-center gap-2 font-medium text-foreground/60 hover:text-foreground hover:bg-transparent"
          >
            EN/ES
          </Button>

          <Link href="/contact#contact-form">
            <Button data-testid="button-nav-quote" className="bg-primary text-primary-foreground font-semibold">
              {t("nav.getQuote")}
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "en" ? "es" : "en")}
            className="flex items-center gap-1 p-2 text-foreground/60 hover:text-foreground hover:bg-transparent"
          >
            <span className="text-xs font-medium">EN/ES</span>
          </Button>
          
          <button
            className="p-2 text-foreground"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
            data-testid="button-mobile-menu"
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 w-full bg-white border-t border-border md:hidden flex flex-col p-6 gap-1 shadow-lg"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-base font-medium py-3 border-b border-border/50 cursor-pointer ${
                  location === link.href ? "text-primary" : "text-foreground/80"
                }`}
                onClick={() => {
                  if (location === link.href) {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                  setIsOpen(false);
                }}
                data-testid={`link-mobile-${link.href.replace("/", "") || "home"}`}
              >
                {link.name}
              </Link>
            ))}
            <Link
              href="/contact#contact-form"
              onClick={() => setIsOpen(false)}
            >
              <Button data-testid="button-mobile-quote" className="w-full bg-primary text-primary-foreground text-base font-semibold mt-4">
                {t("nav.freeEstimate")}
              </Button>
            </Link>
            <a href={`tel:${((window as any).__PREVIEW__?.phone || "(704) 555-0123").replace(/\D/g, '')}`} className="flex items-center justify-center gap-2 text-muted-foreground font-medium py-3 mt-2" data-testid="link-mobile-phone">
              <Phone size={16} /> {(window as any).__PREVIEW__?.phone || "(704) 555-0123"}
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
    {!isOpen && (
      <a
        href={`https://wa.me/${(() => { const d = ((window as any).__PREVIEW__?.phone || "17045550123").replace(/\D/g,''); return d.length === 10 ? '1' + d : d; })()}`}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="button-whatsapp-float"
        style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9000, width: "56px", height: "56px", borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(37,211,102,0.45)", transition: "transform 0.2s" }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.12)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        <SiWhatsapp style={{ width: "30px", height: "30px", color: "#fff" }} />
      </a>
    )}
    </>
  );
}
