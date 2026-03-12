/**
 * Admin Demo Builder — /admin/demo-builder
 *
 * Internal tool for generating customized preview links to share with prospects.
 * This page is NOT linked anywhere publicly. Access it directly by typing the URL.
 *
 * How the preview link works:
 *   - Prospect's trade selects a full content template.
 *   - Client overrides (name, city, phone, CTA) are applied on top.
 *   - A unique demoId is saved to localStorage and included in the URL.
 *   - All fields are also URL params for cross-device fallback.
 *   - Optionally save the demo config linked to a CRM lead record.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Copy, ExternalLink, CheckCircle, Link2, Search, X, Check,
} from "lucide-react";
import { usePreviewLang } from "@/contexts/PreviewLangContext";
import type { CrmLead } from "@shared/schema";

const TRADE_OPTIONS = {
  en: [
    { value: "painting",        label: "🎨 Painting" },
    { value: "plumbing",        label: "🔧 Plumbing" },
    { value: "roofing",         label: "🏠 Roofing" },
    { value: "electrician",     label: "⚡ Electrical" },
    { value: "landscaping",     label: "🌿 Landscaping" },
    { value: "hvac",            label: "❄️ HVAC" },
    { value: "general",         label: "🔨 General Contractor" },
    { value: "housecleaner",    label: "🧹 House Cleaning" },
    { value: "pressurewashing", label: "💧 Pressure Washing" },
    { value: "carpenter",       label: "🪚 Carpentry" },
    { value: "floorinstaller",  label: "🪵 Flooring" },
    { value: "tileinstaller",   label: "🔲 Tile Installation" },
    { value: "fenceinstaller",  label: "🚧 Fence Installation" },
    { value: "deckbuilder",     label: "🏗️ Deck Building" },
    { value: "shedbuilder",     label: "🏚️ Shed Building" },
    { value: "concrete",        label: "🛣️ Concrete & Asphalt" },
    { value: "treeservice",     label: "🌳 Tree Service" },
  ],
  es: [
    { value: "painting",        label: "🎨 Pintura" },
    { value: "plumbing",        label: "🔧 Plomería" },
    { value: "roofing",         label: "🏠 Techado" },
    { value: "electrician",     label: "⚡ Electricidad" },
    { value: "landscaping",     label: "🌿 Jardinería" },
    { value: "hvac",            label: "❄️ HVAC / Climatización" },
    { value: "general",         label: "🔨 Contratista General" },
    { value: "housecleaner",    label: "🧹 Limpieza de Hogar" },
    { value: "pressurewashing", label: "💧 Lavado a Presión" },
    { value: "carpenter",       label: "🪚 Carpintería" },
    { value: "floorinstaller",  label: "🪵 Pisos" },
    { value: "tileinstaller",   label: "🔲 Instalación de Azulejos" },
    { value: "fenceinstaller",  label: "🚧 Instalación de Cercas" },
    { value: "deckbuilder",     label: "🏗️ Construcción de Terrazas" },
    { value: "shedbuilder",     label: "🏚️ Construcción de Cobertizos" },
    { value: "concrete",        label: "🛣️ Concreto y Asfalto" },
    { value: "treeservice",     label: "🌳 Servicio de Árboles" },
  ],
};

const ui = {
  en: {
    heading:             "Preview Link Generator",
    subheading:          "Fill in the prospect's details, select their trade and plan, then generate a personalized preview link. The trade automatically loads matching images, services, and reviews. Use the EN / ES button in the nav to set the preview language.",
    labelFirstName:      "Client First Name",
    placeholderFirstName:"e.g. Maria",
    labelTrade:          "Trade / Industry",
    tradeHint:           "Sets the hero image, services, gallery, and reviews automatically.",
    labelName:           "Business Name",
    placeholderName:     "e.g. Rodriguez Plumbing",
    labelCity:           "City",
    placeholderCity:     "e.g. Houston",
    labelPhone:          "Phone Number",
    placeholderPhone:    "e.g. (713) 555-0123",
    labelCta:            "CTA Button Text  (optional)",
    placeholderCta:      "e.g. Call for a free quote",
    labelLogoUrl:        "Logo URL  (optional)",
    placeholderLogo:     "https://... (leave blank to use business name as text logo)",
    labelPlan:           "Plan to preview",
    packages: [
      { value: "empieza", label: "Empieza — Basic (1 page)" },
      { value: "crece",   label: "Crece — Mid-tier (multiple pages)" },
      { value: "domina",  label: "Domina — Professional (full site)" },
    ],
    generateBtn:         "Generate Preview Link",
    generatedLabel:      "Generated link",
    copyBtn:             "Copy link",
    copiedBtn:           "Copied!",
    openBtn:             "Open preview",
    saveToLeadBtn:       "Save to Lead",
    savedToLeadLabel:    "Saved to lead",
    shareNote:           "Share this link directly with your prospect. It is not indexed or listed anywhere on the public site.",
    tradeAutoFill:       "Auto-filled from trade template",
    leadPickerTitle:     "Link to a CRM Lead",
    leadPickerSearch:    "Search leads...",
    leadPickerEmpty:     "No leads found",
    leadPickerSave:      "Save",
  },
  es: {
    heading:             "Generador de Vista Previa",
    subheading:          "Llena los datos del prospecto, selecciona su oficio y plan, luego genera un enlace de vista previa personalizado. El oficio carga automáticamente imágenes, servicios y reseñas del sector. Usa EN / ES en la barra de navegación para el idioma de la vista previa.",
    labelFirstName:      "Nombre del cliente",
    placeholderFirstName:"Ej: Maria",
    labelTrade:          "Oficio / Industria",
    tradeHint:           "Configura automáticamente la imagen hero, servicios, galería y reseñas.",
    labelName:           "Nombre del negocio",
    placeholderName:     "Ej: Rodriguez Plomería",
    labelCity:           "Ciudad",
    placeholderCity:     "Ej: Houston",
    labelPhone:          "Teléfono",
    placeholderPhone:    "Ej: (713) 555-0123",
    labelCta:            "Texto del botón CTA  (opcional)",
    placeholderCta:      "Ej: Llama para cotización gratis",
    labelLogoUrl:        "URL del logo  (opcional)",
    placeholderLogo:     "https://... (dejar en blanco para usar el nombre del negocio)",
    labelPlan:           "Plan a mostrar",
    packages: [
      { value: "empieza", label: "Empieza — Básico (1 página)" },
      { value: "crece",   label: "Crece — Mediano (varias páginas)" },
      { value: "domina",  label: "Domina — Profesional (sitio completo)" },
    ],
    generateBtn:         "Generar Enlace de Vista Previa",
    generatedLabel:      "Enlace generado",
    copyBtn:             "Copiar enlace",
    copiedBtn:           "¡Copiado!",
    openBtn:             "Abrir vista previa",
    saveToLeadBtn:       "Guardar en Prospecto",
    savedToLeadLabel:    "Guardado en prospecto",
    shareNote:           "Comparte este enlace directamente con el prospecto. No está indexado ni visible en ningún lugar público del sitio.",
    tradeAutoFill:       "Cargado automáticamente desde la plantilla del oficio",
    leadPickerTitle:     "Vincular a un Prospecto CRM",
    leadPickerSearch:    "Buscar prospectos...",
    leadPickerEmpty:     "Sin resultados",
    leadPickerSave:      "Guardar",
  },
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}

interface LeadItem {
  id: string;
  title: string;
  company?: { name: string } | null;
  contact?: { firstName: string; lastName: string | null } | null;
}

export default function AdminDemoBuilder() {
  const { lang } = usePreviewLang();
  const s = ui[lang];
  const { toast } = useToast();
  const qc = useQueryClient();

  const [trade,           setTrade]           = useState("painting");
  const [clientFirstName, setClientFirstName] = useState("");
  const [name,            setName]            = useState("");
  const [city,            setCity]            = useState("");
  const [phone,           setPhone]           = useState("");
  const [cta,             setCta]             = useState("");
  const [logoUrl,         setLogoUrl]         = useState("");
  const [pkg,             setPkg]             = useState("empieza");

  const [generatedUrl, setGeneratedUrl] = useState("");
  const [copied,       setCopied]       = useState(false);

  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [leadSearch,     setLeadSearch]     = useState("");
  const [savedLeadId,    setSavedLeadId]    = useState<string | null>(null);

  const { data: leads = [] } = useQuery<LeadItem[]>({
    queryKey: ["/api/crm/leads"],
    staleTime: STALE.FAST,
    enabled: showLeadPicker,
  });

  const saveDemoMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await apiRequest("POST", "/api/demo-configs", {
        leadId,
        businessName: name || clientFirstName || "Demo",
        trade,
        tier: pkg,
        city: city || null,
        phone: phone || null,
        previewUrl: generatedUrl,
      });
      return res.json();
    },
    onSuccess: (_data, leadId) => {
      setSavedLeadId(leadId);
      setShowLeadPicker(false);
      toast({ title: lang === "es" ? "Vista previa guardada en el prospecto" : "Demo saved to lead" });
      qc.invalidateQueries({ queryKey: ["/api/demo-configs"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function generateLink() {
    const payload = {
      clientFirstName: clientFirstName.trim(),
      name:    name.trim(),
      city:    city.trim(),
      phone:   phone.trim(),
      cta:     cta.trim(),
      lang,
      trade,
      logoUrl: logoUrl.trim(),
      tier:    pkg,
    };

    const id = generateId();
    try { localStorage.setItem(`vvwd_preview_${id}`, JSON.stringify(payload)); } catch (_) {}

    const params = new URLSearchParams({ id, lang, trade });
    if (payload.clientFirstName) params.set("clientFirstName", payload.clientFirstName);
    if (payload.name)    params.set("name",    payload.name);
    if (payload.city)    params.set("city",    payload.city);
    if (payload.phone)   params.set("phone",   payload.phone);
    if (payload.cta)     params.set("cta",     payload.cta);
    if (payload.logoUrl) params.set("logoUrl", payload.logoUrl);

    const base = `${window.location.origin}/preview/${pkg}`;
    setGeneratedUrl(`${base}?${params.toString()}`);
    setCopied(false);
    setSavedLeadId(null);
  }

  function copyLink() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const filteredLeads = leads.filter((l) => {
    const q = leadSearch.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.company?.name.toLowerCase().includes(q) ||
      [l.contact?.firstName, l.contact?.lastName].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
      <h1 className="text-2xl font-bold text-foreground mb-1">{s.heading}</h1>
      <p className="text-muted-foreground text-sm mb-8">
        {s.subheading.split("EN / ES").map((part, i, arr) =>
          i < arr.length - 1
            ? <span key={i}>{part}<span className="font-semibold text-foreground">EN / ES</span></span>
            : <span key={i}>{part}</span>
        )}
      </p>

      <div className="space-y-5 bg-card border border-border rounded-xl p-6">

        {/* Client First Name */}
        <div className="space-y-1.5">
          <Label htmlFor="input-first-name">{s.labelFirstName}</Label>
          <Input id="input-first-name" data-testid="input-first-name" placeholder={s.placeholderFirstName} value={clientFirstName} onChange={e => setClientFirstName(e.target.value)} />
        </div>

        <hr className="border-border" />

        {/* Trade selector */}
        <div className="space-y-1.5">
          <Label htmlFor="select-trade">{s.labelTrade}</Label>
          <p className="text-xs text-muted-foreground">{s.tradeHint}</p>
          <select
            id="select-trade"
            data-testid="select-trade"
            value={trade}
            onChange={e => setTrade(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TRADE_OPTIONS[lang].map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <hr className="border-border" />

        {/* Business Name */}
        <div className="space-y-1.5">
          <Label htmlFor="input-name">{s.labelName}</Label>
          <Input id="input-name" data-testid="input-name" placeholder={s.placeholderName} value={name} onChange={e => setName(e.target.value)} />
        </div>

        {/* City */}
        <div className="space-y-1.5">
          <Label htmlFor="input-city">{s.labelCity}</Label>
          <Input id="input-city" data-testid="input-city" placeholder={s.placeholderCity} value={city} onChange={e => setCity(e.target.value)} />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="input-phone">{s.labelPhone}</Label>
          <Input id="input-phone" data-testid="input-phone" placeholder={s.placeholderPhone} value={phone} onChange={e => setPhone(e.target.value)} />
        </div>

        {/* CTA */}
        <div className="space-y-1.5">
          <Label htmlFor="input-cta">{s.labelCta}</Label>
          <Input id="input-cta" data-testid="input-cta" placeholder={s.placeholderCta} value={cta} onChange={e => setCta(e.target.value)} />
        </div>

        {/* Logo URL */}
        <div className="space-y-1.5">
          <Label htmlFor="input-logo">{s.labelLogoUrl}</Label>
          <Input id="input-logo" data-testid="input-logo" placeholder={s.placeholderLogo} value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
        </div>

        <hr className="border-border" />

        {/* Plan selector */}
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

        {/* Trade auto-fill info box */}
        <div className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3">
          <p className="text-xs text-primary font-semibold mb-1">{s.tradeAutoFill}:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            <li>✅ Hero image — trade-appropriate Unsplash photo</li>
            <li>✅ About photo — trade-appropriate team photo</li>
            <li>✅ Gallery — 7 trade-appropriate work photos</li>
            <li>✅ Portfolio — 6 trade-specific project cards (Domina)</li>
            <li>✅ 6 Services — trade-specific titles, descriptions &amp; benefits</li>
            <li>✅ 3 Reviews — trade-specific testimonials with {city || "city"} location</li>
            {clientFirstName && <li>✅ Client name — "{clientFirstName}" saved in preview payload</li>}
          </ul>
        </div>

        <Button data-testid="button-generate" className="w-full mt-2" onClick={generateLink}>
          {s.generateBtn}
        </Button>
      </div>

      {/* Generated URL */}
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
            <Button data-testid="button-copy" variant="outline" className="flex-1" onClick={copyLink}>
              {copied
                ? <><CheckCircle size={16} className="mr-2 text-green-600" />{s.copiedBtn}</>
                : <><Copy size={16} className="mr-2" />{s.copyBtn}</>
              }
            </Button>
            <Button data-testid="button-open-preview" variant="outline" className="flex-1" onClick={() => window.open(generatedUrl, "_blank")}>
              <ExternalLink size={16} className="mr-2" />
              {s.openBtn}
            </Button>
          </div>

          {/* Save to Lead */}
          {savedLeadId ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2" data-testid="text-saved-to-lead">
              <Check size={15} className="text-green-600" />
              {s.savedToLeadLabel}
              <a href={`/admin/crm/leads/${savedLeadId}`} className="underline ml-auto">Ver prospecto</a>
            </div>
          ) : (
            <Button
              data-testid="button-save-to-lead"
              variant="outline"
              className="w-full border-[#0D9488] text-[#0D9488] hover:bg-[#0D9488]/5"
              onClick={() => setShowLeadPicker(true)}
            >
              <Link2 size={16} className="mr-2" />
              {s.saveToLeadBtn}
            </Button>
          )}

          <p className="text-xs text-muted-foreground">{s.shareNote}</p>
        </div>
      )}

      {/* Lead picker modal */}
      {showLeadPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" data-testid="modal-lead-picker">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{s.leadPickerTitle}</h3>
              <button onClick={() => setShowLeadPicker(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder={s.leadPickerSearch}
                  className="pl-9"
                  data-testid="input-lead-search"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto px-2 pb-3">
              {filteredLeads.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">{s.leadPickerEmpty}</p>
              ) : (
                filteredLeads.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => saveDemoMutation.mutate(lead.id)}
                    disabled={saveDemoMutation.isPending}
                    className="w-full flex items-start gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    data-testid={`lead-picker-item-${lead.id}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#0D9488]/10 flex items-center justify-center text-[#0D9488] font-bold text-xs flex-shrink-0 mt-0.5">
                      {(lead.contact?.firstName?.[0] || lead.title[0] || "L").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{lead.title}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {lead.company?.name || [lead.contact?.firstName, lead.contact?.lastName].filter(Boolean).join(" ") || "—"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
