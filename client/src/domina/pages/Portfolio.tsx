import { useEffect, useMemo } from "react";
import { Navigation } from "@domina/components/Navigation";
import { Footer } from "@domina/components/Footer";
import { Button } from "@domina/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Camera, Phone } from "lucide-react";
import {
  portfolioProjects,
} from "@domina/data/portfolioProjects";
import { useLanguage } from "@domina/i18n/LanguageContext";

export default function Portfolio() {
  const { t } = useLanguage();

  const payload = (window as any).__PREVIEW__?.payload || null;
  const previewPortfolio: any[] | null = payload?.portfolio || null;

  useEffect(() => {
    if (payload) {
      const biz = payload.businessName || "Your Business";
      document.title = `Portfolio | ${biz}`;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", `Browse completed ${payload.tradeName || "contractor"} projects by ${biz} in ${payload.city || "your area"}.`);
    } else {
      document.title = "Portfolio | Charlotte Painting Pro";
      const desc = "See real interior and exterior painting projects, deck staining, and fence staining completed across Charlotte, NC and surrounding areas.";
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", desc);

      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement("meta");
        ogTitle.setAttribute("property", "og:title");
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute("content", "Portfolio | Charlotte Painting Pro");

      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement("meta");
        ogDesc.setAttribute("property", "og:description");
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute("content", desc);
    }
    window.scrollTo(0, 0);
  }, []);

  const filtered = useMemo(() => {
    if (previewPortfolio) return previewPortfolio;
    return [...portfolioProjects].sort((a, b) => b.date.localeCompare(a.date));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section className="pt-16 pb-8 md:pt-24 md:pb-10">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: "var(--font-display)" }}
            data-testid="text-portfolio-heading"
          >
            {t.portfolio.title}
          </h1>
          <p className="text-muted-foreground text-lg mb-2" data-testid="text-portfolio-subtitle">
            {t.portfolio.subtitle}
          </p>
          <p className="text-muted-foreground/70 text-sm">
            {t.portfolio.clickHint}
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="container mx-auto px-4 md:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key="portfolio-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filtered.map((project: any, i) => {
                const imgSrc = previewPortfolio ? project.imageUrl : project.coverThumb;
                const imgAlt = previewPortfolio ? project.imageAlt : project.coverAlt;
                return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                >
                  {previewPortfolio ? (
                    <div
                      className="rounded-lg overflow-hidden border border-border bg-card shadow-sm h-full flex flex-col"
                      data-testid={`card-portfolio-preview-${i}`}
                    >
                      <div className="overflow-hidden relative aspect-[4/3]">
                        <img src={imgSrc} alt={imgAlt} width={600} height={400} loading={i < 6 ? "eager" : "lazy"} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-foreground font-semibold text-base leading-snug mb-2" style={{ fontFamily: "var(--font-display)" }}>
                          {project.title}
                        </h3>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {(project.services || []).map((service: string) => (
                            <span key={service} className="inline-block text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              {service}
                            </span>
                          ))}
                        </div>
                        {project.description && <p className="text-muted-foreground text-sm mt-auto">{project.description}</p>}
                      </div>
                    </div>
                  ) : (
                    <Link href={`/portfolio/${project.slug}`}>
                      <div
                        className="rounded-lg overflow-hidden border border-border bg-card shadow-sm cursor-pointer group h-full flex flex-col"
                        data-testid={`card-portfolio-${project.slug}`}
                      >
                        <div className="overflow-hidden relative aspect-[4/3]">
                          <img src={imgSrc} alt={imgAlt} width={600} height={400} loading={i < 6 ? "eager" : "lazy"} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        </div>
                        <div className="p-4 flex flex-col flex-1">
                          <h3 className="text-foreground font-semibold text-base leading-snug mb-2" style={{ fontFamily: "var(--font-display)" }}>
                            {(() => {
                              const [name, location] = project.title.split(" — ");
                              const translatedName = t.portfolio.projectTitles[name] || name;
                              return location ? `${translatedName} — ${location}` : translatedName;
                            })()}
                          </h3>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {project.services.map((service: string) => (
                              <span key={service} className="inline-block text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {t.portfolio.filters[service] || service}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground text-xs mt-auto">
                            <Camera size={13} />
                            <span>{project.images.length} {t.portfolio.photos}</span>
                            <span className="text-border">|</span>
                            <span>{t.portfolio.completed} {new Date(project.date + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <span className="text-primary text-sm font-medium inline-flex items-center gap-1" data-testid={`link-view-project-${project.slug}`}>
                              {t.portfolio.viewProject} <ArrowRight size={14} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-16 text-lg" data-testid="text-portfolio-empty">
              {t.portfolio.noProjects}
            </p>
          )}
        </div>
      </section>

      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-2xl">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t.portfolio.ctaTitle}
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            {t.portfolio.ctaSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact#contact-form">
              <Button
                data-testid="button-portfolio-cta"
                className="bg-primary text-primary-foreground font-semibold text-base"
              >
                {t.portfolio.requestEstimate}
                <ArrowRight className="ml-2" size={18} />
              </Button>
            </Link>
            <a href="tel:7045550123">
              <Button
                variant="outline"
                data-testid="button-portfolio-call"
                className="font-semibold text-base"
              >
                <Phone className="mr-2" size={16} />
                {t.portfolio.callNow}
              </Button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
