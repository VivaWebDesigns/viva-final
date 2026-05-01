import { useEffect, useRef } from "react";
import { Navigation } from "@domina/components/Navigation";
import { Footer } from "@domina/components/Footer";
import { Button } from "@domina/components/ui/button";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle } from "lucide-react";
import serviceExteriorParallax from "@domina/assets/images/parallax/exterior.webp";
import { useLanguage } from "@domina/i18n/LanguageContext";

export default function ExteriorPainting() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  useEffect(() => {
    document.title = "Exterior Painting Charlotte, NC | Charlotte Painting Pro";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "Professional exterior painting services in Charlotte, NC. Restore curb appeal and protect your home. Free estimates from Charlotte Painting Pro.");
    }
    
    const ogTags = [
      { property: "og:title", content: "Exterior Painting Charlotte, NC | Charlotte Painting Pro" },
      { property: "og:description", content: "Professional exterior painting services in Charlotte, NC. Restore curb appeal and protect your home. Free estimates from Charlotte Painting Pro." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://charlottepaintingpro.com/services/exterior-painting" },
    ];
    ogTags.forEach(({ property, content }) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    });
    
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => { if (window.__PREVIEW__) setLocation("/services"); }, [setLocation]);

  if (window.__PREVIEW__) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section ref={containerRef} className="relative h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden" data-testid="hero-exterior-painting">
        <motion.div 
          style={{ y }}
          className="absolute inset-0 z-0"
        >
          <img 
            src={serviceExteriorParallax} 
            alt="Exterior Painting Charlotte" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30" />
        </motion.div>

        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.5)_0%,_rgba(0,0,0,0)_70%)] pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white drop-shadow-lg" style={{ fontFamily: 'var(--font-display)' }}>
              {t.exteriorPage.heroTitle}
            </h1>
            <p className="text-xl md:text-2xl text-white mb-10 max-w-3xl mx-auto drop-shadow-md font-medium opacity-90">
              {t.exteriorPage.heroSubtitle}
            </p>
            <Link href="/contact">
              <Button data-testid="button-hero-cta" className="bg-[#3089a8] hover:bg-[#256d86] text-white font-bold px-10 py-4 text-lg rounded-md transition-all flex items-center gap-2 mx-auto">
                {t.exteriorPage.scheduleFreeEstimate}
                <ArrowRight size={22} className="ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>{t.exteriorPage.whatIsTitle}</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            {t.exteriorPage.whatIsP1}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {t.exteriorPage.whatIsP2}
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-secondary">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>{t.exteriorPage.whyMattersTitle}</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            {t.exteriorPage.whyMattersP1}
          </p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            {t.exteriorPage.whyMattersP2}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {t.exteriorPage.whyMattersP3}
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <h2 className="text-3xl font-bold mb-12 text-center" style={{ fontFamily: 'var(--font-display)' }}>{t.exteriorPage.processTitle}</h2>

          {(() => {
            const steps = [
              { title: t.exteriorPage.step1Title, text: t.exteriorPage.step1Text },
              { title: t.exteriorPage.step2Title, text: t.exteriorPage.step2Text },
              { title: t.exteriorPage.step3Title, text: t.exteriorPage.step3Text },
              { title: t.exteriorPage.step4Title, text: t.exteriorPage.step4Text },
            ];
            return (
              <>
                <ol className="hidden md:grid md:grid-cols-4 md:gap-6 list-none p-0" aria-label="Our painting process steps">
                  {steps.map((step, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.15 }}
                      className="relative flex flex-col items-center text-center px-2"
                      data-testid={`stepper-step-${i + 1}`}
                    >
                      {i < steps.length - 1 && (
                        <div className="absolute top-5 left-[calc(50%+24px)] right-[calc(-50%+24px)] h-0.5 bg-primary/25" aria-hidden="true" />
                      )}
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm relative z-10 mb-4 flex-shrink-0" aria-label={`Step ${i + 1}`}>
                        {i + 1}
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mb-2 leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
                        {step.title.replace(/^Step \d+:\s*/i, "")}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.text}</p>
                    </motion.li>
                  ))}
                </ol>

                <ol className="md:hidden relative pl-12 list-none p-0 space-y-8" aria-label="Our painting process steps">
                  <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-primary/25" aria-hidden="true" />
                  {steps.map((step, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -15 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="relative"
                      data-testid={`stepper-step-mobile-${i + 1}`}
                    >
                      <div className="absolute -left-12 top-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm z-10" aria-hidden="true">
                        {i + 1}
                      </div>
                      <h3 className="text-base font-semibold text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                        {step.title.replace(/^Step \d+:\s*/i, "")}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.text}</p>
                    </motion.li>
                  ))}
                </ol>
              </>
            );
          })()}
        </div>
      </section>

      <section className="py-16 md:py-20 bg-secondary">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>{t.exteriorPage.typesTitle}</h2>
          <div className="space-y-4">
            {t.exteriorPage.types.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-start gap-3">
                <CheckCircle size={20} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>{t.exteriorPage.whyChooseTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {t.exteriorPage.whyChooseItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <span className="text-foreground/80 text-sm">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground leading-relaxed mt-6">
            {t.exteriorPage.whyChooseText}
          </p>
        </div>
      </section>

      <section className="py-12 bg-secondary">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <p className="text-muted-foreground leading-relaxed">
            {t.exteriorPage.serviceAreaText}
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <h2 className="text-3xl font-bold mb-8" style={{ fontFamily: 'var(--font-display)' }}>{t.exteriorPage.faqTitle}</h2>
          <div className="space-y-6">
            {t.exteriorPage.faqs.map((faq, i) => (
              <div key={i} className="border-b border-border pb-5">
                <h3 className="font-semibold text-foreground mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto px-4 md:px-6 max-w-2xl">
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>{t.exteriorPage.ctaTitle}</h2>
          <p className="text-primary-foreground/80 mb-8">
            {t.exteriorPage.ctaText}
          </p>
          <Link href="/contact">
            <Button data-testid="button-final-cta" className="bg-white text-primary font-semibold px-8 py-3 text-base hover:bg-white/90">
              {t.exteriorPage.scheduleEstimate}
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </Link>
          <p className="text-primary-foreground/60 text-sm mt-6">
            <Link href="/portfolio?filter=exterior" className="underline hover:text-primary-foreground/80">{t.exteriorPage.viewPortfolio} &rarr;</Link>
            {" · "}
            <Link href="/services" className="underline hover:text-primary-foreground/80">{t.exteriorPage.viewAllServices}</Link>
            {" · "}
            <Link href="/services/interior-painting" className="underline hover:text-primary-foreground/80">{t.exteriorPage.interiorPainting}</Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
