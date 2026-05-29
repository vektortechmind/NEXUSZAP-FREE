# Runtime State Inventory

Este inventário lista os estados efêmeros críticos do backend, seus owners e o contrato esperado em reinício.

| Item | Owner | TTL | Limpeza | Impacto em reinício |
| --- | --- | --- | --- | --- |
| Memória curta de conversa (`MemoryManager`) | `utils/ai/memoryManager.ts` | `CHAT_MEMORY_TTL_MS` ou 6h padrão | poda automática por acesso, limpeza manual por prefixo e limpeza total | não sobrevive; conversas recomeçam sem histórico efêmero |
| Limite de conversas em memória | `utils/ai/memoryManager.ts` | n/a | descarte LRU quando excede `CHAT_MEMORY_MAX_CONVERSATIONS` | não sobrevive; reconstrução não requerida |
| Última mensagem por chat para `chatModify` | `whatsapp/lastMessageCache.ts` | 6h | poda automática por acesso e limpeza por instância | não sobrevive; primeira operação dependente de `lastMessages` aguarda nova mensagem |
| Etiquetas sincronizadas do WhatsApp | `whatsapp/labelsCache.ts` | 12h | poda automática por acesso e limpeza por instância | não sobrevive; etiquetas voltam a popular via eventos do Baileys |
| Runtime de socket WhatsApp (`sock`, `lastQr`, `manualStop`) | `whatsapp/InstanceManager.ts` | enquanto processo vive | reset em stop/logout e reconstrução em boot quando há sessão persistida | reconstruído em boot a partir da sessão persistida |
| Runtime do bot Telegram (`bot`, `currentInstanceId`, `botLabel`) | `telegram/TelegramBotManager.ts` | enquanto processo vive | reset em stop | reconstruído em boot quando há instância persistida com token válido |
| Cache de retry do Baileys (`msgRetryCounterCache`) | `whatsapp/InstanceManager.ts` | vida do socket | descartado ao recriar socket | não sobrevive; é refeito junto com o socket |

## Regras operacionais

- nenhum desses estados pode misturar dados entre instâncias; chaves devem sempre incluir `instanceId` quando aplicável
- estados não persistidos precisam ser tratados explicitamente como descartáveis em reinício
- estados persistíveis críticos devem ter reconstrução determinística no boot ou contrato explícito de não restauração
