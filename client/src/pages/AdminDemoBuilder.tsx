/**
 * Admin Demo Builder — /admin/demo-builder
 *
 * Internal tool for generating customized preview links to share with prospects.
 * This page is NOT linked anywhere publicly. Access it directly by typing the URL.
 *
 * The EN/ES language toggle lives in the navigation bar (not on this page).
 * It controls which language the demo site opens in via the shared PreviewLangContext.
 *
 * How to use:
 *   1. Fill in the prospect's business details.
 *   2. Select the plan tier (Empieza / Crece / Domina).
 *   3. Toggle EN or ES in the top navigation bar to set the preview language.
 *   4. Click "Generar Enlace" to build the preview URL.
 *   5. Copy it or open it directly to verify the customization looks right.
 *   6. Share the link with your prospect — they'll see a preview that shows
 *      their business name, city, phone, and CTA in the selected language.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, CheckCircle } from "lucide-react";
import { usePreviewLang } from "@/contexts/PreviewLangContext";

// Available plan tiers and their preview route paths
const PACKAGES = [
  { value: "empieza", label: "Empieza — Plan básico (1 página)" },
  { value: "crece",   label: "Crece — Plan mediano (varias páginas)" },
  { value: "domina",  label: "Domina — Plan profesional (sitio completo)" },
];

export default function AdminDemoBuilder() {
  // Language selection comes from the nav bar toggle (shared context)
  const { lang } = usePreviewLang();

  // --- Form state ---
  const [name,    setName]    = useState("");
  const [city,    setCity]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [service, setService] = useState("");
  const [cta,     setCta]     = useState("");
  const [pkg,     setPkg]     = useState("empieza");

  // --- Generated link state ---
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [copied,       setCopied]       = useState(false);

  /**
   * Builds the preview URL from form values.
   * Each field is URL-encoded and only appended if non-empty.
   * The base URL is the current origin so the link works on both dev and production.
   * The language comes from the nav bar EN/ES toggle via PreviewLangContext.
   */
  function generateLink() {
    const params = new URLSearchParams();
    if (name.trim())    params.set("name",    name.trim());
    if (city.trim())    params.set("city",    city.trim());
    if (phone.trim())   params.set("phone",   phone.trim());
    if (service.trim()) params.set("service", service.trim());
    if (cta.trim())     params.set("cta",     cta.trim());
    // Language is controlled by the EN/ES toggle in the navigation bar
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
        Usa el botón <span className="font-semibold text-foreground">EN / ES</span> en la barra de navegación para elegir el idioma de la vista previa.
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

        {/* Language indicator — shows what's selected in the nav toggle */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground border border-border rounded-lg px-4 py-3">
          <span>Idioma de la vista previa:</span>
          <span className="font-bold text-foreground">
            {lang === "en" ? "EN — English" : "ES — Español"}
          </span>
          <span className="text-xs">(cambia con el botón EN/ES en la barra de navegación)</span>
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
