import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ServiceCard } from "@/components/ServiceCard";
import { ReviewCard } from "@/components/ReviewCard";
import { Button } from "@/components/ui/button";
import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
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
import { useLanguage } from "@/i18n/LanguageContext";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const { t } = useLanguage();

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
              {t.home.heroTitle1}
              <span className="text-white/90">{t.home.heroTitle2}</span>
              {t.home.heroTitle3}
            </h1>

            <p className="text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed">
              {t.home.heroSubtitle}
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-4 pt-4">
              <Link href="/contact#contact-form">
                <Button data-testid="button-hero-cta" className="bg-primary text-primary-foreground font-semibold px-8 h-12 text-base border border-primary">
                  {t.home.ctaEstimate}
                  <ArrowRight className="ml-2" size={18} />
                </Button>
              </Link>
              <Link href="/services">
                <Button data-testid="button-hero-services" variant="outline" className="border-white/30 text-white font-semibold px-8 h-12 text-base bg-white/5 backdrop-blur-sm">
                  {t.home.ctaServices}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="pt-16 pb-24 md:py-24 bg-secondary">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t.home.expertiseLabel}</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t.home.expertiseTitle}
            </h2>
            <p className="text-muted-foreground">
              {t.home.expertiseSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ServiceCard
              title={t.home.serviceCards.interiorTitle}
              description={t.home.serviceCards.interiorDesc}
              benefits={t.home.serviceCards.interiorBenefits}
              icon={PaintBucket}
              delay={0.1}
              href="/services/interior-painting"
            />
            <ServiceCard
              title={t.home.serviceCards.exteriorTitle}
              description={t.home.serviceCards.exteriorDesc}
              benefits={t.home.serviceCards.exteriorBenefits}
              icon={HomeIcon}
              delay={0.2}
              href="/services/exterior-painting"
            />
            <ServiceCard
              title={t.home.serviceCards.cabinetsTitle}
              description={t.home.serviceCards.cabinetsDesc}
              benefits={t.home.serviceCards.cabinetsBenefits}
              icon={Layers}
              delay={0.3}
              href="/services/kitchen-cabinet-painting"
            />
            <ServiceCard
              title={t.home.serviceCards.deckTitle}
              description={t.home.serviceCards.deckDesc}
              benefits={t.home.serviceCards.deckBenefits}
              icon={Sun}
              delay={0.4}
              href="/services/deck-staining"
            />
            <ServiceCard
              title={t.home.serviceCards.fenceTitle}
              description={t.home.serviceCards.fenceDesc}
              benefits={t.home.serviceCards.fenceBenefits}
              icon={Fence}
              delay={0.5}
              href="/services/fence-staining"
            />
            <ServiceCard
              title={t.home.serviceCards.commercialTitle}
              description={t.home.serviceCards.commercialDesc}
              benefits={t.home.serviceCards.commercialBenefits}
              icon={Building2}
              delay={0.6}
              href="/services/commercial-painting"
            />
          </div>

          <div className="text-center mt-10">
            <Link href="/services">
              <Button data-testid="button-view-all-services" variant="outline" className="font-semibold px-8">
                {t.home.viewAllServices}
                <ArrowRight className="ml-2" size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t.home.whyChooseLabel}</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t.home.whyChooseTitle}
            </h2>
            <p className="text-muted-foreground">
              {t.home.whyChooseSubtitle}
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
              <h3 className="font-bold text-lg mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t.home.fullyInsured}</h3>
              <p className="text-muted-foreground text-sm">{t.home.fullyInsuredDesc}</p>
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
              <h3 className="font-bold text-lg mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t.home.onTimeGuarantee}</h3>
              <p className="text-muted-foreground text-sm">{t.home.onTimeGuaranteeDesc}</p>
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
              <h3 className="font-bold text-lg mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t.home.cleanWork}</h3>
              <p className="text-muted-foreground text-sm">{t.home.cleanWorkDesc}</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-secondary">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t.home.reviewsLabel}</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t.home.reviewsTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ReviewCard
              name={t.home.reviews.review1Name}
              location={t.home.reviews.review1Location}
              text={t.home.reviews.review1Text}
              delay={0.1}
            />
            <ReviewCard
              name={t.home.reviews.review2Name}
              location={t.home.reviews.review2Location}
              text={t.home.reviews.review2Text}
              delay={0.2}
            />
            <ReviewCard
              name={t.home.reviews.review3Name}
              location={t.home.reviews.review3Location}
              text={t.home.reviews.review3Text}
              delay={0.3}
            />
          </div>

          <p className="text-center text-muted-foreground/60 text-sm mt-8">
            {t.home.reviewsDisclaimer}
          </p>

          <div className="text-center mt-8">
            <Link href="/contact#contact-form">
              <Button data-testid="button-reviews-cta" className="bg-primary text-primary-foreground font-semibold px-8">
                {t.home.bookQuote}
                <ArrowRight className="ml-2" size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {t.home.readyTitle}
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
            {t.home.readySubtitle}
          </p>
          <Link href="/contact#contact-form">
            <Button data-testid="button-bottom-cta" className="bg-primary text-primary-foreground font-semibold px-8 h-12 text-base">
              {t.home.ctaEstimate}
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
