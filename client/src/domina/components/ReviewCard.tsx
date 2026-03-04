import { Star, Quote } from "lucide-react";
import { motion } from "framer-motion";

interface ReviewCardProps {
  name: string;
  location: string;
  text: string;
  delay: number;
}

export function ReviewCard({ name, location, text, delay }: ReviewCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      data-testid={`card-review-${name.toLowerCase().replace(/\s+/g, '-')}`}
      className="rounded-md border border-border bg-card p-8 flex flex-col"
    >
      <div className="flex gap-1 text-amber-500 mb-5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} size={18} fill="currentColor" strokeWidth={0} />
        ))}
      </div>

      <div className="relative flex-grow mb-6">
        <Quote size={20} className="text-primary/20 absolute -top-1 -left-1" />
        <p className="text-foreground/80 leading-relaxed pl-5">{text}</p>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm" style={{ fontFamily: 'var(--font-display)' }}>
          {name.charAt(0)}
        </div>
        <div>
          <h4 className="font-semibold text-foreground text-sm">{name}</h4>
          <p className="text-muted-foreground text-xs">{location}</p>
        </div>
      </div>
    </motion.div>
  );
}
