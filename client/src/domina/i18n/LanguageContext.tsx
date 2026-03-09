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

  // Preview override: merge window.__PREVIEW__.domina into translations.
  // Supports both flat { nav: {...}, home: {...} } and language-aware { en: {...}, es: {...} }.
  // Language-aware format ensures switching to ES returns Spanish override strings.
  const domPreviewRaw = (window as any).__PREVIEW__?.domina || {};
  const domPreview: Record<string, any> =
    (domPreviewRaw.en && domPreviewRaw.es)
      ? (domPreviewRaw[language] || {})
      : domPreviewRaw;
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
