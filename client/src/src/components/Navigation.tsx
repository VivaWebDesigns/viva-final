import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Phone, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import logoPng from "@assets/image_1_(5)_1772575534808_1772576521710.png";

export function Navigation() {
  const { t } = useLanguage();

  const serviceLinks = [
    { name: t.nav.interiorPainting, href: "/services/interior-painting" },
    { name: t.nav.exteriorPainting, href: "/services/exterior-painting" },
    { name: t.nav.cabinetPainting, href: "/services/kitchen-cabinet-painting" },
    { name: t.nav.deckStaining, href: "/services/deck-staining" },
    { name: t.nav.fenceStaining, href: "/services/fence-staining" },
    { name: t.nav.commercialPainting, href: "/services/commercial-painting" },
  ];
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [location] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setServicesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isServicesActive = location.startsWith("/services");

  const navLinks = [
    { name: t.nav.home, href: "/" },
    { name: t.nav.portfolio, href: "/portfolio" },
    { name: t.nav.gallery, href: "/gallery" },
    { name: t.nav.about, href: "/about" },
    { name: t.nav.contact, href: "/contact" },
  ];

  return (
    <nav
      data-testid="navigation"
      className={`sticky top-0 w-full z-50 bg-white transition-shadow duration-300 py-3 ${
        scrolled ? "shadow-md" : ""
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex justify-between items-center">
        <Link
          href="/"
          className="cursor-pointer flex items-center group"
          data-testid="link-logo"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <img src={logoPng} alt="Charlotte Painting Pro" className="h-10 md:h-12 w-auto object-contain" />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/"
            className={`text-sm font-medium cursor-pointer transition-colors ${
              location === "/" ? "text-primary" : "text-foreground/60 hover:text-foreground"
            }`}
            onClick={() => {
              if (location === "/") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            data-testid="link-nav-home"
          >
            {t.nav.home}
          </Link>

          <div
            className="relative"
            ref={dropdownRef}
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button
              className={`text-sm font-medium cursor-pointer transition-colors flex items-center gap-1 ${
                isServicesActive ? "text-primary" : "text-foreground/60 hover:text-foreground"
              }`}
              onClick={() => setServicesOpen(!servicesOpen)}
              data-testid="link-nav-services"
            >
              {t.nav.services}
              <ChevronDown size={14} className={`transition-transform ${servicesOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {servicesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-56"
                  data-testid="dropdown-services"
                >
                  <div className="bg-white border border-border rounded-md shadow-lg py-2">
                  <Link
                    href="/services"
                    className="block px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors border-b border-border/50"
                    onClick={() => setServicesOpen(false)}
                    data-testid="link-dropdown-all-services"
                  >
                    {t.nav.allServices}
                  </Link>
                  {serviceLinks.map((service) => (
                    <Link
                      key={service.href}
                      href={service.href}
                      className={`block px-4 py-2.5 text-sm transition-colors ${
                        location === service.href
                          ? "text-primary font-medium bg-primary/5"
                          : "text-foreground/70 hover:text-foreground hover:bg-secondary"
                      }`}
                      onClick={() => setServicesOpen(false)}
                      data-testid={`link-dropdown-${service.href.split("/").pop()}`}
                    >
                      {service.name}
                    </Link>
                  ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {navLinks.slice(1).map((link) => (
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
          <LanguageToggle />
        </div>

        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
          data-testid="button-mobile-menu"
        >
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 w-full bg-white border-t border-border md:hidden flex flex-col p-6 gap-1 shadow-lg"
          >
            <div className="flex items-center justify-end mb-2">
              <LanguageToggle />
            </div>
            <Link
              href="/"
              className={`text-base font-medium py-3 border-b border-border/50 cursor-pointer ${
                location === "/" ? "text-primary" : "text-foreground/80"
              }`}
              onClick={() => {
                if (location === "/") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
                setIsOpen(false);
              }}
              data-testid="link-mobile-home"
            >
              {t.nav.home}
            </Link>

            <div>
              <button
                className={`w-full flex items-center justify-between text-base font-medium py-3 border-b border-border/50 cursor-pointer ${
                  isServicesActive ? "text-primary" : "text-foreground/80"
                }`}
                onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                data-testid="link-mobile-services"
              >
                {t.nav.services}
                <ChevronDown size={16} className={`transition-transform ${mobileServicesOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {mobileServicesOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <Link
                      href="/services"
                      className="block pl-4 py-2.5 text-sm font-semibold text-foreground border-b border-border/30"
                      onClick={() => { setIsOpen(false); setMobileServicesOpen(false); }}
                      data-testid="link-mobile-all-services"
                    >
                      {t.nav.allServices}
                    </Link>
                    {serviceLinks.map((service) => (
                      <Link
                        key={service.href}
                        href={service.href}
                        className={`block pl-4 py-2.5 text-sm border-b border-border/30 ${
                          location === service.href ? "text-primary font-medium" : "text-foreground/70"
                        }`}
                        onClick={() => { setIsOpen(false); setMobileServicesOpen(false); }}
                        data-testid={`link-mobile-${service.href.split("/").pop()}`}
                      >
                        {service.name}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {navLinks.slice(1).map((link) => (
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
                {t.nav.getEstimate}
              </Button>
            </Link>
            <a href="tel:7045550123" className="flex items-center justify-center gap-2 text-muted-foreground font-medium py-3 mt-2" data-testid="link-mobile-phone">
              <Phone size={16} /> (704) 555-0123
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
