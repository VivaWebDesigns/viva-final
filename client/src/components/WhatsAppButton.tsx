import { SiWhatsapp } from "react-icons/si";
import { t } from "@/content";

export default function WhatsAppButton() {
  const whatsappUrl = t("global.whatsappUrl");

  return (
    <a
      href={`${whatsappUrl}?text=Hi%2C%20I%27m%20interested%20in%20learning%20more%20about%20your%20services`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] text-white rounded-full pl-4 pr-5 py-3 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
      aria-label="Contact via WhatsApp"
      data-testid="button-whatsapp-float"
    >
      <SiWhatsapp className="w-6 h-6" />
      <span className="text-sm font-bold hidden sm:inline">{t("nav.cta")}</span>
    </a>
  );
}
