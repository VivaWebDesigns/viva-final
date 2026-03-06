/**
 * Preview entry point — Plan Crece (/preview/crece)
 *
 * Reads client data from localStorage (by demoId) or URL params,
 * merges with a trade template, and injects the full payload into
 * window.__PREVIEW__ before React renders.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "@crece/App.tsx";
import "@crece/index.css";
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
    clientFirstName: params.get("clientFirstName") || "",
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
  tradeKey:        client.trade || "painting",
  clientFirstName: client.clientFirstName,
  name:            client.name,
  city:            client.city,
  phone:           client.phone,
  service:         client.service,
  cta:             client.cta,
  lang,
  logoUrl:         client.logoUrl,
  heroImageUrl:    client.heroImageUrl,
});

// --- 3. Build tOverrides (dot-key strings for crece t("key") system) -----------
const { businessName: biz, city: c, tradeNoun, cta } = payload;
localStorage.setItem("language", lang);

const tOv = {
  en: {
    "hero.title":        `${biz} has your ${tradeNoun} needs covered.`,
    "hero.subtitle":     `Transforming homes across ${c} with precision and care. Quality ${tradeNoun} services that stand the test of time.`,
    "services.title":    `Quality ${tradeNoun[0].toUpperCase() + tradeNoun.slice(1)} Services`,
    "services.description": `From quick repairs to complete transformations, we deliver professional ${tradeNoun} services in ${c} and surrounding areas.`,
    "nav.freeEstimate":  cta,
    "reviews.book":      cta,
    "about.title":       `Meet the team at ${biz}.`,
    "about.description1":`Welcome to ${biz}, proudly serving the greater ${c} area. With over 15 years of hands-on experience, we deliver high-quality ${tradeNoun} services tailored to every client.`,
    "about.description2":`Whether you need a quick fix or a full project, we handle every job personally — ensuring quality, timeliness, and attention to detail from start to finish.`,
    "about.values":      `Our Commitment to ${c}`,
    "about.values.desc": `At ${biz}, we believe in honest pricing, clear communication, and doing the job right the first time. We treat your home with the same care we'd give our own.`,
    "gallery.desc":      `See the quality for yourself. Here are some of our recent ${tradeNoun} projects across the ${c} area.`,
    "gallery.cta.desc":  `Let's talk about your next project. Get a free, no-obligation estimate from ${biz}.`,
    "cta.title":         `Ready to get started in ${c}?`,
    "cta.desc":          `Get a free, no-obligation estimate. We serve ${c} and the surrounding area.`,
    "footer.desc":       `${c}'s trusted ${tradeNoun} experts. Professional service, lasting results.`,
  },
  es: {
    "hero.title":        `${biz} tiene tus necesidades de ${tradeNoun} cubiertas.`,
    "hero.subtitle":     `Transformando hogares en ${c} con precisión y cuidado. Servicios de ${tradeNoun} de calidad que duran en el tiempo.`,
    "services.title":    `Servicios de ${tradeNoun[0].toUpperCase() + tradeNoun.slice(1)} de Calidad`,
    "services.description": `Desde reparaciones rápidas hasta transformaciones completas, ofrecemos servicios profesionales de ${tradeNoun} en ${c} y alrededores.`,
    "nav.freeEstimate":  cta,
    "reviews.book":      cta,
    "about.title":       `Conozca al equipo de ${biz}.`,
    "about.description1":`Bienvenido a ${biz}, al servicio del área de ${c}. Con más de 15 años de experiencia, brindamos servicios de ${tradeNoun} de alta calidad para cada cliente.`,
    "about.description2":`Ya sea una reparación rápida o un proyecto completo, manejamos cada trabajo personalmente, garantizando calidad, puntualidad y atención al detalle.`,
    "about.values":      `Nuestro Compromiso con ${c}`,
    "about.values.desc": `En ${biz}, creemos en precios honestos, comunicación clara y hacer el trabajo bien desde la primera vez. Tratamos su hogar con el mismo cuidado que le daríamos al nuestro.`,
    "gallery.desc":      `Vea la calidad por sí mismo. Aquí hay algunos de nuestros proyectos recientes de ${tradeNoun} en el área de ${c}.`,
    "gallery.cta.desc":  `Hablemos de su próximo proyecto. Obtenga una estimación gratuita y sin compromiso de ${biz}.`,
    "cta.title":         `¿Listo para comenzar en ${c}?`,
    "cta.desc":          `Obtenga una estimación gratuita y sin compromiso. Atendemos ${c} y sus alrededores.`,
    "footer.desc":       `Los expertos en ${tradeNoun} de confianza en ${c}. Servicio profesional, resultados duraderos.`,
  },
};

// --- 4. Set window.__PREVIEW__ BEFORE React renders ---------------------------
window.__PREVIEW__ = {
  phone: payload.phone,
  lang,
  payload,
  tOverrides: tOv[lang],
};

// --- 5. Render ----------------------------------------------------------------
createRoot(document.getElementById("root-preview-crece")).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <App />
    </Router>
  </StrictMode>
);
