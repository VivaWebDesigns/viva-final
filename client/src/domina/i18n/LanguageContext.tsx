import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { en } from "./en";
import { es } from "./es";

export type Language = "en" | "es";

type Translations = typeof en;

const translations: Record<Language, Translations> = { en, es };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("lang");
      if (saved === "en" || saved === "es") return saved;
    } catch {}
    return "en";
  });

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("lang", lang);
    } catch {}
  }, []);

  // Preview override: merge window.__PREVIEW__.domina section overrides into the translations.
  // This lets the /preview/domina page inject custom name, phone, city, CTA, etc.
  // Structure: window.__PREVIEW__.domina = { nav: { phone: "..." }, home: { heroSubtitle: "..." }, ... }
  const domPreview = (window as any).__PREVIEW__?.domina || {};
  const t = Object.keys(domPreview).reduce((acc: any, section: string) => ({
    ...acc,
    [section]: { ...acc[section], ...domPreview[section] }
  }), translations[language] as any) as Translations;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
