import { Navigation } from "@domina/components/Navigation";
import { Footer } from "@domina/components/Footer";
import { Button } from "@domina/components/ui/button";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useLanguage } from "@domina/i18n/LanguageContext";
import {
  PaintBucket,
  Home as HomeIcon,
  Layers,
  Sun,
  Fence,
  Building2,
  ArrowRight,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Droplets,
  ShowerHead,
  Zap,
  AlertTriangle,
  HardHat,
  Cloud,
  Shield,
  CircuitBoard,
  Lightbulb,
  Truck,
  Leaf,
  Flower2,
  TreePine,
  Thermometer,
  Fan,
  Wind,
  Hammer,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  PaintBucket, Wrench, Droplets, ShowerHead, Zap, AlertTriangle, HardHat, Cloud,
  Shield, CircuitBoard, Lightbulb, Truck, Leaf, Flower2, TreePine, Thermometer,
  Fan, Wind, Hammer, Building2, Sun, Fence, Layers, Home: HomeIcon,
};
import galleryKitchen1 from "@domina/assets/images/optimized/AdobeStock_615565130_1771521960347.webp";
import galleryLiving1 from "@domina/assets/images/optimized/AdobeStock_470165599_1771521960348.webp";
import galleryKitchen2 from "@domina/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_19_17_PM_1771521960349.webp";
import galleryDoor from "@domina/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_18_07_PM_1771521960349.webp";
import galleryExterior from "@domina/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_15_32_PM_1771521960350.webp";
import galleryPorch from "@domina/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_02_18_31_PM_1771528760345.webp";
import galleryFence from "@domina/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_02_23_09_PM_1771529000104.webp";
import serviceInterior from "@domina/assets/images/optimized/image_1771599128923.webp";
import serviceExterior from "@domina/assets/images/optimized/image_1771599160031.webp";
import serviceCabinets from "@domina/assets/images/optimized/image_1771599217947.webp";
import serviceDeck from "@domina/assets/images/optimized/image_1771599249175.webp";
import serviceFence from "@domina/assets/images/optimized/image_1771599272316.webp";
import serviceCommercial from "@domina/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_51_AM_1771600212443.webp";

interface ServiceBlockProps {
  title: string;
  description: string;
  highlights: string[];
  process?: string;
  icon: React.ElementType;
  delay: number;
  image?: string;
  imageAlt?: string;
  anchorId?: string;
  href: string;
}

function ServiceBlock({ title, description, highlights, process, icon: Icon, delay, image, imageAlt, anchorId, href }: ServiceBlockProps) {
  const { t } = useLanguage();
  return (
    <motion.div
      id={anchorId}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="rounded-md border border-border bg-card overflow-hidden flex flex-col scroll-mt-24 group hover:border-primary/50 transition-colors"
      data-testid={`block-service-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <Link href={href} className="cursor-pointer flex flex-col flex-1">
        {image && (
          <div className="w-full h-[220px] overflow-hidden">
            <img src={image} alt={imageAlt || title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" width={1200} height={800} />
          </div>
        )}
        <div className="p-8 flex flex-col flex-1">
          <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Icon size={28} />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">{description}</p>
          <ul className="space-y-3 mb-6">
            {highlights.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-foreground/70">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
          {process && (
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">{process}</p>
          )}
          <div className="mt-auto flex items-center text-primary font-semibold text-sm">
            {t.services.learnMore} <ArrowRight className="ml-2 transition-transform group-hover:translate-x-1" size={16} />
          </div>
        </div>
      </Link>
      <div className="px-8 pb-8 pt-0">
        <Link href="/contact#contact-form">
          <Button data-testid={`button-estimate-${title.toLowerCase().replace(/\s+/g, '-')}`} className="w-full bg-secondary hover:bg-primary hover:text-primary-foreground text-primary font-semibold border border-primary/20 transition-all">
            {t.services.getEstimate}
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

export default function Services() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { t, language } = useLanguage();

  const payload = (window as any).__PREVIEW__?.payload || null;
  const previewServices: any[] | null = payload
    ? (language === "es" ? payload.servicesES : payload.servicesEN) || null
    : null;
  const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const previewGalleryImages: { url: string; alt: string }[] | null = payload?.galleryImages || null;

  useEffect(() => {
    if (payload) {
      const biz = payload.businessName || "Professional Contractor";
      document.title = `Our Services | ${biz}`;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", `Professional ${payload.tradeName || "contractor"} services in ${payload.city || "your area"}. Get a free estimate.`);
    } else {
      document.title = "Our Services | Charlotte Painting Pro";
      const meta = document.querySelector('meta[name="description"]');
      if (meta) {
        meta.setAttribute("content", "Interior painting, exterior painting, kitchen cabinet painting, and deck & fence staining services in Charlotte, NC. Get a free estimate from Charlotte Painting Pro.");
      }
    }
    function scrollToHash() {
      const hash = window.location.hash;
      if (hash && !hash.includes("/")) {
        setTimeout(() => {
          try {
            const el = document.querySelector(hash);
            if (el) el.scrollIntoView({ behavior: "smooth" });
          } catch (_) {}
        }, 150);
      } else {
        window.scrollTo(0, 0);
      }
    }
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  const galleryImages = previewGalleryImages
    ? previewGalleryImages.map(g => ({ src: g.url, alt: g.alt }))
    : [
    { src: galleryKitchen1, alt: "Beautiful kitchen with painted blue island" },
    { src: galleryExterior, alt: "Beautifully painted home exterior" },
    { src: galleryLiving1, alt: "Elegant living room interior" },
    { src: galleryDoor, alt: "Beautiful blue front door" },
    { src: galleryKitchen2, alt: "Kitchen with painted cabinets" },
    { src: galleryPorch, alt: "Beautifully painted covered porch" },
    { src: galleryFence, alt: "Stained wooden fence" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section className="pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
          <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t.services.label}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {t.services.title}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t.services.subtitle}
          </p>
        </div>
      </section>

      <section className="pb-24">
        <div className="container mx-auto px-4 md:px-6">
          {previewServices ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {previewServices.map((svc: any, i: number) => {
                const Icon = ICON_MAP[svc.iconName] || Building2;
                return (
                  <motion.div
                    key={svc.title + i}
                    id={slugify(svc.title)}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className="rounded-md border border-border bg-card overflow-hidden flex flex-col scroll-mt-24"
                    data-testid={`block-service-preview-${i}`}
                  >
                    <div className="p-8 flex flex-col flex-1">
                      <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-6">
                        <Icon size={28} />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>{svc.title}</h2>
                      <p className="text-muted-foreground leading-relaxed mb-6">{svc.description}</p>
                      <ul className="space-y-3 mb-6">
                        {(svc.benefits || []).map((b: string, j: number) => (
                          <li key={j} className="flex items-start gap-3 text-sm text-foreground/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                            {b}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto">
                        <Link href="/contact#contact-form">
                          <Button data-testid={`button-estimate-preview-${i}`} className="bg-primary text-primary-foreground font-semibold">
                            {t.services.getEstimate}
                            <ArrowRight className="ml-2" size={16} />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ServiceBlock
              anchorId="interior-painting"
              href="/services/interior-painting"
              image={serviceInterior}
              imageAlt={t.services.interior.imageAlt}
              title={t.services.interior.title}
              description={t.services.interior.description}
              highlights={t.services.interior.highlights}
              process={t.services.interior.process}
              icon={PaintBucket}
              delay={0.1}
            />
            <ServiceBlock
              anchorId="exterior-painting"
              href="/services/exterior-painting"
              image={serviceExterior}
              imageAlt={t.services.exterior.imageAlt}
              title={t.services.exterior.title}
              description={t.services.exterior.description}
              highlights={t.services.exterior.highlights}
              process={t.services.exterior.process}
              icon={HomeIcon}
              delay={0.2}
            />
            <ServiceBlock
              anchorId="kitchen-cabinet-painting"
              href="/services/kitchen-cabinet-painting"
              image={serviceCabinets}
              imageAlt={t.services.cabinets.imageAlt}
              title={t.services.cabinets.title}
              description={t.services.cabinets.description}
              highlights={t.services.cabinets.highlights}
              process={t.services.cabinets.process}
              icon={Layers}
              delay={0.3}
            />
            <ServiceBlock
              anchorId="deck-staining"
              href="/services/deck-staining"
              image={serviceDeck}
              imageAlt={t.services.deck.imageAlt}
              title={t.services.deck.title}
              description={t.services.deck.description}
              highlights={t.services.deck.highlights}
              process={t.services.deck.process}
              icon={Sun}
              delay={0.4}
            />
            <ServiceBlock
              anchorId="fence-staining"
              href="/services/fence-staining"
              image={serviceFence}
              imageAlt={t.services.fence.imageAlt}
              title={t.services.fence.title}
              description={t.services.fence.description}
              highlights={t.services.fence.highlights}
              process={t.services.fence.process}
              icon={Fence}
              delay={0.5}
            />
            <ServiceBlock
              anchorId="commercial-painting"
              href="/services/commercial-painting"
              image={serviceCommercial}
              imageAlt={t.services.commercial.imageAlt}
              title={t.services.commercial.title}
              description={t.services.commercial.description}
              highlights={t.services.commercial.highlights}
              process={t.services.commercial.process}
              icon={Building2}
              delay={0.5}
            />
          </div>
          )}
        </div>
      </section>

      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t.services.ourWorkLabel}</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t.services.recentProjects}
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {galleryImages.map((img, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-md overflow-hidden shadow-md cursor-pointer"
                onClick={() => setLightboxIndex(i)}
              >
                <img src={img.src} alt={img.alt} className="w-full h-[160px] md:h-[200px] object-cover" loading="lazy" width={1200} height={800} data-testid={`img-gallery-${i}`} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <MapPin size={20} className="text-primary" />
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{t.services.serviceAreaTitle}</h2>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            {t.services.serviceAreaText}
          </p>
          <Link href="/contact#contact-form">
            <Button data-testid="button-service-area-cta" className="bg-primary text-primary-foreground font-semibold px-8">
              {t.services.getEstimate}
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxIndex(null)}
          data-testid="lightbox-overlay"
        >
          <button
            className="absolute top-4 right-4 text-white p-2 z-10"
            onClick={() => setLightboxIndex(null)}
            data-testid="button-lightbox-close"
          >
            <X size={32} />
          </button>
          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 z-10 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              data-testid="button-lightbox-prev"
            >
              <ChevronLeft size={32} />
            </button>
          )}
          {lightboxIndex < galleryImages.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 z-10 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              data-testid="button-lightbox-next"
            >
              <ChevronRight size={32} />
            </button>
          )}
          <img
            src={galleryImages[lightboxIndex].src}
            alt={galleryImages[lightboxIndex].alt}
            className="max-w-full max-h-[90vh] object-contain rounded-md"
            width={1200}
            height={800}
            onClick={(e) => e.stopPropagation()}
            data-testid="img-lightbox"
          />
        </div>
      )}
    </div>
  );
}
