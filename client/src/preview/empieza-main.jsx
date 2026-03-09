/**
 * Preview entry point — Plan Empieza (/preview/empieza)
 *
 * Reads client data from localStorage (by demoId) or URL params,
 * merges with a trade template, and injects the full payload into
 * window.__PREVIEW__ before React renders.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import App from "@empieza/App.tsx";
import "@empieza/index.css";
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

// --- 3. Build tOverrides (text strings for the empieza t() system) -------------
const { businessName: biz, city: c, tradeNoun, tradeNounES, cta } = payload;
const tnES = tradeNounES || tradeNoun;

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const tOv = {
  en: {
    heroTitle:       `${biz} has your ${tradeNoun} needs covered.`,
    heroSubtitle:    `Transforming homes across ${c} with precision and care. Quality ${tradeNoun} services that stand the test of time.`,
    getFreeEstimate: cta,
    ourExpertise:    "Our Expertise",
    qualityServices: `Quality ${cap(tradeNoun)} Services`,
    servicesSub:     `From quick repairs to complete transformations, we deliver professional ${tradeNoun} services in ${c} and surrounding areas.`,
    hiDavid:         `Meet the team at ${biz}.`,
    aboutP1:         `Welcome to ${biz}, proudly serving the greater ${c} area. With over 15 years of hands-on experience, we're dedicated to delivering high-quality ${tradeNoun} services tailored to every client.`,
    aboutP2:         `Whether you need a quick repair or a full project, we handle every job personally — from start to finish — ensuring quality, timeliness, and attention to detail.`,
    whyUsP1:         `At ${biz}, every project starts with a conversation. We listen to your vision, understand your goals, and deliver results that bring your space to life — on time and with no surprises.`,
    letUsHelp:       `Contact ${biz} today for a free estimate in ${c}!`,
    contactSub:      `Contact ${biz} today for a free, no-obligation estimate in ${c} and surrounding areas.`,
    formSub:         `Fill out the form below and we will get back to you within 24 hours.`,
    bookQuote:       cta,
  },
  es: {
    heroTitle:       `${biz} tiene tus necesidades de ${tnES} cubiertas.`,
    heroSubtitle:    `Transformando hogares en ${c} con precisión y cuidado. Servicios de ${tnES} de calidad que duran en el tiempo.`,
    getFreeEstimate: cta,
    ourExpertise:    "Nuestra Experiencia",
    qualityServices: `Servicios de ${cap(tnES)} de Calidad`,
    servicesSub:     `Desde reparaciones rápidas hasta transformaciones completas, ofrecemos servicios de ${tnES} en ${c} y alrededores.`,
    hiDavid:         `Conozca al equipo de ${biz}.`,
    aboutP1:         `Bienvenido a ${biz}, al servicio del área de ${c}. Con más de 15 años de experiencia, nos dedicamos a brindar servicios de ${tnES} de alta calidad personalizados para cada cliente.`,
    aboutP2:         `Ya sea una reparación rápida o un proyecto completo, manejamos cada trabajo personalmente, garantizando calidad, puntualidad y atención al detalle.`,
    whyUsP1:         `En ${biz}, cada proyecto comienza con una conversación. Escuchamos su visión, entendemos sus metas y entregamos resultados que dan vida a su espacio, a tiempo y sin sorpresas.`,
    letUsHelp:       `¡Contáctenos en ${biz} hoy para una estimación gratis en ${c}!`,
    contactSub:      `Contáctenos en ${biz} hoy para una estimación gratuita y sin compromiso en ${c} y alrededores.`,
    formSub:         `Complete el formulario a continuación y nos pondremos en contacto con usted en 24 horas.`,
    bookQuote:       cta,
  },
};

// --- 4. Set window.__PREVIEW__ BEFORE React renders ---------------------------
window.__PREVIEW__ = {
  phone: payload.phone,
  lang,
  payload,
  tOverrides: tOv, // full { en: {...}, es: {...} } — t() picks the active language
};

// --- 5. Render ----------------------------------------------------------------
createRoot(document.getElementById("root-preview-empieza")).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <App />
    </Router>
  </StrictMode>
);
