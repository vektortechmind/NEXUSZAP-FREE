import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export function PricingSection() {
  const handleCheckout = () => {
    alert("Configure o link de compra em: src/components/PricingSection.tsx");
  };

  return (
    <section id="preco" className="relative py-24">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-blue-500/5 dark:to-violet-500/10" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Preço simples e transparente
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Sem pegadinhas. Sem taxas por mensagem. Licença vitalícia: uma instância de WhatsApp e uma de Telegram no painel, com instalações ilimitadas do software nos seus servidores.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto"
        >
          <Card className="glass-card relative overflow-hidden border-blue-200/60 dark:border-blue-500/20">
            <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-blue-600 to-violet-600" />
            
            <CardContent className="p-8 sm:p-10">
              <div className="text-center mb-8">
                <span className="mb-4 inline-block rounded-full bg-blue-500/10 px-3 py-1 text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Licença Completa
                </span>
                <div className="flex flex-wrap items-end justify-center gap-x-1 gap-y-0">
                  <span className="text-3xl font-bold text-muted-foreground mb-2">R$</span>
                  <span className="text-6xl font-bold tracking-tight text-foreground">49</span>
                  <span className="text-2xl font-bold text-muted-foreground mb-2">,99</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                  Pagamento único · licença vitalícia
                </p>
              </div>

              <ul className="space-y-4 mb-8">
                {[
                  "Código completo para self-host",
                  "Passo a passo completo da instalação (documentação inclusa)",
                  "Uma instância WhatsApp e uma instância Telegram no painel; instalações ilimitadas do sistema",
                  "Múltiplos provedores IA (Groq, Gemini, OpenRouter)",
                  "Upload de arquivos para Base de Conhecimento",
                  "Painel Web com Dashboard e Logs",
                  "Banco de dados SQLite protegido",
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-blue-500/15 p-1 dark:bg-blue-400/20">
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button size="lg" className="h-14 w-full text-lg font-bold" onClick={handleCheckout}>
                Comprar Licença
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-3 leading-relaxed">
                Após a compra, o material enviado inclui o guia completo para instalar no seu servidor.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
