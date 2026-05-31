# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

## [1.0.5] - 2026-05-31

### Added

- Templates de integracao agora podem usar botoes nativos internos para acoes ja existentes: `cta_url` em links e `cta_copy` em Pix copia e cola/linha digitavel de boleto.
- Auditoria de dispatch passou a registrar `interactiveButtonKinds`, `interactiveButtonCount`, caminhos interativos nativos e `skipped_interactive_button` quando a segunda mensagem Pix/Boleto foi substituida por botao.

### Fixed

- O Update Center não exibe mais os botões `Verificar` e `Atualizar` enquanto um job de atualização remoto está ativo, evitando nova checagem manual durante a instalação/update em andamento.
- Update remoto pelo painel agora acompanha o job por endpoint leve, recupera melhor o estado após recriação do backend e evita installs/builds locais duplicados quando o deploy roda via Docker.
- Instalação inicial não exibe mais login/senha temporários como credencial de uso e bloqueia login enquanto o primeiro administrador não for criado pelo fluxo `/criar-admin`.

### Changed

- Versão do frontend, backend, `backend/VERSION`, `README` e artefatos de release atualizada para `1.0.5`.

## [1.0.4] - 2026-05-31

### Added

- Suporte ao provedor `OpenAI` no runtime de IA usando a Responses API oficial.
- Nova configuração segura `openaiKey` por instância, com criptografia, máscara em resposta e teste de saúde em `/api/agent/providers-health`.
- Campo `openaiModel` para definir modelo OpenAI globalmente, por instância ou por agente; quando vazio, o padrão interno é `gpt-5`.
- Migração Prisma para persistir `openaiKey` e `openaiModel` em `Instance` e `openaiModel` em `Agent`.
- Interface para cadastrar chave OpenAI, selecionar OpenAI como provedor preferencial e ajustar modelo no workspace do agente.
- Guia de chaves de API atualizado com instruções de configuração da OpenAI.

### Changed

- Fallback automático de IA passa a considerar `Groq -> Gemini -> OpenRouter -> OpenAI`.
- Documentação principal atualizada para listar OpenAI entre os provedores suportados.
- Versão do frontend, backend, `backend/VERSION`, `README` e artefatos de release atualizada para `1.0.4`.

## [1.0.3] - 2026-05-29

### Added

- Modelo de autenticação de integrações por instância com persistência dedicada no backend.
- Endpoint de ingress para eventos de plugin com normalização e trilha operacional de recebimento.
- Catálogo oficial de eventos suportados para integrações e templates predefinidos de dispatch.
- Observabilidade de dispatch em runtime com histórico operacional para integrações Baileys.
- Endpoint `GET /api/dashboard/integrations` e visão consolidada no dashboard para credenciais, ingressos, dispatches e saúde operacional.
- Teste leve do estado do dashboard de integrações no frontend e suíte de API para os fluxos de integração no backend.

### Changed

- Gates de qualidade do projeto passaram a expor `npm run lint` e `npm run typecheck` no nível raiz.
- Dashboard principal passou a exibir um overview operacional de integrações sem exigir navegação para uma tela separada.
- Documentação e artefatos públicos de integração foram consolidados para refletir o fluxo atual do plugin/API.
- Versão do frontend, backend, `backend/VERSION`, `README` e artefatos de release atualizada para `1.0.3`.

## [1.0.2] - 2026-05-28

### Added

- Controle por agente para habilitar ou desabilitar a transcrição de áudio recebida do cliente.
- Nova opção na configuração do agente para aplicar a transcrição usando o provedor já definido no runtime da instância.

### Changed

- Fluxo de transcrição de áudio passou a respeitar o toggle do agente sem criar um runtime de voz separado da instância WhatsApp.
- Stories `011` e `012` foram validadas em QA e fechadas no backlog de documentação.
- Versão do frontend, backend, `backend/VERSION`, `README` e artefatos de release atualizada para `1.0.2`.

## [1.0.1] - 2026-05-28

### Changed

- Versão do frontend, backend e artefatos de documentação atualizada para `1.0.1`.

## [Unreleased] - Local em preparação para Git

Base de comparação: `https://github.com/vektortechmind/NEXUSZAP-FREE.git` no commit `992a82d46fe94349d50bfcfe94fb494c46ba3f95` (`2026-04-03 04:44:55 -0300`).

### Added

- Dockerização do projeto com `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` e `frontend/nginx.conf`.
- Scripts oficiais de instalação e atualização para VPS/Linux: `install.sh` e `update.sh`.
- Geração automática de segredos operacionais quando ausentes, incluindo `JWT_SECRET` e `ENCRYPTION_KEY`.
- Fluxo guiado de primeira configuração por navegador em `/docker-setup` e `/criar-admin`, protegido por `SETUP_TOKEN`.
- Arquivo `backend/VERSION` para versionamento fora do `.env`.
- Migração inicial PostgreSQL em `backend/prisma/migrations/20260527000000_init_postgresql/migration.sql`.
- Testes e validações de segurança para autenticação, segredos, upload de arquivos, prompt injection, update bloqueado e limpeza operacional PostgreSQL.
- Camada de segurança para prompt injection em `backend/src/ai/promptGuard.ts`.
- Serviços de segurança para arquivos, segredos de agente, conhecimento, redação de dados sensíveis e tratamento de erros Prisma.
- Design system do frontend em `frontend/src/components/ui/` com shell, painéis, métricas, tabelas, abas, estados vazios, skeletons e alertas inline.
- Redesign premium das telas de login, dashboard, instâncias, agente, APIs/configurações, Telegram e update center.

### Changed

- Banco de dados principal migrado do fluxo SQLite para PostgreSQL com Prisma Migrate.
- Scripts de banco do backend ajustados para usar `prisma migrate deploy` no fluxo de produção.
- Stack Fastify, plugins, Baileys, Axios, Dotenv, Zod, Pino, React, Vite, Tailwind, ESLint e TypeScript atualizada.
- Fluxos de WhatsApp, Telegram, IA, dashboard, upload de arquivos, autenticação e update foram revisados e endurecidos.
- Frontend reorganizado com navegação, app shell, tema separado em `ThemeContext.ts`, `ThemeProvider.tsx` e `useTheme.ts`.
- Scripts de instalação/update apontam para o repositório correto `https://github.com/vektortechmind/NEXUSZAP-FREE.git`.
- Fluxo de update preserva `.env` e arquivos operacionais sensíveis para evitar reset de instâncias em produção.
- `.env.example` do backend e frontend atualizado para refletir variáveis atuais.

### Removed

- Dependência operacional de SQLite; o arquivo remoto `backend/src/database/sqlitePragmas.ts` não faz parte da estrutura local atual.
- Scripts PowerShell antigos do baseline remoto: `clean-repo.ps1`, `diagnose.ps1`, `setup-env.ps1`, `setup.ps1`, `start-backend-direct.ps1` e `start.ps1`.
- Rota remota `backend/src/routes/stats.routes.ts`, substituída pelo fluxo atual de dashboard/observabilidade.
- Dependências `unzipper` e `@types/unzipper` do backend.

### Security

- Segredos de configuração tratados como dados sensíveis, com preservação no ambiente e redação em respostas/logs.
- Uploads de arquivos passam por validações adicionais de segurança.
- Aplicação automática de update foi bloqueada/endurecida para reduzir risco de supply chain.
- Proteções de sessão, origem, cookies, rate limit e autenticação foram revisadas no backend.

### Git Hygiene

- `.gitignore` reforçado para bloquear arquivos sensíveis, dependências, builds, logs, caches, artefatos locais de agentes/IDEs e arquivos temporários.
- `CHANGELOG-LOCAL-vs-REMOTE.md` mantido como artefato local de auditoria e fora do Git; este `CHANGELOG.md` é o arquivo oficial para versionamento.
- Removidos scripts e menções de instalação local; o fluxo oficial documentado agora é somente VPS/Linux.

### Comparison Summary

- Arquivos novos apenas no local: `46`.
- Arquivos existentes apenas no remoto: `9`.
- Arquivos modificados no local: `84`.
- Arquivos idênticos: `4`.
