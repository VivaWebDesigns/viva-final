/**
 * PreviewLangContext
 *
 * Shared context that holds the language selection ("en" | "es") used by the
 * Admin Demo Builder. Both the Navigation (which renders the toggle) and the
 * AdminDemoBuilder page (which reads the value for URL generation) consume
 * this context so they stay in sync without prop-drilling.
 */

import { createContext, useContext, useState, type ReactNode } from "react";

type Lang = "en" | "es";

interface PreviewLangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const PreviewLangContext = createContext<PreviewLangContextType>({
  lang: "en",
  setLang: () => {},
});

export function PreviewLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  return (
    <PreviewLangContext.Provider value={{ lang, setLang }}>
      {children}
    </PreviewLangContext.Provider>
  );
}

export function usePreviewLang() {
  return useContext(PreviewLangContext);
}
