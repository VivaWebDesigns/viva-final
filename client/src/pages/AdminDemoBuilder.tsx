/**
 * Admin Demo Builder — /admin/demo-builder
 *
 * Internal tool for generating customized preview links to share with prospects.
 * This page is NOT linked anywhere publicly. Access it directly by typing the URL.
 *
 * The EN/ES language toggle in the navigation bar controls two things at once:
 *   1. The language of THIS page's UI labels.
 *   2. The language the demo preview site will open in when the link is visited.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, CheckCircle } from "lucide-react";
import { usePreviewLang } from "@/contexts/PreviewLangContext";

// --- UI strings for both languages ---
const ui = {
  en: {
    heading:        "Preview Link Generator",
    subheading:     "Fill in the prospect's business details, select a plan, and generate a personalized link to show them what their website could look like. The link is not publicly listed anywhere. Use the EN / ES button in the navigation bar to set the preview language.",
    labelName:      "Business Name",
    placeholderName:"e.g. Rodriguez Plumbing",
    labelCity:      "City",
    placeholderCity:"e.g. Houston",
    labelPhone:     "Phone",
    placeholderPhone:"e.g. (713) 555-0123",
    labelService:   "Service Type",
    placeholderService:"e.g. Plumbing, Roofing, Painting",
    labelCta:       "Main Button Text (CTA)",
    placeholderCta: "e.g. Call for a free quote",
    labelPlan:      "Plan to preview",
    packages: [
      { value: "empieza", label: "Empieza — Basic plan (1 page)" },
      { value: "crece",   label: "Crece — Mid-tier plan (multiple pages)" },
      { value: "domina",  label: "Domina — Professional plan (full site)" },
    ],
    generateBtn:    "Generate Preview Link",
    generatedLabel: "Generated link",
    copyBtn:        "Copy link",
    copiedBtn:      "Copied!",
    openBtn:        "Open preview",
    shareNote:      "Share this link directly with your prospect. It is not indexed or linked anywhere on the public site.",
  },
  es: {
    heading:        "Generador de Vista Previa",
    subheading:     "Llena los datos del prospecto, selecciona el plan y genera un enlace personalizado para mostrarle cómo quedaría su sitio web. El enlace no aparece en ningún lugar público. Usa el botón EN / ES en la barra de navegación para elegir el idioma de la vista previa.",
    labelName:      "Nombre del negocio",
    placeholderName:"Ej: Rodriguez Plumbing",
    labelCity:      "Ciudad",
    placeholderCity:"Ej: Houston",
    labelPhone:     "Teléfono",
    placeholderPhone:"Ej: (713) 555-0123",
    labelService:   "Tipo de servicio",
    placeholderService:"Ej: Plomería, Techado, Pintura",
    labelCta:       "Texto del botón principal (CTA)",
    placeholderCta: "Ej: Llama para cotización gratis",
    labelPlan:      "Plan a mostrar",
    packages: [
      { value: "empieza", label: "Empieza — Plan básico (1 página)" },
      { value: "crece",   label: "Crece — Plan mediano (varias páginas)" },
      { value: "domina",  label: "Domina — Plan profesional (sitio completo)" },
    ],
    generateBtn:    "Generar Enlace de Vista Previa",
    generatedLabel: "Enlace generado",
    copyBtn:        "Copiar enlace",
    copiedBtn:      "¡Copiado!",
    openBtn:        "Abrir vista previa",
    shareNote:      "Comparte este enlace directamente con el prospecto. No está indexado ni aparece en ningún lugar público del sitio.",
  },
};

export default function AdminDemoBuilder() {
  // Language selection comes from the nav bar toggle (shared context).
  // It controls both the UI language of this page and the preview link's lang param.
  const { lang } = usePreviewLang();
  const s = ui[lang];

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

  function generateLink() {
    const params = new URLSearchParams();
    if (name.trim())    params.set("name",    name.trim());
    if (city.trim())    params.set("city",    city.trim());
    if (phone.trim())   params.set("phone",   phone.trim());
    if (service.trim()) params.set("service", service.trim());
    if (cta.trim())     params.set("cta",     cta.trim());
    params.set("lang", lang);

    const base = `${window.location.origin}/preview/${pkg}`;
    setGeneratedUrl(`${base}?${params.toString()}`);
    setCopied(false);
  }

  function copyLink() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-foreground mb-1">{s.heading}</h1>
      <p className="text-muted-foreground text-sm mb-8">
        {s.subheading.split("EN / ES").map((part, i, arr) =>
          i < arr.length - 1
            ? <span key={i}>{part}<span className="font-semibold text-foreground">EN / ES</span></span>
            : <span key={i}>{part}</span>
        )}
      </p>

      <div className="space-y-5 bg-card border border-border rounded-xl p-6">

        {/* Business Name */}
        <div className="space-y-1.5">
          <Label htmlFor="input-name">{s.labelName}</Label>
          <Input
            id="input-name"
            data-testid="input-name"
            placeholder={s.placeholderName}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {/* City */}
        <div className="space-y-1.5">
          <Label htmlFor="input-city">{s.labelCity}</Label>
          <Input
            id="input-city"
            data-testid="input-city"
            placeholder={s.placeholderCity}
            value={city}
            onChange={e => setCity(e.target.value)}
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="input-phone">{s.labelPhone}</Label>
          <Input
            id="input-phone"
            data-testid="input-phone"
            placeholder={s.placeholderPhone}
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </div>

        {/* Service */}
        <div className="space-y-1.5">
          <Label htmlFor="input-service">{s.labelService}</Label>
          <Input
            id="input-service"
            data-testid="input-service"
            placeholder={s.placeholderService}
            value={service}
            onChange={e => setService(e.target.value)}
          />
        </div>

        {/* CTA */}
        <div className="space-y-1.5">
          <Label htmlFor="input-cta">{s.labelCta}</Label>
          <Input
            id="input-cta"
            data-testid="input-cta"
            placeholder={s.placeholderCta}
            value={cta}
            onChange={e => setCta(e.target.value)}
          />
        </div>

        {/* Package selector */}
        <div className="space-y-1.5">
          <Label>{s.labelPlan}</Label>
          <div className="flex flex-col gap-2 pt-1">
            {s.packages.map(p => (
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

        {/* Generate button */}
        <Button
          data-testid="button-generate"
          className="w-full mt-2"
          onClick={generateLink}
        >
          {s.generateBtn}
        </Button>
      </div>

      {/* Generated URL output */}
      {generatedUrl && (
        <div className="mt-6 space-y-3">
          <Label>{s.generatedLabel}</Label>
          <Input
            data-testid="output-link"
            readOnly
            value={generatedUrl}
            className="font-mono text-xs bg-muted"
            onClick={e => (e.target as HTMLInputElement).select()}
          />
          <div className="flex gap-3">
            <Button
              data-testid="button-copy"
              variant="outline"
              className="flex-1"
              onClick={copyLink}
            >
              {copied ? (
                <><CheckCircle size={16} className="mr-2 text-green-600" />{s.copiedBtn}</>
              ) : (
                <><Copy size={16} className="mr-2" />{s.copyBtn}</>
              )}
            </Button>

            <Button
              data-testid="button-open-preview"
              variant="outline"
              className="flex-1"
              onClick={() => window.open(generatedUrl, "_blank")}
            >
              <ExternalLink size={16} className="mr-2" />
              {s.openBtn}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">{s.shareNote}</p>
        </div>
      )}
    </div>
  );
}
