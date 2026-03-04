import { useEffect, useState, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useRoute } from "wouter";
import { ArrowRight, X, ChevronLeft, ChevronRight, ChevronRight as Chevron, Phone } from "lucide-react";
import { getProjectBySlug } from "@/data/portfolioProjects";
import { useLanguage } from "@/i18n/LanguageContext";

export default function ProjectDetail() {
  const { t } = useLanguage();
  const [, params] = useRoute("/portfolio/:slug");
  const slug = params?.slug || "";
  const project = getProjectBySlug(slug);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (project) {
      const title = `${project.title} | Portfolio | Charlotte Painting Pro`;
      const desc = project.shortDescription;
      document.title = title;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", desc);

      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement("meta");
        ogTitle.setAttribute("property", "og:title");
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute("content", title);

      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement("meta");
        ogDesc.setAttribute("property", "og:description");
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute("content", desc);
    }
    window.scrollTo(0, 0);
  }, [project]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!project || lightboxIndex === null) return;
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft" && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
      if (e.key === "ArrowRight" && lightboxIndex < project.images.length - 1) setLightboxIndex(lightboxIndex + 1);
    },
    [lightboxIndex, project]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (lightboxIndex !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxIndex]);

  if (!project) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold mb-4" style={{ fontFamily: "var(--font-display)" }}>{t.projectDetail.notFoundTitle}</h1>
          <p className="text-muted-foreground mb-8">{t.projectDetail.notFoundText}</p>
          <Link href="/portfolio">
            <Button data-testid="button-back-portfolio">{t.projectDetail.backToPortfolio}</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const completedDate = new Date(project.date + "-01").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section className="pt-8 pb-4">
        <div className="container mx-auto px-4 md:px-6">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6" aria-label="Breadcrumb" data-testid="breadcrumb">
            <Link href="/" className="hover:text-foreground transition-colors">{t.projectDetail.home}</Link>
            <Chevron size={14} />
            <Link href="/portfolio" className="hover:text-foreground transition-colors">Portfolio</Link>
            <Chevron size={14} />
            <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-none">{project.title.split(" — ")[0]}</span>
          </nav>

          <div className="max-w-3xl">
            <h1
              className="text-3xl md:text-4xl font-bold mb-2"
              style={{ fontFamily: "var(--font-display)" }}
              data-testid="text-project-title"
            >
              {(() => {
                const name = project.title.split(" — ")[0];
                return t.portfolio.projectTitles[name] || name;
              })()}
            </h1>
            <p className="text-muted-foreground text-lg mb-4" data-testid="text-project-location">
              {project.location} &middot; Completed {completedDate}
            </p>

            <div className="flex flex-wrap gap-2 mb-5">
              {project.services.map((service) => (
                <span
                  key={service}
                  className="inline-block text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full"
                >
                  {t.portfolio.filters[service] || service}
                </span>
              ))}
            </div>

            <p className="text-foreground/80 text-base leading-relaxed mb-2" data-testid="text-project-description">
              {project.shortDescription}
            </p>

            {project.paintColorsUsed && project.paintColorsUsed.length > 0 && (
              <p className="text-muted-foreground text-sm">
                <span className="font-medium">{t.projectDetail.colorsUsed}</span> {project.paintColorsUsed.join(", ")}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {project.images.map((image, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border bg-muted cursor-pointer group"
                onClick={() => setLightboxIndex(i)}
                data-testid={`card-project-image-${i}`}
              >
                {!loadedImages.has(i) && (
                  <div className="absolute inset-0 bg-muted animate-pulse" />
                )}
                <img
                  src={image.thumbSrc}
                  alt={image.alt}
                  width={600}
                  height={400}
                  loading={i < 4 ? "eager" : "lazy"}
                  onLoad={() => setLoadedImages((prev) => new Set(prev).add(i))}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-[11px] font-medium">{image.serviceTag}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-2xl">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t.projectDetail.ctaTitle}
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            {t.projectDetail.ctaSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact#contact-form">
              <Button
                data-testid="button-project-cta"
                className="bg-primary text-primary-foreground font-semibold text-base"
              >
                {t.projectDetail.requestEstimate}
                <ArrowRight className="ml-2" size={18} />
              </Button>
            </Link>
            <a href="tel:7045550123">
              <Button
                variant="outline"
                data-testid="button-project-call"
                className="font-semibold text-base"
              >
                <Phone className="mr-2" size={16} />
                {t.projectDetail.callNow}
              </Button>
            </a>
          </div>
        </div>
      </section>

      <Footer />

      <AnimatePresence>
        {lightboxIndex !== null && project.images[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxIndex(null)}
            data-testid="lightbox-overlay"
          >
            <button
              className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10 transition-colors"
              onClick={() => setLightboxIndex(null)}
              aria-label="Close lightbox"
              data-testid="button-lightbox-close"
            >
              <X size={32} />
            </button>

            {lightboxIndex > 0 && (
              <button
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 z-10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(lightboxIndex - 1);
                }}
                aria-label="Previous image"
                data-testid="button-lightbox-prev"
              >
                <ChevronLeft size={28} />
              </button>
            )}

            {lightboxIndex < project.images.length - 1 && (
              <button
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 z-10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(lightboxIndex + 1);
                }}
                aria-label="Next image"
                data-testid="button-lightbox-next"
              >
                <ChevronRight size={28} />
              </button>
            )}

            <div
              className="max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={project.images[lightboxIndex].src}
                alt={project.images[lightboxIndex].alt}
                className="w-full max-h-[80vh] object-contain rounded-md"
                data-testid="img-lightbox"
              />
              <div className="text-center mt-3">
                <p className="text-white font-medium text-sm">
                  {project.images[lightboxIndex].alt}
                </p>
                <p className="text-white/50 text-xs mt-1">
                  {lightboxIndex + 1} {t.projectDetail.of} {project.images.length} &middot; {project.images[lightboxIndex].serviceTag}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
