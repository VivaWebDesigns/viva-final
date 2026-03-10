import { useEffect } from "react";
import { Navigation } from "@domina/components/Navigation";
import { Footer } from "@domina/components/Footer";
import { Button } from "@domina/components/ui/button";
import { motion } from "framer-motion";
import { Link, useLocation, useParams } from "wouter";
import { ArrowRight, CheckCircle } from "lucide-react";
import {
  PaintBucket, Wrench, Droplets, ShowerHead, Zap, AlertTriangle, HardHat, Cloud,
  Shield, CircuitBoard, Lightbulb, Truck, Leaf, Flower2, TreePine, Thermometer,
  Fan, Wind, Hammer, Building2, Sun, Fence, Layers, Home as HomeIcon,
} from "lucide-react";
import { useLanguage } from "@domina/i18n/LanguageContext";

const ICON_MAP: Record<string, React.ElementType> = {
  PaintBucket, Wrench, Droplets, ShowerHead, Zap, AlertTriangle, HardHat, Cloud,
  Shield, CircuitBoard, Lightbulb, Truck, Leaf, Flower2, TreePine, Thermometer,
  Fan, Wind, Hammer, Building2, Sun, Fence, Layers, Home: HomeIcon,
};

const slugify = (str: string) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();

  const payload = window.__PREVIEW__?.payload ?? null;
  const serviceList: any[] = payload
    ? (language === "es" ? payload.servicesES : payload.servicesEN) || []
    : [];
  const service = serviceList.find((s: any) => slugify(s.title) === slug);

  useEffect(() => {
    if (!payload || !service) {
      setLocation("/services");
      return;
    }
    const biz = payload.businessName || "Professional Contractor";
    document.title = `${service.title} | ${biz}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.setAttribute(
        "content",
        `${service.description} Contact ${biz} today for a free estimate in ${payload.city || "your area"}.`
      );
    window.scrollTo(0, 0);
  }, [payload, service, setLocation]);

  if (!payload || !service) return null;

  const Icon = ICON_MAP[service.iconName] || Building2;
  const biz = payload.businessName || "Professional Contractor";
  const city = payload.city || "your area";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section
        className="relative py-24 md:py-32 flex items-center justify-center overflow-hidden bg-primary text-primary-foreground"
        data-testid="hero-service-detail"
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 70% 50%, white 0%, transparent 60%)" }}
        />
        <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-8">
              <Icon size={40} className="text-primary-foreground" />
            </div>
            <h1
              className="text-4xl md:text-6xl font-bold mb-6 drop-shadow-sm"
              style={{ fontFamily: "var(--font-display)" }}
              data-testid="text-service-title"
            >
              {service.title}
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/85 mb-10 max-w-2xl mx-auto font-medium">
              {service.description}
            </p>
            <Link href="/contact#contact-form">
              <Button
                data-testid="button-hero-cta"
                className="bg-white text-primary hover:bg-white/90 font-bold px-10 py-4 text-lg rounded-md transition-all"
              >
                {t.services.getEstimate}
                <ArrowRight className="ml-2" size={22} />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {service.benefits?.length > 0 && (
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <h2 className="text-3xl font-bold mb-8" style={{ fontFamily: "var(--font-display)" }}>
              {language === "es" ? "¿Qué incluye este servicio?" : "What's Included"}
            </h2>
            <div className="space-y-4">
              {service.benefits.map((b: string, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-start gap-3"
                  data-testid={`benefit-item-${i}`}
                >
                  <CheckCircle size={20} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground/80 leading-relaxed">{b}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {service.process && (
        <section className="py-16 md:py-20 bg-secondary">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl">
            <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: "var(--font-display)" }}>
              {language === "es" ? "Nuestro Proceso" : "Our Process"}
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg">{service.process}</p>
          </div>
        </section>
      )}

      <section className="py-16 md:py-20 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto px-4 md:px-6 max-w-2xl">
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "var(--font-display)" }}>
            {language === "es"
              ? `¿Listo para empezar? Contáctanos en ${city}`
              : `Ready to Get Started in ${city}?`}
          </h2>
          <p className="text-primary-foreground/80 mb-8">
            {language === "es"
              ? `${biz} ofrece estimados gratuitos. Contáctanos hoy.`
              : `${biz} offers free estimates. Contact us today.`}
          </p>
          <Link href="/contact#contact-form">
            <Button
              data-testid="button-final-cta"
              className="bg-white text-primary font-semibold px-8 py-3 text-base hover:bg-white/90"
            >
              {t.services.getEstimate}
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </Link>
          <p className="text-primary-foreground/60 text-sm mt-6">
            <Link href="/services" className="underline hover:text-primary-foreground/80">
              {language === "es" ? "← Ver todos los servicios" : "← View All Services"}
            </Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
