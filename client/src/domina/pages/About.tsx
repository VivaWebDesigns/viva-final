import { Navigation } from "@domina/components/Navigation";
import { Footer } from "@domina/components/Footer";
import { Button } from "@domina/components/ui/button";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Clock,
} from "lucide-react";
import aboutPhoto from "@domina/assets/images/optimized/gabriel-tovar-En1Is3KsRZw-unsplash_1771517255358.webp";
import { useLanguage } from "@domina/i18n/LanguageContext";

export default function About() {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = "About Us | Charlotte Painting Pro";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "Meet David Martinez, owner of Charlotte Painting Pro. Over 15 years of professional painting experience serving Charlotte, NC and surrounding areas.");
    }
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section className="py-12 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t.about.label}</p>
              <h1 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
                {t.about.title}
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                {t.about.paragraph1}
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                {t.about.paragraph2}
              </p>

              <div className="flex flex-wrap gap-8 mb-8">
                <div>
                  <span className="block text-3xl font-bold text-primary" style={{ fontFamily: 'var(--font-display)' }}>15+</span>
                  <span className="text-muted-foreground text-sm font-medium">{t.about.yearsExperience}</span>
                </div>
                <div>
                  <span className="block text-3xl font-bold text-primary" style={{ fontFamily: 'var(--font-display)' }}>500+</span>
                  <span className="text-muted-foreground text-sm font-medium">{t.about.happyHomes}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-8">
                <div className="flex items-center gap-3 text-foreground/70">
                  <ShieldCheck size={20} className="text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{t.about.fullyInsured}</span>
                </div>
                <div className="flex items-center gap-3 text-foreground/70">
                  <Clock size={20} className="text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{t.about.onTimeGuarantee}</span>
                </div>
                <div className="flex items-center gap-3 text-foreground/70">
                  <CheckCircle2 size={20} className="text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{t.about.cleanWork}</span>
                </div>
              </div>

              <Link href="/contact#contact-form">
                <Button data-testid="button-about-cta" className="bg-primary text-primary-foreground font-semibold px-8 h-12">
                  {t.about.ctaEstimate}
                  <ArrowRight className="ml-2" size={18} />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="rounded-md overflow-hidden shadow-lg">
                <img
                  src={aboutPhoto}
                  alt={t.about.imgAlt}
                  className="w-full h-[300px] md:h-[500px] object-cover object-[60%_center] md:object-[center_20%]"
                  data-testid="img-about"
                  loading="lazy"
                  width={1200}
                  height={800}
                />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white border border-border p-4 rounded-md hidden md:flex items-center gap-3 shadow-md">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <span className="block text-foreground font-semibold text-sm">{t.about.satisfaction}</span>
                  <span className="text-muted-foreground text-xs">{t.about.satisfactionDesc}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {t.about.valuesTitle}
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            {t.about.valuesText}
          </p>
          <Link href="/contact#contact-form">
            <Button data-testid="button-values-cta" className="bg-primary text-primary-foreground font-semibold px-8">
              {t.about.contactUs}
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
