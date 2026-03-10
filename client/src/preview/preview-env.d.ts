/**
 * Window augmentation for the Demo Builder preview system.
 *
 * `window.__PREVIEW__` is injected by the preview entry-point scripts
 * (empieza-main.jsx / crece-main.jsx / domina-main.jsx) before React mounts.
 * All preview tier components read from this global instead of making API calls.
 *
 * Keep this interface in sync with buildPreviewPayload() in tradeTemplates.js
 * and the tOverrides shape written in the entry files.
 */

/** Shape returned by buildPreviewPayload() in tradeTemplates.js */
interface PreviewPayload {
  clientFirstName: string;
  businessName: string;
  city: string;
  phone: string;
  email: string;
  trade: string;
  /** Display name for the trade in the active language (e.g. "Pintura Exterior") */
  tradeName: string;
  /** Trade noun in active language */
  tradeNoun: string;
  tradeNounEN: string;
  tradeNounES: string;
  lang: "en" | "es";
  cta: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  aboutImageUrl: string | null;
  galleryImages: Array<{ url: string; alt: string }> | null;
  services: Array<{ title: string; description?: string; icon?: string }>;
  servicesEN: Array<{ title: string; description?: string; icon?: string }>;
  servicesES: Array<{ title: string; description?: string; icon?: string }>;
  reviews: Array<{ author: string; text: string; rating?: number }>;
  reviewsEN: Array<{ author: string; text: string; rating?: number }>;
  reviewsES: Array<{ author: string; text: string; rating?: number }>;
  portfolio: unknown;
}

interface PreviewConfig {
  /** Full payload built by buildPreviewPayload() in tradeTemplates.js */
  payload: PreviewPayload;
  /** Active language: "en" | "es" */
  lang?: "en" | "es";
  /**
   * Translation overrides from the Demo Builder.
   * Supports two shapes used by different tiers:
   *   - Flat:   `{ "hero.title": "...", "nav.about": "..." }`  (Empieza / Crece legacy)
   *   - Nested: `{ en: { "hero.title": "..." }, es: { "hero.title": "..." } }` (current)
   */
  tOverrides?: Record<string, unknown>;
  /**
   * Domina-tier translation override tree.
   * Shape: `{ [section]: { [key]: string } }` or language-aware `{ en: {...}, es: {...} }`.
   */
  domina?: Record<string, unknown>;
  /** Top-level phone convenience accessor (same as payload.phone) */
  phone?: string;
}

declare global {
  interface Window {
    /**
     * Set by preview entry-points before React mounts.
     * Undefined outside of preview iframe context.
     */
    __PREVIEW__?: PreviewConfig;
  }
}

export {};
