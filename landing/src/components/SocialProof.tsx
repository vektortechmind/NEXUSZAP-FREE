import { motion } from "framer-motion";

export function SocialProof() {
  const logos = [
    "WhatsApp QR",
    "Telegram Bot",
    "Groq AI",
    "Gemini AI",
    "OpenRouter"
  ];

  return (
    <section className="border-y border-slate-200/70 bg-white/35 py-10 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/35">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-muted-foreground mb-6 uppercase tracking-wider">
          Integrações nativas e provedores suportados
        </p>
        
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
          {logos.map((logo, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center gap-2 text-xl font-bold text-slate-700 dark:text-slate-200"
            >
              <div className="h-2 w-2 rounded-full bg-blue-500/80" />
              {logo}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
