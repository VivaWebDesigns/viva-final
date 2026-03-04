import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ServiceCard } from "@/components/ServiceCard";
import { ReviewCard } from "@/components/ReviewCard";
import { Button } from "@/components/ui/button";
import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import {
  PaintBucket,
  Home as HomeIcon,
  Layers,
  Sun,
  Fence,
  Building2,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
} from "lucide-react";
import heroVideoWebm from "@/assets/videos/hero-painting-optimized.webm";
import heroVideoMp4 from "@/assets/videos/hero-painting-optimized.mp4";
import heroPoster from "@/assets/videos/poster.webp";

export default function Home() {
  const { language, t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    document.title = "Charlotte Painting Pro | Quality House Painting in Charlotte, NC";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "Charlotte Painting Pro offers professional interior & exterior painting, cabinet painting, and deck staining in Charlotte, NC. Get a free estimate today.");
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setVideoReady(true), { timeout: 200 });
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(() => setVideoReady(true), 0);
      return () => clearTimeout(id);
    }
  }, []);

  const handleVideoRef = (el: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    if (el) {
      el.playbackRate = 0.7;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section className="relative min-h-[80vh] flex items-center">
        <div className="absolute inset-0 z-0">
          {videoReady ? (
            <video
              ref={handleVideoRef}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              poster={heroPoster}
              className="w-full h-full object-cover"
              data-testid="video-hero"
            >
              <source src={heroVideoWebm} type="video/webm" />
              <source src={heroVideoMp4} type="video/mp4" />
            </video>
          ) : (
            <img
              src={heroPoster}
              alt=""
              className="w-full h-full object-cover"
              {...{ fetchpriority: "high" } as any}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/70 to-black/50" />
        </div>

        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl space-y-6"
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
              {t("hero.title")}
            </h1>

            <p className="text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed">
              {t("hero.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-4 pt-4">
              <Link href="/contact#contact-form">
                <Button data-testid="button-hero-cta" className="bg-primary text-primary-foreground font-semibold px-8 h-12 text-base border border-primary">
                  {t("nav.freeEstimate")}
                  <ArrowRight className="ml-2" size={18} />
                </Button>
              </Link>
              <Link href="/services">
                <Button data-testid="button-hero-services" variant="outline" className="border-white/30 text-white font-semibold px-8 h-12 text-base bg-white/5 backdrop-blur-sm">
                  {t("hero.viewServices")}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="pt-16 pb-24 md:py-24 bg-secondary">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("services.subtitle")}</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t("services.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("services.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ServiceCard
              title={t("services.interior")}
              description={t("services.interior.desc")}
              benefits={language === "en" ? ["Walls & Ceilings", "Trim & Molding", "Drywall Repair"] : ["Paredes y Techos", "Molduras", "Reparación de Paneles de Yeso"]}
              icon={PaintBucket}
              delay={0.1}
              href="/services#interior-painting"
            />
            <ServiceCard
              title={t("services.exterior")}
              description={t("services.exterior.desc")}
              benefits={language === "en" ? ["Siding Painting", "Brick Painting", "Pressure Washing"] : ["Pintura de Revestimiento", "Pintura de Ladrillo", "Lavado a Presión"]}
              icon={HomeIcon}
              delay={0.2}
              href="/services#exterior-painting"
            />
            <ServiceCard
              title={t("services.cabinets")}
              description={t("services.cabinets.desc")}
              benefits={language === "en" ? ["Factory Finish", "Hardware Updates", "Color Consulting"] : ["Acabado de Fábrica", "Actualización de Herrajes", "Consultoría de Color"]}
              icon={Layers}
              delay={0.3}
              href="/services#kitchen-cabinet-painting"
            />
            <ServiceCard
              title={t("services.deck")}
              description={t("services.deck.desc")}
              benefits={language === "en" ? ["Cleaning & Sanding", "Stain or Paint", "Weatherproof Sealing"] : ["Limpieza y Lijado", "Tinte o Pintura", "Sellado Impermeable"]}
              icon={Sun}
              delay={0.4}
              href="/services#deck-staining"
            />
            <ServiceCard
              title={t("services.fence")}
              description={t("services.fence.desc")}
              benefits={language === "en" ? ["Full Fence Prep", "Even Coverage", "Moisture Protection"] : ["Preparación Completa", "Cobertura Uniforme", "Protección contra Humedad"]}
              icon={Fence}
              delay={0.5}
              href="/services#fence-staining"
            />
            <ServiceCard
              title={t("services.commercial")}
              description={t("services.commercial.desc")}
              benefits={language === "en" ? ["Offices & Retail", "Flexible Scheduling", "Low-Odor Paints"] : ["Oficinas y Comercios", "Horario Flexible", "Pinturas de Bajo Olor"]}
              icon={Building2}
              delay={0.6}
              href="/services#commercial-painting"
            />
          </div>

          <div className="text-center mt-10">
            <Link href="/services">
              <Button data-testid="button-view-all-services" variant="outline" className="font-semibold px-8">
                {t("services.viewAll")}
                <ArrowRight className="ml-2" size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("why.subtitle")}</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t("why.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("why.desc")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center"
            >
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                <ShieldCheck size={28} />
              </div>
              <h3 className="font-bold text-lg mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t("why.insured")}</h3>
              <p className="text-muted-foreground text-sm">{t("why.insured.desc")}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center"
            >
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                <Clock size={28} />
              </div>
              <h3 className="font-bold text-lg mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t("why.ontime")}</h3>
              <p className="text-muted-foreground text-sm">{t("why.ontime.desc")}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center"
            >
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="font-bold text-lg mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t("why.clean")}</h3>
              <p className="text-muted-foreground text-sm">{t("why.clean.desc")}</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-secondary">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("reviews.subtitle")}</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t("reviews.title")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ReviewCard
              name="Sarah Jenkins"
              location="Dilworth, Charlotte"
              text={language === "en" ? "David and his team were incredible. They painted our entire downstairs in two days and left the place spotless. The lines are perfect!" : "David y su equipo fueron increíbles. Pintaron toda nuestra planta baja en dos días y dejaron el lugar impecable. ¡Las líneas son perfectas!"}
              delay={0.1}
            />
            <ReviewCard
              name="Mike & Linda Ross"
              location="Matthews, NC"
              text={language === "en" ? "We hired them for exterior painting and deck staining. The house looks brand new. Very professional and friendly crew." : "Los contratamos para pintura exterior y teñido de terraza. La casa parece nueva. Un equipo muy profesional y amable."}
              delay={0.2}
            />
            <ReviewCard
              name="Elena Rodriguez"
              location="Ballantyne"
              text={language === "en" ? "Best quote we received and the quality exceeded our expectations. David helped us choose the perfect gray for our kitchen cabinets." : "El mejor presupuesto que recibimos y la calidad superó nuestras expectativas. David nos ayudó a elegir el gris perfecto para nuestros gabinetes de cocina."}
              delay={0.3}
            />
          </div>

          <p className="text-center text-muted-foreground/60 text-sm mt-8">
            {t("reviews.note")}
          </p>

          <div className="text-center mt-8">
            <Link href="/contact#contact-form">
              <Button data-testid="button-reviews-cta" className="bg-primary text-primary-foreground font-semibold px-8">
                {t("reviews.book")}
                <ArrowRight className="ml-2" size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {t("cta.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
            {t("cta.desc")}
          </p>
          <Link href="/contact#contact-form">
            <Button data-testid="button-bottom-cta" className="bg-primary text-primary-foreground font-semibold px-8 h-12 text-base">
              {t("nav.freeEstimate")}
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
