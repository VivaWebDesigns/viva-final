import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "@assets/20BD1DF0-9B30-47F2-8E16-D17C4A22B42A_1771857217327.PNG";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/paquetes", label: "Paquetes" },
  { href: "/contacto", label: "Contacto" },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800" data-testid="nav-main">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
            <img src={logoImg} alt="Viva Web Designs" className="h-12 w-auto" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-semibold tracking-wide uppercase transition-colors ${
                  isActive(link.href)
                    ? "text-[hsl(340,82%,52%)]"
                    : "text-gray-700 dark:text-gray-300"
                }`}
                data-testid={`link-nav-${link.label.toLowerCase()}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <a href="tel:+1234567890" className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300" data-testid="link-phone">
              <Phone className="w-4 h-4" />
              (555) 123-4567
            </a>
            <Link href="/contacto">
              <Button className="bg-[hsl(340,82%,52%)] text-white font-bold" data-testid="button-cta-nav">
                Cotización Gratis
              </Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-gray-700 dark:text-gray-300"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="button-mobile-menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800" data-testid="nav-mobile-menu">
          <div className="px-4 py-6 space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block text-lg font-semibold py-2 ${
                  isActive(link.href)
                    ? "text-[hsl(340,82%,52%)]"
                    : "text-gray-700 dark:text-gray-300"
                }`}
                onClick={() => setIsOpen(false)}
                data-testid={`link-mobile-${link.label.toLowerCase()}`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <a href="tel:+1234567890" className="flex items-center gap-2 text-lg font-semibold text-gray-700 dark:text-gray-300 py-2" data-testid="link-mobile-phone">
                <Phone className="w-5 h-5" />
                (555) 123-4567
              </a>
              <Link href="/contacto" onClick={() => setIsOpen(false)}>
                <Button className="w-full mt-4 bg-[hsl(340,82%,52%)] text-white font-bold" data-testid="button-cta-mobile">
                  Cotización Gratis
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
