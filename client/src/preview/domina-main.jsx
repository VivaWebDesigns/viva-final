/**
 * Preview entry point — Plan Domina (/preview/domina)
 *
 * Reads client data from localStorage (by demoId) or URL params,
 * merges with a trade template, and injects the full payload into
 * window.__PREVIEW__ before React renders.
 *
 * Domina uses an object-based t (e.g. t.home.heroTitle1) so text overrides
 * go into window.__PREVIEW__.domina for the LanguageContext deep-merge.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "@domina/App.tsx";
import "@domina/index.css";
import { buildPreviewPayload } from "./tradeTemplates.js";

// --- 1. Resolve client data: localStorage first, URL params as fallback --------
function resolveClientData() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (id) {
    try {
      const saved = localStorage.getItem(`vvwd_preview_${id}`);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
  }
  return {
    name:      params.get("name")     || "",
    city:      params.get("city")     || "",
    phone:     params.get("phone")    || "",
    service:   params.get("service")  || "",
    cta:       params.get("cta")      || "",
    lang:      params.get("lang")     || "en",
    trade:     params.get("trade")    || "painting",
    logoUrl:   params.get("logoUrl")  || "",
    heroImageUrl: params.get("heroImageUrl") || "",
  };
}

const client = resolveClientData();
const lang   = client.lang === "es" ? "es" : "en";

// --- 2. Build the full payload using trade template + client overrides ---------
const payload = buildPreviewPayload({
  tradeKey:     client.trade || "painting",
  name:         client.name,
  city:         client.city,
  phone:        client.phone,
  service:      client.service,
  cta:          client.cta,
  lang,
  logoUrl:      client.logoUrl,
  heroImageUrl: client.heroImageUrl,
});

localStorage.setItem("lang", lang);

const { businessName: biz, city: c, tradeNoun, cta } = payload;

// --- 3. Build domina text overrides (merged via LanguageContext deep-merge) ---
const dominaOv = {
  en: {
    nav: { phone: payload.phone, getEstimate: cta },
    home: {
      heroTitle1: `${biz} has your `,
      heroTitle2: `${tradeNoun} needs`,
      heroTitle3: " covered.",
      heroSubtitle:   `Transforming homes across ${c} with precision and care. Quality ${tradeNoun} services that stand the test of time.`,
      readySubtitle:  `Get a free, no-obligation estimate. We serve ${c} and the surrounding area.`,
      ctaEstimate:    cta,
      expertiseTitle: `Quality ${tradeNoun[0].toUpperCase() + tradeNoun.slice(1)} Services`,
    },
    about: {
      paragraph1:  `Welcome to ${biz}, proudly serving the greater ${c} area. With over 15 years of hands-on experience, we deliver high-quality ${tradeNoun} services tailored to every client's needs.`,
      valuesText:  `At ${biz}, we believe in honest pricing, clear communication, and doing the job right the first time. We treat your home with the same care we'd give our own.`,
    },
    footer: {
      copyright: `${biz}. All rights reserved.`,
    },
  },
  es: {
    nav: { phone: payload.phone, getEstimate: cta },
    home: {
      heroTitle1: `${biz} — `,
      heroTitle2: `${tradeNoun}`,
      heroTitle3: " de confianza.",
      heroSubtitle:   `Transformando hogares en ${c} con precisión y cuidado. Servicios de ${tradeNoun} de calidad que duran en el tiempo.`,
      readySubtitle:  `Obtenga una estimación gratuita y sin compromiso. Atendemos ${c} y sus alrededores.`,
      ctaEstimate:    cta,
      expertiseTitle: `Servicios de ${tradeNoun[0].toUpperCase() + tradeNoun.slice(1)} de Calidad`,
    },
    about: {
      paragraph1:  `Bienvenido a ${biz}, al servicio del área de ${c}. Con más de 15 años de experiencia, brindamos servicios de ${tradeNoun} de alta calidad para cada cliente.`,
      valuesText:  `En ${biz}, creemos en precios honestos, comunicación clara y hacer el trabajo bien desde la primera vez.`,
    },
    footer: {
      copyright: `${biz}. Todos los derechos reservados.`,
    },
  },
};

// --- 4. Set window.__PREVIEW__ BEFORE React renders ---------------------------
window.__PREVIEW__ = {
  phone: payload.phone,
  lang,
  payload,
  domina: dominaOv[lang],
};

// --- 5. Render ----------------------------------------------------------------
createRoot(document.getElementById("root-preview-domina")).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <App />
    </Router>
  </StrictMode>
);
