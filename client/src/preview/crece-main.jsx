/**
 * Preview entry point for Plan Crece (/preview/crece)
 *
 * Data flow:
 *   1. Admin builder saves payload to localStorage under key `vvwd_preview_${id}`
 *      and generates a URL like /preview/crece?id=abc123
 *   2. On load, we read `id` from the URL and look up the payload in localStorage.
 *   3. If localStorage has no data (different device / cleared), we fall back to
 *      individual URL params (?name=...&city=...&phone=...&cta=...&lang=...).
 *   4. window.__PREVIEW__ is set with the resolved values BEFORE React renders.
 *   5. The LanguageProvider in hooks/use-language.tsx checks window.__PREVIEW__.tOverrides
 *      on every t("dot.key") call and returns the override value if present.
 *   6. Navigation.tsx reads window.__PREVIEW__.phone for tel: and WhatsApp links.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "@crece/App.tsx";
import "@crece/index.css";

// --- 1. Resolve preview data: localStorage first, URL params as fallback ---
function resolvePreviewData() {
  const params = new URLSearchParams(window.location.search);

  // Try localStorage lookup by demoId
  const id = params.get("id");
  if (id) {
    try {
      const saved = localStorage.getItem(`vvwd_preview_${id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          name:    parsed.name    || "",
          city:    parsed.city    || "",
          phone:   parsed.phone   || "",
          service: parsed.service || "",
          cta:     parsed.cta     || "",
          lang:    parsed.lang    || "en",
        };
      }
    } catch (_) {}
  }

  // Fallback: read individual URL params (cross-device sharing)
  return {
    name:    params.get("name")    || "",
    city:    params.get("city")    || "",
    phone:   params.get("phone")   || "",
    service: params.get("service") || "",
    cta:     params.get("cta")     || "",
    lang:    params.get("lang")    || "en",
  };
}

const data = resolvePreviewData();

// Apply defaults only for truly blank fields
const name    = data.name    || "Charlotte Painting Pro";
const city    = data.city    || "Charlotte";
const phone   = data.phone   || "(704) 555-0123";
const service = data.service || "Painting";
const cta     = data.cta     || "Get Your Free Estimate";
const lang    = data.lang    === "es" ? "es" : "en";

// --- 2. Set localStorage BEFORE React renders so Crece's LanguageProvider initialises correctly ---
localStorage.setItem("language", lang);

// --- 3. Inject into window BEFORE React renders ---
window.__PREVIEW__ = {
  phone,
  tOverrides: {
    // Hero title — business name as the headline
    "hero.title":
      lang === "es"
        ? `${name} tiene tus necesidades de pintura cubiertas.`
        : `${name} has your painting needs covered.`,

    // Hero subtitle — real city and service
    "hero.subtitle":
      lang === "es"
        ? `Transformando hogares en ${city} con precisión y pasión. Servicios de ${service.toLowerCase()} de calidad que duran en el tiempo.`
        : `Transforming homes across ${city} with precision and passion. Quality ${service.toLowerCase()} services that stand the test of time.`,

    // CTA button text
    "nav.freeEstimate": cta,
    "reviews.book": cta,

    // About page — business name + city
    "about.description1":
      lang === "es"
        ? `Bienvenido a ${name}, al servicio del área de ${city}. Con más de 15 años de experiencia práctica, me dedico a ofrecer soluciones personalizadas y de alta calidad para todas sus necesidades de pintura.`
        : `Welcome to ${name}, proudly serving the greater ${city} area. With over 15 years of hands-on experience, I'm dedicated to providing high-quality, personalized solutions for all your ${service.toLowerCase()} needs.`,

    // Why us values — business name
    "about.values.desc":
      lang === "es"
        ? `En ${name}, creemos en precios honestos, comunicación clara y hacer el trabajo bien desde la primera vez.`
        : `At ${name}, we believe in honest pricing, clear communication, and doing the job right the first time.`,

    // CTA section — city
    "cta.title":
      lang === "es"
        ? `¿Listo para transformar su hogar en ${city}?`
        : `Ready to transform your home in ${city}?`,
    "cta.desc":
      lang === "es"
        ? `Obtenga una estimación gratuita y sin compromiso. Atendemos ${city} y sus alrededores.`
        : `Get a free, no-obligation estimate. We serve ${city} and the surrounding area.`,

    // Footer — city and business name
    "footer.desc":
      lang === "es"
        ? `Los expertos en pintura de ${city}. Traemos color y vida a su hogar con servicios profesionales de pintura.`
        : `${city}'s trusted ${service.toLowerCase()} experts. We bring color and life to your home with professional services.`,
  },
};

// --- 4. Render the Crece demo app (no DemoBar — this is a private preview) ---
createRoot(document.getElementById("root-preview-crece")).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <App />
    </Router>
  </StrictMode>
);
