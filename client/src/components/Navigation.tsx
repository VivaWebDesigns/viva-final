import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "@assets/20BD1DF0-9B30-47F2-8E16-D17C4A22B42A_1771857217327.PNG";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/paquetes", label: "Paquetes" },
  { href: "/#como-funciona", label: "Cómo Funciona" },
  { href: "/contacto", label: "Contacto" },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);

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
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          return;
        }
      } else {
        setLocation("/");
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 300);
        return;
      }
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 dark:bg-gray-950/95 backdrop-blur-md shadow-sm"
          : "bg-white/95 dark:bg-gray-950/95 backdrop-blur-md"
      }`}
      data-testid="nav-main"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">
          {/* Logo — left */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0" data-testid="link-logo">
            <img src={logoImg} alt="Viva Web Designs" className="h-10 w-auto" />
          </Link>

          {/* Menu — center */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href.startsWith("/#") ? "/" : link.href}
                className={`text-sm font-semibold tracking-wide transition-colors ${
                  isActive(link.href)
                    ? "text-[hsl(340,82%,52%)]"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
                onClick={() => handleNavClick(link.href)}
                data-testid={`link-nav-${link.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA — right */}
          <div className="hidden md:block">
            <Link href="/contacto">
              <Button className="bg-[hsl(340,82%,52%)] text-white font-bold px-6" data-testid="button-cta-nav">
                Comenzar
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-gray-700 dark:text-gray-300"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="button-mobile-menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800" data-testid="nav-mobile-menu">
          <div className="px-4 py-6 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href.startsWith("/#") ? "/" : link.href}
                className={`block text-lg font-semibold py-3 ${
                  isActive(link.href)
                    ? "text-[hsl(340,82%,52%)]"
                    : "text-gray-700 dark:text-gray-300"
                }`}
                onClick={() => handleNavClick(link.href)}
                data-testid={`link-mobile-${link.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <Link href="/contacto" onClick={() => setIsOpen(false)}>
                <Button className="w-full bg-[hsl(340,82%,52%)] text-white font-bold text-lg" data-testid="button-cta-mobile">
                  Comenzar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
