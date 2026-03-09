/**
 * imageLibrary.js — Auto-discovers local demo images for all 17 trade keys.
 *
 * Folder convention:
 *   client/src/preview/demo-images/<trade>/hero/    → hero images (use first as primary)
 *   client/src/preview/demo-images/<trade>/gallery/ → gallery grid images
 *   client/src/preview/demo-images/<trade>/support/ → misc support / background images
 *
 * To add images for a trade: drop PNG/JPG/WebP files into the right subfolder.
 * No code changes needed — Vite's glob picks them up automatically on next dev/build.
 *
 * Usage in tradeTemplates.js:
 *   import { getHeroImage, getGalleryImages } from './imageLibrary.js';
 */

const allImages = import.meta.glob('./demo-images/**/*.{png,jpg,jpeg,webp}', { eager: true });

const library = {};

for (const [path, mod] of Object.entries(allImages)) {
  const relative = path.replace('./demo-images/', '');
  const slashIdx = relative.indexOf('/');
  const slashIdx2 = relative.indexOf('/', slashIdx + 1);
  if (slashIdx === -1 || slashIdx2 === -1) continue;

  const trade    = relative.slice(0, slashIdx);
  const category = relative.slice(slashIdx + 1, slashIdx2);

  if (!library[trade]) library[trade] = { hero: [], gallery: [], support: [] };
  if (library[trade][category]) {
    library[trade][category].push(mod.default);
  }
}

for (const tradeData of Object.values(library)) {
  for (const arr of Object.values(tradeData)) {
    arr.sort();
  }
}

/**
 * Returns the first hero image URL for a trade, or null if none exist.
 * Painting is intentionally excluded so it keeps its video hero.
 *
 * @param {string} trade  — e.g. 'landscaping', 'deckbuilder', 'fenceinstaller'
 * @returns {string|null}
 */
export function getHeroImage(trade) {
  if (trade === 'painting') return null;
  return library[trade]?.hero?.[0] ?? null;
}

/**
 * Returns an array of gallery image URLs for a trade (up to `limit`).
 * Returns empty array if none exist.
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
 * Full library map for debugging/inspection.
 * { [trade]: { hero: string[], gallery: string[], support: string[] } }
 */
export default library;
