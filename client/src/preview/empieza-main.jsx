/**
 * Preview entry point for Plan Empieza (/preview/empieza)
 *
 * Data flow:
 *   1. Admin builder saves payload to localStorage under key `vvwd_preview_${id}`
 *      and generates a URL like /preview/empieza?id=abc123
 *   2. On load, we read `id` from the URL and look up the payload in localStorage.
 *   3. If localStorage has no data (different device / cleared), we fall back to
 *      individual URL params (?name=...&city=...&phone=...&cta=...&lang=...).
 *   4. window.__PREVIEW__ is set with the resolved values BEFORE React renders.
 *   5. The LanguageProvider in hooks/use-language.tsx checks window.__PREVIEW__.tOverrides
 *      on every t() call and returns the override value if present.
 *   6. Navigation.tsx reads window.__PREVIEW__.phone for tel: and WhatsApp links.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "@empieza/App.tsx";
import "@empieza/index.css";

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

// --- 2. Set localStorage language so LanguageProvider initialises correctly ---
// (empieza reads window.__PREVIEW__.lang instead)

// --- 3. Inject into window BEFORE React renders ---
window.__PREVIEW__ = {
  phone,
  lang,
  tOverrides: {
    // Hero title — make the business name the centrepiece.
    // The empieza Home.tsx splits on "painting needs" / "necesidades de pintura"
    // to apply accent-colour styling, so the string must include that phrase.
    // EN: "Name has your [painting needs] covered."
    // ES: "Name tiene tus [necesidades de pintura]" (no trailing text — clean render)
    heroTitle:
      lang === "es"
        ? `${name} tiene tus `
        : `${name} has your painting needs covered.`,

    // Hero subtitle — use the real city and service
    heroSubtitle:
      lang === "es"
        ? `Transformando hogares en ${city} con precisión y pasión. Servicios de ${service.toLowerCase()} de calidad que duran en el tiempo.`
        : `Transforming homes across ${city} with precision and passion. Quality ${service.toLowerCase()} services that stand the test of time.`,

    // CTA button text
    getFreeEstimate: cta,

    // About section — business name + city
    aboutP1:
      lang === "es"
        ? `Bienvenido a ${name}, al servicio del área de ${city}. Con más de 15 años de experiencia práctica, me dedico a ofrecer soluciones personalizadas y de alta calidad para todas sus necesidades de pintura.`
        : `Welcome to ${name}, proudly serving the greater ${city} area. With over 15 years of hands-on experience, I'm dedicated to providing high-quality, personalized solutions for all your ${service.toLowerCase()} needs.`,

    // Why us section — business name
    whyUsP1:
      lang === "es"
        ? `En ${name}, cada proyecto comienza con una conversación. Escuchamos su visión y entregamos resultados que dan vida a su espacio, a tiempo y sin sorpresas.`
        : `At ${name}, every project starts with a conversation. We listen to your vision and deliver results that bring your space to life — on time and with no surprises.`,

    // Contact headline
    letUsHelp:
      lang === "es"
        ? `¡Contáctenos hoy y reciba una cotización gratis en ${city}!`
        : `Contact ${name} today for a free estimate in ${city}!`,
  },
};

// --- 4. Render the Empieza demo app (no DemoBar — this is a private preview) ---
createRoot(document.getElementById("root-preview-empieza")).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <App />
    </Router>
  </StrictMode>
);
