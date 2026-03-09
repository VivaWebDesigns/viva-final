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

localStorage.setItem("lang", lang);

const { businessName: biz, city: c, tradeNoun, tradeNounES, cta } = payload;
const tnES = tradeNounES || tradeNoun;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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
      expertiseTitle: `Quality ${cap(tradeNoun)} Services`,
    },
    about: {
      title:       `Meet the team at ${biz}.`,
      paragraph1:  `Welcome to ${biz}, proudly serving the greater ${c} area. With over 15 years of hands-on experience, we deliver high-quality ${tradeNoun} services tailored to every client's needs.`,
      paragraph2:  `Whether you need a quick repair or a full project, we handle every job personally — from start to finish — ensuring quality, timeliness, and attention to detail.`,
      valuesTitle: `Our Commitment to ${c}`,
      valuesText:  `At ${biz}, we believe in honest pricing, clear communication, and doing the job right the first time. We treat your home with the same care we'd give our own.`,
    },
    services: {
      title: `Quality ${cap(tradeNoun)} Services`,
    },
    gallery: {
      title:    `Our ${cap(tradeNoun)} Work`,
      subtitle: `See the quality for yourself. Here are some of our recent ${tradeNoun} projects across the ${c} area.`,
      likeTitle:    `Like What You See?`,
      likeSubtitle: `Let's talk about your project. Get a free, no-obligation estimate from ${biz}.`,
    },
    portfolio: {
      title:    `Our ${cap(tradeNoun)} Projects`,
      subtitle: `Real work, real results. Browse recent ${tradeNoun} projects completed in ${c} and surrounding areas.`,
    },
    footer: {
      copyright: `${biz}. All rights reserved.`,
    },
  },
  es: {
    nav: { phone: payload.phone, getEstimate: cta },
    home: {
      heroTitle1: `${biz} — `,
      heroTitle2: `${tnES}`,
      heroTitle3: " de confianza.",
      heroSubtitle:   `Transformando hogares en ${c} con precisión y cuidado. Servicios de ${tnES} de calidad que duran en el tiempo.`,
      readySubtitle:  `Obtenga una estimación gratuita y sin compromiso. Atendemos ${c} y sus alrededores.`,
      ctaEstimate:    cta,
      expertiseTitle: `Servicios de ${cap(tnES)} de Calidad`,
    },
    about: {
      title:       `Conozca al equipo de ${biz}.`,
      paragraph1:  `Bienvenido a ${biz}, al servicio del área de ${c}. Con más de 15 años de experiencia, brindamos servicios de ${tnES} de alta calidad para cada cliente.`,
      paragraph2:  `Ya sea una reparación rápida o un proyecto completo, manejamos cada trabajo personalmente, garantizando calidad, puntualidad y atención al detalle.`,
      valuesTitle: `Nuestro Compromiso con ${c}`,
      valuesText:  `En ${biz}, creemos en precios honestos, comunicación clara y hacer el trabajo bien desde la primera vez. Tratamos su hogar con el mismo cuidado que le daríamos al nuestro.`,
    },
    services: {
      title: `Servicios de ${cap(tnES)} de Calidad`,
    },
    gallery: {
      title:    `Nuestro Trabajo de ${cap(tnES)}`,
      subtitle: `Vea la calidad por sí mismo. Aquí hay algunos de nuestros proyectos recientes de ${tnES} en ${c}.`,
      likeTitle:    `¿Le Gusta Lo Que Ve?`,
      likeSubtitle: `Hablemos de su proyecto. Obtenga una estimación gratuita y sin compromiso de ${biz}.`,
    },
    portfolio: {
      title:    `Nuestros Proyectos de ${cap(tnES)}`,
      subtitle: `Trabajo real, resultados reales. Explore proyectos recientes de ${tnES} completados en ${c} y alrededores.`,
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
  domina: dominaOv, // full { en: {...}, es: {...} } — LanguageContext picks the active language
};

// --- 5. Render ----------------------------------------------------------------
createRoot(document.getElementById("root-preview-domina")).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <App />
    </Router>
  </StrictMode>
);
