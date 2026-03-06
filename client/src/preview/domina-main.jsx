/**
 * Preview entry point for Plan Domina (/preview/domina)
 *
 * Data flow:
 *   1. Admin builder saves payload to localStorage under key `vvwd_preview_${id}`
 *      and generates a URL like /preview/domina?id=abc123
 *   2. On load, we read `id` from the URL and look up the payload in localStorage.
 *   3. If localStorage has no data (different device / cleared), we fall back to
 *      individual URL params (?name=...&city=...&phone=...&cta=...&lang=...).
 *   4. window.__PREVIEW__ is set with the resolved values BEFORE React renders.
 *   5. The LanguageContext in domina/i18n/LanguageContext.tsx deep-merges
 *      window.__PREVIEW__.domina into each language's translation object,
 *      so t.nav.phone, t.home.heroSubtitle, etc. are all overridden.
 *   6. Navigation.tsx reads window.__PREVIEW__.phone for tel: and WhatsApp links.
 *
 * Domina uses an object-based t (e.g. t.home.ctaEstimate) instead of
 * a key-based t("key") function, so overrides are structured as nested objects.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "@domina/App.tsx";
import "@domina/index.css";

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
const cta     = data.cta     || "Get a Free Estimate";
const lang    = data.lang    === "es" ? "es" : "en";

// --- 2. Set localStorage BEFORE React renders so Domina's LanguageProvider initialises correctly ---
localStorage.setItem("lang", lang);

// --- 3. Inject into window BEFORE React renders ---
// The domina LanguageContext deep-merges window.__PREVIEW__.domina into
// each language's translation object. Keys match the structure in i18n/en.ts.
window.__PREVIEW__ = {
  // Used directly by Navigation.tsx for tel: and WhatsApp links
  phone,

  // Nested overrides matched to domina's typed translation structure (i18n/en.ts)
  domina: {
    nav: {
      phone,
      getEstimate: cta,
    },
    home: {
      // Hero title — split into 3 parts to match Domina's rendering structure
      // Home.tsx renders: {heroTitle1}<span>{heroTitle2}</span>{heroTitle3}
      heroTitle1:
        lang === "es" ? `${name} — tenemos tus ` : `${name} has your `,
      heroTitle2:
        lang === "es" ? "necesidades de pintura" : "painting needs",
      heroTitle3: lang === "es" ? " cubiertas." : " covered.",

      // Hero subtitle — real city and service
      heroSubtitle:
        lang === "es"
          ? `Transformando hogares en ${city} con precisión y pasión. Servicios de ${service.toLowerCase()} de calidad que duran en el tiempo.`
          : `Transforming homes across ${city} with precision and passion. Quality ${service.toLowerCase()} services that stand the test of time.`,

      // Bottom CTA section
      readySubtitle:
        lang === "es"
          ? `Obtenga una estimación gratuita y sin compromiso. Atendemos ${city} y sus alrededores.`
          : `Get a free, no-obligation estimate. We serve ${city} and the surrounding area.`,

      // CTA button text in hero
      ctaEstimate: cta,
    },
    about: {
      paragraph1:
        lang === "es"
          ? `Bienvenido a ${name}, al servicio del área de ${city}. Con más de 15 años de experiencia práctica, me dedico a ofrecer soluciones personalizadas y de alta calidad para todas sus necesidades de pintura.`
          : `Welcome to ${name}, proudly serving the greater ${city} area. With over 15 years of hands-on experience, I'm dedicated to providing high-quality, personalized solutions for all your ${service.toLowerCase()} needs.`,
      valuesText:
        lang === "es"
          ? `En ${name}, creemos en precios honestos, comunicación clara y hacer el trabajo bien desde la primera vez. Tratamos su hogar con el mismo cuidado y respeto que le daríamos al nuestro.`
          : `At ${name}, we believe in honest pricing, clear communication, and doing the job right the first time. We treat your home with the same care and respect we'd give our own.`,
    },
    footer: {
      copyright:
        lang === "es"
          ? `${name}. Todos los derechos reservados.`
          : `${name}. All rights reserved.`,
    },
  },
};

// --- 4. Render the Domina demo app (no DemoBar — this is a private preview) ---
createRoot(document.getElementById("root-preview-domina")).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <App />
    </Router>
  </StrictMode>
);
