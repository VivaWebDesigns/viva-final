/**
 * imageLibrary.js — Auto-discovers local demo images for all 17 trade keys.
 *
 * Folder convention:
 *   client/src/preview/demo-images/<trade>/hero/    → hero images (primary feature/banner)
 *   client/src/preview/demo-images/<trade>/gallery/ → portfolio / gallery grid images
 *   client/src/preview/demo-images/<trade>/support/ → service cards, background visuals
 *
 * To add images for a trade: drop PNG/JPG/WebP files into the right subfolder.
 * No code changes needed — Vite's glob picks them up automatically on next dev/build.
 *
 * PRIORITY ORDER (never overridden by stock images if local images exist):
 *   1. Local curated images in the correct category folder
 *   2. Local curated images from a sibling category (support → gallery fallback)
 *   3. Unsplash stock images from the trade template
 *
 * RANDOMIZATION:
 *   - Hero arrays are shuffled once at module load → random rotation per page load
 *   - Gallery arrays are shuffled once at module load → varied order per page load
 *   - Deterministic within a single page view, random across sessions
 */

const allImages = import.meta.glob('./demo-images/**/*.{png,jpg,jpeg,webp}', { eager: true });

// ─── Fisher-Yates shuffle (mutates in place, returns array) ───────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Build library map ────────────────────────────────────────────────────────
const library = {};

for (const [path, mod] of Object.entries(allImages)) {
  const relative = path.replace('./demo-images/', '');
  const slashIdx  = relative.indexOf('/');
  const slashIdx2 = relative.indexOf('/', slashIdx + 1);
  if (slashIdx === -1 || slashIdx2 === -1) continue;

  const trade    = relative.slice(0, slashIdx);
  const category = relative.slice(slashIdx + 1, slashIdx2);

  if (!library[trade]) library[trade] = { hero: [], gallery: [], support: [] };
  if (library[trade][category]) {
    library[trade][category].push(mod.default);
  }
}

// Shuffle hero + gallery arrays once at module load for random-but-stable order
for (const tradeData of Object.values(library)) {
  shuffle(tradeData.hero);
  shuffle(tradeData.gallery);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the first hero image URL for a trade after shuffling, or null if none.
 * Painting is excluded — it keeps Charlotte Painting Pro's video hero.
 *
 * @param {string} trade  — e.g. 'plumbing', 'landscaping', 'fenceinstaller'
 * @returns {string|null}
 */
export function getHeroImage(trade) {
  if (trade === 'painting') return null;
  return library[trade]?.hero?.[0] ?? null;
}

/**
 * Returns shuffled gallery image URLs for a trade (up to `limit`).
 * Painting is excluded to preserve Charlotte Painting Pro's portfolio.
 *
 * @param {string} trade
 * @param {number} [limit=9]
 * @returns {string[]}
 */
export function getGalleryImages(trade, limit = 9) {
  if (trade === 'painting') return [];
  return library[trade]?.gallery?.slice(0, limit) ?? [];
}

/**
 * Returns support image URLs for a trade (up to `limit`).
 * Falls back to gallery images if the support folder is empty.
 * Falls back to an empty array if neither category has images.
 * Painting is excluded.
 *
 * @param {string} trade
 * @param {number} [limit=6]
 * @returns {string[]}
 */
export function getSupportImages(trade, limit = 6) {
  if (trade === 'painting') return [];
  const support = library[trade]?.support ?? [];
  if (support.length > 0) return support.slice(0, limit);
  return library[trade]?.gallery?.slice(0, limit) ?? [];
}

/**
 * Returns true if the trade has any curated local images in any category.
 * Useful for conditional rendering or debugging.
 *
 * @param {string} trade
 * @returns {boolean}
 */
export function hasCuratedImages(trade) {
  const d = library[trade];
  if (!d) return false;
  return d.hero.length > 0 || d.gallery.length > 0 || d.support.length > 0;
}

/**
 * Full library map — single source of truth for all trade images.
 * Shape: { [trade]: { hero: string[], gallery: string[], support: string[] } }
 */
export default library;
