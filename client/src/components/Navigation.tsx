import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "@assets/Viva_1772823591549.png";
import { t } from "@/content";
import { usePreviewLang } from "@/contexts/PreviewLangContext";

const navLinks = [
  { href: "/", labelKey: "nav.home" },
  { href: "/paquetes#paquetes-list", labelKey: "nav.packages" },
  { href: "/contacto", labelKey: "nav.contact" },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const { lang, setLang } = usePreviewLang();

  const isAdminPage = location === "/admin/demo-builder";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    if (href.startsWith("/#")) return false;
    return location.startsWith(href);
  };

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    if (href.startsWith("/#")) {
      const id = href.slice(2);
      if (location === "/") {
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 100);
        return;
      } else {
        setLocation("/");
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 500);
        return;
      }
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-gray-200 dark:border-gray-800 ${
        scrolled
          ? "bg-white dark:bg-[#0d0d0d] backdrop-blur-md shadow-sm"
          : "bg-white dark:bg-[#0d0d0d]"
      }`}
      data-testid="nav-main"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[62px] md:h-[60px]">

          {/* Logo — always visible */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0" data-testid="link-logo">
            <img src={logoImg} alt="Viva Web Designs" className="h-14 md:h-12 w-auto object-contain" />
          </Link>

          {/* Desktop nav links — always visible */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href.includes("#") ? link.href : link.href}
                className={`text-[13px] font-semibold tracking-wide transition-colors duration-200 ${
                  isActive(link.href)
                    ? "text-[#0D9488]"
                    : "text-[#111] dark:text-gray-300 hover:text-[#0D9488]"
                }`}
                onClick={() => handleNavClick(link.href)}
                data-testid={`link-nav-${link.labelKey.split(".")[1]}`}
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-3">
            {/* EN/ES toggle — only on admin demo builder page, replaces CTA */}
            {isAdminPage ? (
              <div
                className="flex items-center rounded-full border border-border overflow-hidden text-xs font-bold"
                data-testid="toggle-lang-nav"
              >
                <button
                  data-testid="toggle-lang-en"
                  onClick={() => setLang("en")}
                  className={`px-4 py-1.5 transition-colors ${
                    lang === "en"
                      ? "bg-[#0D9488] text-white"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  EN
                </button>
                <button
                  data-testid="toggle-lang-es"
                  onClick={() => setLang("es")}
                  className={`px-4 py-1.5 transition-colors ${
                    lang === "es"
                      ? "bg-[#0D9488] text-white"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ES
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-[11px] font-medium text-gray-400 hover:text-[#0D9488] transition-colors"
                  data-testid="link-staff-login"
                >
                  Staff Login
                </Link>
                <Link href="/contacto">
                  <Button
                    className="bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold px-6 rounded-full transition-all duration-200 hover:shadow-lg"
                    data-testid="button-cta-nav"
                  >
                    {t("nav.cta")}
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile: EN/ES toggle on admin page, hamburger everywhere else */}
          {isAdminPage ? (
            <div
              className="flex md:hidden items-center rounded-full border border-border overflow-hidden text-xs font-bold"
              data-testid="toggle-lang-nav-mobile"
            >
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-1.5 transition-colors ${
                  lang === "en"
                    ? "bg-[#0D9488] text-white"
                    : "bg-transparent text-muted-foreground"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("es")}
                className={`px-3 py-1.5 transition-colors ${
                  lang === "es"
                    ? "bg-[#0D9488] text-white"
                    : "bg-transparent text-muted-foreground"
                }`}
              >
                ES
              </button>
            </div>
          ) : (
            <button
              className="md:hidden p-2 text-[#111] dark:text-gray-300"
              onClick={() => setIsOpen(!isOpen)}
              data-testid="button-mobile-menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {isOpen && (
        <div className="md:hidden bg-white dark:bg-[#0d0d0d] border-t border-gray-100 dark:border-gray-800" data-testid="nav-mobile-menu">
          <div className="px-4 py-6 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href.includes("#") ? link.href : link.href}
                className={`block text-lg font-semibold py-3 transition-colors ${
                  isActive(link.href)
                    ? "text-[#0D9488]"
                    : "text-[#111] dark:text-gray-300"
                }`}
                onClick={() => handleNavClick(link.href)}
                data-testid={`link-mobile-${link.labelKey.split(".")[1]}`}
              >
                {t(link.labelKey)}
              </Link>
            ))}
            {!isAdminPage && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <Link href="/contacto" onClick={() => setIsOpen(false)}>
                  <Button className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-lg rounded-full" data-testid="button-cta-mobile">
                    {t("nav.cta")}
                  </Button>
                </Link>
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="block text-center text-sm text-gray-400 hover:text-[#0D9488] transition-colors py-1"
                  data-testid="link-staff-login-mobile"
                >
                  Staff Login
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
