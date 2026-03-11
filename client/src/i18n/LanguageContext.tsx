import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { en } from "./locales/en";
import { es } from "./locales/es";
import type { AdminTranslations } from "./locales/en";

type Lang = "en" | "es";

const STORAGE_KEY = "admin-lang";

const LOCALES: Record<Lang, AdminTranslations> = { en, es };

interface AdminLangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: AdminTranslations;
}

const AdminLangContext = createContext<AdminLangContextType>({
  lang: "en",
  setLang: () => {},
  t: en,
});

export function AdminLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "es") return stored;
    } catch {}
    return "en";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <AdminLangContext.Provider value={{ lang, setLang, t: LOCALES[lang] }}>
      {children}
    </AdminLangContext.Provider>
  );
}

export function useAdminLang() {
  return useContext(AdminLangContext);
}
