import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { motion } from "framer-motion";
import { t } from "@/content";

export default function NotFound() {
  const whatsappUrl = t("global.whatsappUrl");

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center px-4" data-testid="page-not-found">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="text-[10rem] font-extrabold leading-none text-transparent bg-clip-text bg-gradient-to-br from-[#0D9488] to-[#14B8A6] select-none" data-testid="text-404">
            404
          </p>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 mb-4" data-testid="text-not-found-title">
            {t("notFound.title")}
          </h1>

          <p className="text-gray-400 text-lg mb-10 max-w-md mx-auto leading-relaxed">
            {t("notFound.desc")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/">
              <Button
                size="lg"
                className="bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg"
                data-testid="button-go-home"
              >
                {t("notFound.goHome")}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a
              href={`${whatsappUrl}?text=${t("notFound.whatsappText")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                variant="outline"
                className="text-white border-white/30 font-bold text-lg gap-2 bg-white/5 rounded-full transition-all duration-200 hover:shadow-lg"
                data-testid="button-not-found-whatsapp"
              >
                <SiWhatsapp className="w-5 h-5" />
                WhatsApp
              </Button>
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
