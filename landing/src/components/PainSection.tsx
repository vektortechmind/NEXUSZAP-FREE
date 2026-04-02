import { motion } from "framer-motion";
import { Clock, MessageSquare, Users, Cloud } from "lucide-react";
import { Card, CardContent } from "./ui/card";

const pains = [
  {
    icon: <Clock className="w-8 h-8 text-destructive" />,
    title: "Leads fora do horário",
    desc: "Clientes mandando mensagem à noite ou final de semana e desistindo por falta de resposta rápida."
  },
  {
    icon: <MessageSquare className="w-8 h-8 text-accent" />,
    title: "Respostas frias",
    desc: "Chatbots antigos que só aceitam comandos numéricos (1 para X, 2 para Y) frustrando quem quer conversar."
  },
  {
    icon: <Users className="w-8 h-8 text-orange-500" />,
    title: "Equipe sobrecarregada",
    desc: "Seus atendentes gastam horas respondendo as mesmas dúvidas básicas em vez de fechar negócios complexos."
  },
  {
    icon: <Cloud className="w-8 h-8 text-primary" />,
    title: "Dados sem controle",
    desc: "Planos caros de SaaS que sequestram seus dados e cobram por volume de mensagens enviadas."
  }
];

export function PainSection() {
  return (
    <section id="dor" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Você já passou por isso?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            O atendimento humano é insubstituível para fechamentos, mas terrível para triagem e dúvidas de rotina.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pains.map((pain, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
            >
              <Card className="glass-card h-full border-border/50 hover:border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-8">
                  <div className="bg-background rounded-2xl w-16 h-16 flex items-center justify-center mb-6 shadow-sm border border-border/50">
                    {pain.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{pain.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {pain.desc}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
