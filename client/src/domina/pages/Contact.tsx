import { Navigation } from "@domina/components/Navigation";
import { Footer } from "@domina/components/Footer";
import { ContactForm } from "@domina/components/ContactForm";
import { Button } from "@domina/components/ui/button";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useLanguage } from "@domina/i18n/LanguageContext";

function scrollToFormIfHash() {
  if (window.location.hash === "#contact-form") {
    setTimeout(() => {
      const el = document.getElementById("contact-form");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 300);
  }
}

export default function Contact() {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = "Contact Us | Charlotte Painting Pro";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "Get a free painting estimate from Charlotte Painting Pro. Call, email, or fill out our form. Serving Charlotte, Matthews, Mint Hill, Huntersville, and more.");
    }

    if (window.location.hash !== "#contact-form") {
      window.scrollTo(0, 0);
    }

    scrollToFormIfHash();

    window.addEventListener("hashchange", scrollToFormIfHash);
    return () => window.removeEventListener("hashchange", scrollToFormIfHash);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section className="pt-16 pb-8 md:pt-24 md:pb-12">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
          <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t.contact.label}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {t.contact.title}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t.contact.subtitle}
          </p>
        </div>
      </section>

      <section className="pb-8">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <a
              href="tel:7045550123"
              data-testid="link-phone"
              className="group rounded-md border border-border bg-secondary p-3 flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                <Phone size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm mb-1">{t.contact.callUs}</h3>
                <p className="text-muted-foreground text-xs">(704) 555-0123</p>
              </div>
            </a>

            <a
              href="https://wa.me/17045550123"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-whatsapp"
              className="group rounded-md border border-border bg-secondary p-3 flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-11 h-11 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366] group-hover:bg-[#25D366]/20 transition-colors">
                <SiWhatsapp size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm mb-1">WhatsApp</h3>
                <p className="text-muted-foreground text-xs">(704) 555-0123</p>
              </div>
            </a>

            <a
              href="mailto:quotes@charlottepaintingpro.com?subject=Website%20Inquiry"
              data-testid="link-email"
              className="group rounded-md border border-border bg-secondary p-3 flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm mb-1">{t.contact.emailUs}</h3>
                <p className="text-muted-foreground text-xs">quotes@charlottepaintingpro.com</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <div id="contact-form" className="scroll-mt-24">
            <ContactForm />
          </div>
        </div>
      </section>

      <section className="py-12 bg-secondary">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                <MapPin size={22} />
              </div>
              <h3 className="font-bold text-base mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t.contact.serviceAreaTitle}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t.contact.serviceAreaText}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                <Clock size={22} />
              </div>
              <h3 className="font-bold text-base mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t.contact.businessHoursTitle}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t.contact.businessHoursText1}<br />
                {t.contact.businessHoursText2}<br />
                {t.contact.businessHoursText3}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                <ShieldCheck size={22} />
              </div>
              <h3 className="font-bold text-base mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t.contact.promiseTitle}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t.contact.promiseText}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />

      <div className="fixed bottom-0 left-0 w-full p-3 bg-white/95 backdrop-blur-md border-t border-border md:hidden z-40">
        <a href="tel:7045550123" data-testid="link-sticky-call">
          <Button className="w-full bg-primary text-primary-foreground font-semibold h-12 text-base">
            <Phone className="mr-2 h-4 w-4" /> {t.contact.callForEstimate}
          </Button>
        </a>
      </div>
    </div>
  );
}
