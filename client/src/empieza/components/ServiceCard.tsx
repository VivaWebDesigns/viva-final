import { LucideIcon, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-scroll";
import { useLanguage } from "@empieza/hooks/use-language";

interface ServiceCardProps {
  title: string;
  description: string;
  benefits: string[];
  icon: LucideIcon;
  delay: number;
  imageUrl?: string;
}

export function ServiceCard({ title, description, benefits, icon: Icon, delay }: ServiceCardProps) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      data-testid={`card-service-${title.toLowerCase().replace(/\s+/g, '-')}`}
      className="group rounded-md border border-border bg-card p-8 flex flex-col h-full transition-shadow hover:shadow-md"
    >
      <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-6">
        <Icon size={28} />
      </div>

      <h3 className="text-xl font-bold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-grow">{description}</p>

      <ul className="space-y-2 mb-6">
        {benefits.map((benefit, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-foreground/70">
            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            {benefit}
          </li>
        ))}
      </ul>

      <Link
        to="contact"
        smooth={true}
        duration={500}
        offset={-50}
        className="flex items-center gap-2 text-primary text-sm font-semibold cursor-pointer group/link"
        data-testid={`link-service-quote-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {t("getQuote")}
        <ArrowRight size={16} className="group-hover/link:translate-x-1 transition-transform" />
      </Link>
    </motion.div>
  );
}
