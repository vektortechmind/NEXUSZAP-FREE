import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export function ExperienceSection() {
  const clientBenefits = [
    "Atendimento instantâneo, 24 horas por dia.",
    "Responde até mensagens de áudio automaticamente.",
    "Linguagem natural, sem menus engessados (digite 1).",
    "Consistência nas respostas sobre produtos/serviços.",
    "Sensação de ser tratado de forma VIP e exclusiva."
  ];

  const businessBenefits = [
    "Controle total dos prompts e contexto da IA.",
    "Escalabilidade infinita: atenda 1 ou 1000 leads simultâneos.",
    "Privacidade: dados ficam no seu próprio servidor SQLite.",
    "Custo reduzido comparado a plataformas de terceiros.",
    "Monitoramento de status da API em tempo real no painel."
  ];

  return (
    <section id="experiencia" className="py-24 bg-background relative border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid md:grid-cols-2 gap-12 lg:gap-24">
          
          {/* Para o cliente */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 lg:p-12 rounded-3xl bg-secondary border border-border/50"
          >
            <h3 className="text-3xl font-bold mb-8 flex items-center gap-3">
              Para o seu <span className="text-primary">cliente</span>
            </h3>
            <ul className="space-y-6">
              {clientBenefits.map((item, idx) => (
                <li key={idx} className="flex gap-4">
                  <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
                  <span className="text-lg text-foreground/90">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Para você */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-8 lg:p-12 rounded-3xl bg-card border border-border/50 shadow-xl"
          >
            <h3 className="text-3xl font-bold mb-8 flex items-center gap-3">
              Para <span className="text-accent">sua equipe</span>
            </h3>
            <ul className="space-y-6">
              {businessBenefits.map((item, idx) => (
                <li key={idx} className="flex gap-4">
                  <CheckCircle2 className="w-6 h-6 text-accent shrink-0" />
                  <span className="text-lg text-foreground/90">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
