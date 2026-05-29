# Backend Architecture Domains

Esta organização separa o backend por contexto de domínio e por fronteira operacional.

## Contextos principais

- `services/instances/`
  Regras de ciclo de vida, slot, ownership operacional de instâncias e limites do produto.
- `services/agents/`
  Regras de workspace, vínculo com instância, ownership de agente e herança inicial de configuração.
- `services/knowledge/`
  Base de conhecimento por instância, ownership de arquivos, extração e montagem de contexto não confiável.
- `services/runtime-ai/`
  Resolução efetiva de configuração de IA, prompts comportamentais e fallback controlado por canal.
- `services/analytics/`
  Registro de eventos operacionais e agregações para dashboard.

## Fronteiras internas

- `routes/`
  Camada HTTP. Deve orquestrar validação, autenticação e respostas, evitando concentrar regra de negócio.
- `whatsapp/` e `telegram/`
  Adaptadores de canal. Devem consumir serviços de domínio e não concentrar ownership, knowledge flow ou resolução de runtime.
- `ai/`
  Adaptadores de provedores e composição de chamadas de IA. A resolução efetiva de configuração deve vir de `services/runtime-ai/`.
- `database/`
  Infraestrutura de persistência. Prisma não deve vazar desnecessariamente para adaptadores de canal quando houver serviço de domínio apropriado.

## Compatibilidade

Os arquivos legados em `services/*.service.ts` que já eram amplamente importados foram mantidos como fachadas de compatibilidade.

A implementação efetiva agora vive nas subpastas de domínio. Novos fluxos devem preferir os caminhos explícitos por contexto.
