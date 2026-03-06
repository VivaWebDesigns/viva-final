import { motion } from "framer-motion";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon?: any;
}

export default function PlaceholderPage({ title, description, icon: Icon = Construction }: PlaceholderPageProps) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" data-testid={`text-${title.toLowerCase().replace(/\s+/g, "-")}-title`}>
          {title}
        </h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 p-12 text-center"
      >
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500 max-w-md mx-auto">{description}</p>
        <div className="mt-6 inline-flex items-center gap-2 text-sm text-[#0D9488] bg-[#0D9488]/10 px-4 py-2 rounded-full">
          <Construction className="w-4 h-4" />
          Coming Soon
        </div>
      </motion.div>
    </div>
  );
}
