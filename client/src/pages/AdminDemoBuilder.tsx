/**
 * Admin Demo Builder — /admin/demo-builder
 *
 * Internal tool for generating customized preview links to share with prospects.
 * This page is NOT linked anywhere publicly. Access it directly by typing the URL.
 *
 * How to use:
 *   1. Fill in the prospect's business details.
 *   2. Select the plan tier (Empieza / Crece / Domina).
 *   3. Choose the language the prospect should see (English or Spanish).
 *   4. Click "Generar Enlace" to build the preview URL.
 *   5. Copy it or open it directly to verify the customization looks right.
 *   6. Share the link with your prospect — they'll see a preview that shows
 *      their business name, city, phone, and CTA in the selected language.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, CheckCircle, Languages } from "lucide-react";

// Available plan tiers and their preview route paths
const PACKAGES = [
  { value: "empieza", label: "Empieza — Plan básico (1 página)" },
  { value: "crece",   label: "Crece — Plan mediano (varias páginas)" },
  { value: "domina",  label: "Domina — Plan profesional (sitio completo)" },
];

export default function AdminDemoBuilder() {
  // --- Form state ---
  const [name,    setName]    = useState("");
  const [city,    setCity]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [service, setService] = useState("");
  const [cta,     setCta]     = useState("");
  const [pkg,     setPkg]     = useState("empieza");

  // --- Language toggle: "en" = English, "es" = Spanish ---
  // This controls which language the demo site opens in when the prospect visits the link.
  const [lang, setLang] = useState<"en" | "es">("en");

  // --- Generated link state ---
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [copied,       setCopied]       = useState(false);

  /**
   * Builds the preview URL from form values.
   * Each field is URL-encoded and only appended if non-empty.
   * The base URL is the current origin so the link works on both dev and production.
   */
  function generateLink() {
    const params = new URLSearchParams();
    if (name.trim())    params.set("name",    name.trim());
    if (city.trim())    params.set("city",    city.trim());
    if (phone.trim())   params.set("phone",   phone.trim());
    if (service.trim()) params.set("service", service.trim());
    if (cta.trim())     params.set("cta",     cta.trim());
    // Always include the language so the demo opens in the right one
    params.set("lang", lang);

    const base = `${window.location.origin}/preview/${pkg}`;
    setGeneratedUrl(`${base}?${params.toString()}`);
    setCopied(false);
  }

  /** Copies the generated URL to the clipboard and shows a brief checkmark. */
  function copyLink() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-foreground mb-1">Generador de Vista Previa</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Llena los datos del prospecto, selecciona el plan y genera un enlace personalizado
        para mostrarle cómo quedaría su sitio web. El enlace no aparece en ningún lugar público.
      </p>

      <div className="space-y-5 bg-card border border-border rounded-xl p-6">

        {/* Business Name */}
        <div className="space-y-1.5">
          <Label htmlFor="input-name">Nombre del negocio</Label>
          <Input
            id="input-name"
            data-testid="input-name"
            placeholder="Ej: Rodriguez Plumbing"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {/* City */}
        <div className="space-y-1.5">
          <Label htmlFor="input-city">Ciudad</Label>
          <Input
            id="input-city"
            data-testid="input-city"
            placeholder="Ej: Houston"
            value={city}
            onChange={e => setCity(e.target.value)}
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="input-phone">Teléfono</Label>
          <Input
            id="input-phone"
            data-testid="input-phone"
            placeholder="Ej: (713) 555-0123"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </div>

        {/* Service */}
        <div className="space-y-1.5">
          <Label htmlFor="input-service">Tipo de servicio</Label>
          <Input
            id="input-service"
            data-testid="input-service"
            placeholder="Ej: Plomería, Techado, Pintura"
            value={service}
            onChange={e => setService(e.target.value)}
          />
        </div>

        {/* CTA */}
        <div className="space-y-1.5">
          <Label htmlFor="input-cta">Texto del botón principal (CTA)</Label>
          <Input
            id="input-cta"
            data-testid="input-cta"
            placeholder="Ej: Llama para cotización gratis"
            value={cta}
            onChange={e => setCta(e.target.value)}
          />
        </div>

        {/* Package selector */}
        <div className="space-y-1.5">
          <Label>Plan a mostrar</Label>
          <div className="flex flex-col gap-2 pt-1">
            {PACKAGES.map(p => (
              <label
                key={p.value}
                data-testid={`radio-${p.value}`}
                className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                  pkg === p.value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                <input
                  type="radio"
                  name="package"
                  value={p.value}
                  checked={pkg === p.value}
                  onChange={() => setPkg(p.value)}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Language toggle — controls the language the demo site opens in */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2">
            <Languages size={15} className="text-muted-foreground" />
            Idioma de la vista previa
          </Label>
          <p className="text-xs text-muted-foreground -mt-0.5">
            El prospecto verá el sitio en el idioma que elijas aquí.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              data-testid="toggle-lang-en"
              type="button"
              onClick={() => setLang("en")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                lang === "en"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              EN — English
            </button>
            <button
              data-testid="toggle-lang-es"
              type="button"
              onClick={() => setLang("es")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                lang === "es"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              ES — Español
            </button>
          </div>
        </div>

        {/* Generate button */}
        <Button
          data-testid="button-generate"
          className="w-full mt-2"
          onClick={generateLink}
        >
          Generar Enlace de Vista Previa
        </Button>
      </div>

      {/* Generated URL output */}
      {generatedUrl && (
        <div className="mt-6 space-y-3">
          <Label>Enlace generado</Label>
          <div className="flex items-center gap-2">
            <Input
              data-testid="output-link"
              readOnly
              value={generatedUrl}
              className="font-mono text-xs bg-muted"
              onClick={e => (e.target as HTMLInputElement).select()}
            />
          </div>
          <div className="flex gap-3">
            {/* Copy button */}
            <Button
              data-testid="button-copy"
              variant="outline"
              className="flex-1"
              onClick={copyLink}
            >
              {copied ? (
                <>
                  <CheckCircle size={16} className="mr-2 text-green-600" />
                  ¡Copiado!
                </>
              ) : (
                <>
                  <Copy size={16} className="mr-2" />
                  Copiar enlace
                </>
              )}
            </Button>

            {/* Open preview button */}
            <Button
              data-testid="button-open-preview"
              variant="outline"
              className="flex-1"
              onClick={() => window.open(generatedUrl, "_blank")}
            >
              <ExternalLink size={16} className="mr-2" />
              Abrir vista previa
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Comparte este enlace directamente con el prospecto. No está indexado ni aparece
            en ningún lugar público del sitio.
          </p>
        </div>
      )}
    </div>
  );
}
