import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { ChatDemo } from "./ChatDemo";

export function Hero() {
  const handleScroll = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/15 blur-[100px] dark:bg-blue-500/25" />
      <div className="pointer-events-none absolute right-0 top-0 h-[380px] w-[380px] rounded-full bg-violet-500/15 blur-[90px] dark:bg-violet-500/20" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/70 px-3 py-1.5 text-sm font-medium text-blue-700 dark:border-blue-500/30 dark:bg-slate-900/60 dark:text-blue-300">
              <Sparkles className="w-4 h-4" />
              <span>A revolução do atendimento 24/7</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
              Seu WhatsApp vendendo <br className="hidden sm:block" />
              <span className="text-gradient">enquanto você dorme.</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0">
              Atendimento com IA no WhatsApp e Telegram — texto e áudio. Respostas automáticas, rápidas e humanizadas. Pare de perder leads fora do horário comercial.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Button
                size="lg"
                className="w-full gap-2 rounded-full px-8 text-base sm:w-auto"
                onClick={() => handleScroll("#preco")}
              >
                Começar agora
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-full px-8 text-base sm:w-auto"
                onClick={() => handleScroll("#funcionalidades")}
              >
                Ver funcionalidades
              </Button>
            </div>
            
            <p className="mt-6 text-sm text-muted-foreground">
              Sem mensalidades abusivas por atendente. Controle total do seu lado.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="relative mx-auto w-full max-w-md lg:max-w-none"
          >
            <div className="relative z-10">
              <ChatDemo />
            </div>
            {/* Decorative elements around phone */}
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-500/20 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl" />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
