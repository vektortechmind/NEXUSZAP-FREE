# NexusZAP - Chatbot com IA v1.0.0

Chatbot inteligente para WhatsApp e Telegram com inteligência artificial, suporte a áudios e painel administrativo completo.

## Funcionalidades

### IA Avançada
- Respostas inteligentes com LLMs (Gemini, Groq, OpenRouter)
- **Processamento de Áudio**: Transcrição e resposta a mensagens de voz
- Base de conhecimento carregável (PDF, DOCX, TXT)
- Personalidade configurável via prompt de sistema

### Canais
- **WhatsApp**: Conexão via QR Code ou link
- **Telegram**: Bot configurável com comandos personalizados
- Respostas automáticas inteligentes
- Digitação simulada para experiência natural

### Painel Administrativo (Dashboard)
- **Dashboard**: Visão geral com estatísticas em tempo real
- **Instâncias**: Gerenciar conexões WhatsApp
- **Agente IA**: Configurar prompts e base de conhecimento
- **Telegram IA**: Configurações específicas do Telegram
- **Configurações**: Chaves de API e preferências

### Segurança
- Autenticação JWT
- Criptografia de chaves sensíveis
- Rate limiting para proteção de APIs

## Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Fastify |
| Banco | SQLite (Prisma ORM) |
| IA | Gemini, Groq, OpenRouter |
| WhatsApp | Baileys |
| Telegram | Bot API |

## Instalação

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Backend

```bash
cd backend
cp .env.example .env
# Edite o .env com suas configurações
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Variáveis de Ambiente

```env
# Backend (.env)
JWT_SECRET=sua-chave-secreta
ADMIN_EMAIL=admin@exemplo.com
ADMIN_PASSWORD=sua-senha
PORT=3000

# APIs de IA (pelo painel ou variáveis)
GEMINI_KEY=sua-chave-gemini
GROQ_KEY=sua-chave-groq
OPENROUTER_KEY=sua-chave-openrouter

# Telegram (opcional)
TELEGRAM_BOT_TOKEN=token-do-bot
```

## Uso

1. Acesse `http://localhost:5173`
2. Faça login com as credenciais do `.env`
3. Conecte uma instância WhatsApp (QR Code ou link)
4. Configure o Agente IA com suas chaves de API
5. Personalize o prompt de sistema
6. Carregue arquivos para a base de conhecimento

## Estrutura do Projeto

```
chatbot/
├── backend/
│   ├── src/
│   │   ├── ai/          # Serviços de IA
│   │   ├── routes/      # API routes
│   │   ├── services/    # Lógica de negócio
│   │   ├── whatsapp/    # Conexão WhatsApp
│   │   └── telegram/    # Bot Telegram
│   └── prisma/          # Schema do banco
├── frontend/
│   ├── src/
│   │   ├── components/  # Componentes React
│   │   ├── pages/       # Páginas do painel
│   │   └── contexts/     # React Context
│   └── public/
└── scripts/             # Scripts auxiliares
```

## API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /api/auth/login | Login |
| GET | /api/agent/status | Status da instância |
| POST | /api/agent/start | Iniciar WhatsApp |
| POST | /api/agent/config | Salvar configuração |
| GET | /api/stats | Estatísticas |
| POST | /api/files/upload | Upload de arquivo |

## Licença

MIT
