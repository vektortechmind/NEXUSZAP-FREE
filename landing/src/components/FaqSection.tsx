import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

const faqs = [
  {
    q: "Preciso saber programar para usar?",
    a: "Não para usar o painel diário. No entanto, a instalação inicial requer um mínimo de conhecimento técnico para rodar em um servidor VPS com Node.js."
  },
  {
    q: "Onde ficam armazenados os meus dados e conversas?",
    a: "100% no seu próprio servidor. O NexusZAP utiliza um banco SQLite local, garantindo total privacidade e controle, sem depender da nuvem de terceiros."
  },
  {
    q: "Posso desligar a IA e atender manualmente?",
    a: "Sim! Você pode pausar o bot a qualquer momento e atender manualmente."
  },
  {
    q: "A hospedagem está inclusa no valor?",
    a: "Não. O pagamento único cobre a licença vitalícia do software NexusZAP. Você precisará de um servidor VPS (ex: Hetzner, Contabo, DigitalOcean) para hospedar a aplicação."
  },
  {
    q: "Posso usar minha própria chave de API?",
    a: "Sim! Compatível com Groq, Gemini e OpenRouter. Muitos oferecem APIs gratuitas que permitem iniciar os atendimentos com zero custo."
  }
];

export function FaqSection() {
  return (
    <section id="faq" className="py-24 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-muted-foreground">Tire suas dúvidas sobre o funcionamento do NexusZAP.</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`} className="border-border/50">
                <AccordionTrigger className="text-left text-lg font-medium hover:text-primary hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
