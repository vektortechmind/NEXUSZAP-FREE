import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, User } from "lucide-react";

interface Message {
  from: "user" | "bot";
  text: string;
}

const SCRIPT: Message[] = [
  { from: "user", text: "Oi! Vocês entregam no mesmo dia?" },
  { from: "bot", text: "Olá! Sim, para pedidos até às 14h entregamos hoje na região metropolitana. Quer que eu confira seu CEP?" },
  { from: "user", text: "CEP 01310-100" },
  { from: "bot", text: "Perfeito — atendemos essa região! 🎉 Posso te enviar o link do cardápio?" },
  { from: "user", text: "Sim, por favor!" },
  { from: "bot", text: "Ótimo! Aqui está o cardápio: 📋 cardapio.nexuszap.app — Posso te ajudar com mais alguma coisa?" },
];

export function ChatDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isTyping]);

  // Chat engine
  useEffect(() => {
    if (isPaused) return;

    if (currentIndex >= SCRIPT.length) {
      // Loop after 5s
      const timer = setTimeout(() => {
        setMessages([]);
        setCurrentIndex(0);
      }, 5000);
      return () => clearTimeout(timer);
    }

    const currentMsg = SCRIPT[currentIndex];
    
    if (currentMsg.from === "user") {
      const timer = setTimeout(() => {
        setMessages((prev) => [...prev, currentMsg]);
        setCurrentIndex((prev) => prev + 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Bot typing sequence
      const typingTimer = setTimeout(() => {
        setIsTyping(true);
      }, 500);
      
      const msgTimer = setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, currentMsg]);
        setCurrentIndex((prev) => prev + 1);
      }, 2500); // 2 seconds of typing
      
      return () => {
        clearTimeout(typingTimer);
        clearTimeout(msgTimer);
      };
    }
  }, [currentIndex, isPaused]);

  return (
    <div 
      className="relative w-full max-w-sm mx-auto h-[550px] rounded-[2.5rem] border-[8px] border-card bg-[#0b141a] overflow-hidden shadow-2xl shadow-primary/20"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="log"
      aria-label="Demonstração de conversa automática"
    >
      {/* Phone Header */}
      <div className="absolute top-0 w-full bg-[#202c33] px-4 py-3 flex items-center gap-3 z-10">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center relative">
          <Bot className="w-6 h-6 text-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#25D366] rounded-full border-2 border-[#202c33]"></div>
        </div>
        <div>
          <h3 className="text-white font-medium leading-none mb-1">NexusZAP Bot</h3>
          <p className="text-[#8696a0] text-xs">online</p>
        </div>
      </div>

      {/* Chat Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="absolute inset-0 pt-20 pb-4 px-4 overflow-y-auto custom-scrollbar flex flex-col gap-3"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] p-3 text-sm shadow-sm ${
                  msg.from === 'user' 
                    ? 'bg-[#005c4b] text-white rounded-2xl rounded-tr-sm' 
                    : 'bg-[#202c33] text-white rounded-2xl rounded-tl-sm'
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
          
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex justify-start"
            >
              <div className="bg-[#202c33] p-4 rounded-2xl rounded-tl-sm shadow-sm flex gap-1 items-center">
                <motion.div 
                  className="w-2 h-2 bg-[#8696a0] rounded-full"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                />
                <motion.div 
                  className="w-2 h-2 bg-[#8696a0] rounded-full"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div 
                  className="w-2 h-2 bg-[#8696a0] rounded-full"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Pause indicator */}
      <AnimatePresence>
        {isPaused && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur text-white text-xs px-3 py-1 rounded-full z-20 pointer-events-none"
          >
            Pausado
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
