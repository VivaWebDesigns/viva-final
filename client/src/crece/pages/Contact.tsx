import { Navigation } from "@crece/components/Navigation";
import { Footer } from "@crece/components/Footer";
import { ContactForm } from "@crece/components/ContactForm";
import { Button } from "@crece/components/ui/button";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@crece/hooks/use-language";
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
  const { t, language } = useLanguage();
  useEffect(() => {
    document.title = language === "en" ? "Contact Us | Charlotte Painting Pro" : "Contacto | Charlotte Painting Pro";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", language === "en" 
        ? "Get a free painting estimate from Charlotte Painting Pro. Call, email, or fill out our form. Serving Charlotte, Matthews, Mint Hill, Huntersville, and more."
        : "Obtenga una estimación de pintura gratuita de Charlotte Painting Pro. Llame, envíe un correo o complete nuestro formulario. Sirviendo a Charlotte, Matthews, Mint Hill, Huntersville y más.");
    }

    if (window.location.hash !== "#contact-form") {
      window.scrollTo(0, 0);
    }

    scrollToFormIfHash();

    window.addEventListener("hashchange", scrollToFormIfHash);
    return () => window.removeEventListener("hashchange", scrollToFormIfHash);
  }, [language]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section className="pt-16 pb-8 md:pt-24 md:pb-12">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
          <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("nav.contact")}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {t("contact.title")}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t("contact.desc")}
          </p>
        </div>
      </section>

      <section className="pb-8">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <a
              href="mailto:quotes@charlottepaintingpro.com?subject=Website%20Inquiry"
              data-testid="link-email"
              className="group rounded-md border border-border bg-secondary p-6 flex items-center gap-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                <Mail size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm mb-0.5">{t("contact.email")}</h3>
                <p className="text-muted-foreground text-sm">quotes@charlottepaintingpro.com</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </a>

            <a
              href="tel:7045550123"
              data-testid="link-phone"
              className="group rounded-md border border-border bg-secondary p-6 flex items-center gap-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                <Phone size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm mb-0.5">{t("contact.call")}</h3>
                <p className="text-muted-foreground text-sm">(704) 555-0123</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </a>

            <a
              href="https://wa.me/17045550123"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-whatsapp"
              className="group rounded-md border border-border bg-secondary p-6 flex items-center gap-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-md bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
                <SiWhatsapp size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm mb-0.5">WhatsApp</h3>
                <p className="text-muted-foreground text-sm">(704) 555-0123</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground/40 group-hover:text-[#25D366] transition-colors" />
            </a>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-6 mb-8">
            <a href="#contact-form" className="inline-block">
              <Button data-testid="button-scroll-to-form" className="bg-primary text-primary-foreground font-semibold px-8">
                {t("contact.form.title")}
                <ArrowRight className="ml-2" size={18} />
              </Button>
            </a>
            <a href="tel:7045550123" className="inline-block">
              <Button data-testid="button-call-cta" variant="outline" className="font-semibold px-8">
                <Phone className="mr-2" size={16} />
                {t("contact.form.cta")}
              </Button>
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
              <h3 className="font-bold text-base mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t("contact.area")}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Charlotte, Matthews, Mint Hill, Pineville, Huntersville, Concord, Gastonia, Fort Mill
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
              <h3 className="font-bold text-base mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t("contact.hours")}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("contact.hours.mon_sat")}<br />
                8:00 AM - 6:00 PM<br />
                {t("contact.hours.sunday")}
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
              <h3 className="font-bold text-base mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t("contact.promise")}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("contact.promise.desc")}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />

      <div className="fixed bottom-0 left-0 w-full p-3 bg-white/95 backdrop-blur-md border-t border-border md:hidden z-40">
        <a href="tel:7045550123" data-testid="link-sticky-call">
          <Button className="w-full bg-primary text-primary-foreground font-semibold h-12 text-base">
            <Phone className="mr-2 h-4 w-4" /> {t("contact.form.cta")}
          </Button>
        </a>
      </div>
    </div>
  );
}
