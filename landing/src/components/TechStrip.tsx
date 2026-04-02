import { motion } from "framer-motion";

export function TechStrip() {
  const badges = [
    "Node.js + Express",
    "JWT Auth + Helmet",
    "SQLite Local DB",
    "100% Self-hosted",
    "Sem limites de uso"
  ];

  return (
    <div className="bg-foreground py-6 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center md:justify-between items-center gap-6">
          {badges.map((badge, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="px-4 py-2 rounded-full bg-background/10 text-background font-medium text-sm border border-background/20 whitespace-nowrap"
            >
              {badge}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
