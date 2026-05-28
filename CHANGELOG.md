# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

## [1.0.1] - 2026-05-28

### Changed

- Tela de login simplificada para exibir apenas o formulário de acesso e a versão do produto.
- Removidos textos institucionais e descrições operacionais da tela de login.
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
