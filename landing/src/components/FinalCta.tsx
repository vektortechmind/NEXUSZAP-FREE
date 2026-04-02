import { motion } from "framer-motion";
import { Button } from "./ui/button";

export function FinalCta() {
  const handleScroll = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDemo = () => {
    window.location.href = "mailto:demo@nexuszap.com";
  };

  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-blue-500/5 dark:bg-blue-500/10" />
      <div className="absolute left-1/2 top-0 -z-10 h-full w-full max-w-4xl -translate-x-1/2 bg-gradient-to-r from-blue-500/25 via-violet-500/25 to-blue-500/25 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass-card rounded-3xl p-10 md:p-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            Pronto para automatizar seu atendimento?
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Junte-se às empresas que já economizam centenas de horas e nunca mais perdem vendas fora do horário comercial.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-14 w-full rounded-full px-8 text-lg sm:w-auto" onClick={() => handleScroll("#preco")}>
              Começar agora
            </Button>
            <Button size="lg" variant="outline" className="h-14 w-full rounded-full px-8 text-lg sm:w-auto" onClick={handleDemo}>
              Agendar demonstração
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
