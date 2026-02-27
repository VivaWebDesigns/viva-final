# Content Management Guide

## How to Edit Text on the Website

All website copy is managed from a single file:

**`/client/src/content/content.json`**

---

## Structure

Every text string has this format:

```json
{
  "en": "English text (for your reference)",
  "es": "Spanish text (shown on the website)"
}
```

- **English** is for reference only — it is never shown on the live site.
- **Spanish** is what visitors see.
- **Only edit the `"es"` value** to change what appears on the website.

---

## Example

To change the hero headline on the Home page:

```json
"home": {
  "hero": {
    "title1": { "en": "More calls.", "es": "Más llamadas." }
  }
}
```

Change `"es": "Más llamadas."` to whatever Spanish text you want.

---

## File Organization

The file is organized by page/section:

| Section | What it controls |
|---------|-----------------|
| `global` | Company name, phone, email, WhatsApp URL |
| `nav` | Navigation links and CTA button |
| `footer` | Footer text, links, copyright |
| `home` | Home page — all sections |
| `paquetes` | Packages comparison page |
| `empieza` | Plan Empieza detail page |
| `crece` | Plan Crece detail page |
| `domina` | Plan Domina detail page |
| `contacto` | Contact page — form labels, sidebar |

---

## After Editing

After saving changes to `content.json`:

- **In development**: Changes appear automatically (hot reload).
- **In production**: Republish/deploy the app for changes to go live.

---

## Important Rules

1. Never delete the `"en"` field — it's needed for reference.
2. Keep all JSON syntax valid (don't remove commas or quotes).
3. Only modify `"es"` values for the live site.
4. Boolean values (`true`/`false`) in the comparison table don't need translation.
