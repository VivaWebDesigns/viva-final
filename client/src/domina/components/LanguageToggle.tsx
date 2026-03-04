import { useLanguage, type Language } from "@domina/i18n/LanguageContext";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const toggle = () => {
    setLanguage(language === "en" ? "es" : "en");
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
      aria-label={language === "en" ? "Cambiar a español" : "Switch to English"}
      data-testid="button-language-toggle"
    >
      <span className={language === "en" ? "font-bold text-primary" : ""}>EN</span>
      <span className="text-border">|</span>
      <span className={language === "es" ? "font-bold text-primary" : ""}>ES</span>
    </button>
  );
}
