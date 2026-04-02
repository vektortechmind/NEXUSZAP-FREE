import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

export function ComparisonTable() {
  const features = [
    { name: "Disponibilidade", human: "Horário comercial", nexus: "24/7 sem interrupções" },
    { name: "Tempo de resposta", human: "Minutos a horas", nexus: "Segundos" },
    { name: "Custo por atendimento", human: "Alto (Salários + Encargos)", nexus: "Mínimo (Custo de API)" },
    { name: "Escalabilidade de Picos", human: false, nexus: true },
    { name: "Controle e Privacidade de Dados", human: "Depende da plataforma", nexus: true },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Por que NexusZAP?
          </h2>
          <p className="text-muted-foreground">Compare o formato tradicional com nossa solução.</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-x-auto rounded-2xl border border-border shadow-sm"
        >
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="p-6 bg-muted/50 border-b border-border font-semibold text-lg w-1/3">Recurso</th>
                <th className="p-6 bg-muted/50 border-b border-border font-semibold text-lg text-muted-foreground w-1/3">Atendimento Tradicional</th>
                <th className="p-6 bg-primary/10 border-b border-border font-bold text-lg text-primary w-1/3">NexusZAP</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                  <td className="p-6 border-b border-border font-medium">{feature.name}</td>
                  <td className="p-6 border-b border-border text-muted-foreground">
                    {typeof feature.human === 'boolean' ? (
                      feature.human ? <Check className="w-5 h-5 text-green-500" /> : <X className="w-5 h-5 text-destructive" />
                    ) : (
                      feature.human
                    )}
                  </td>
                  <td className="p-6 border-b border-border text-foreground font-medium bg-primary/5">
                    {typeof feature.nexus === 'boolean' ? (
                      feature.nexus ? <Check className="w-5 h-5 text-primary" /> : <X className="w-5 h-5 text-destructive" />
                    ) : (
                      feature.nexus
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
