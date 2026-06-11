# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

## [1.0.12] - 2026-06-11

### Upgrade notes

Usuarios que ainda estiverem em uma instalacao derivada da `1.0.10` antes da limpeza de historico devem manter a regularizacao unica documentada na `1.0.11` antes de atualizar. Em servidores ja regularizados na linha `1.0.11`, o fluxo normal pelo Update Center ou `./update.sh` pode ser usado.

Se a VPS ainda acusar tags divergentes ou `would clobber existing tag`, rode uma vez na pasta do projeto:

```bash
git fetch --force --prune --prune-tags origin '+refs/heads/*:refs/remotes/origin/*' '+refs/tags/*:refs/tags/*'
git reset --hard origin/main
docker compose -p nexuszap-free up -d --no-deps --build backend frontend
```

Use `sudo` se o projeto estiver em pasta protegida, como `/root/NEXUSZAP-FREE`. O `--no-deps` preserva o Postgres e os volumes de midia.

### Added

- Nova area interna em `Configuracoes` para alterar a senha do administrador logado, sem criar fluxo publico de recuperacao de senha.
- Novo endpoint autenticado `POST /api/auth/change-password`, exigindo sessao, CSRF, senha atual, nova senha forte e confirmacao.
- Cobertura backend para troca de senha com `NEXUS_ENV_FILE` temporario, validando sessao, CSRF, senha atual, senha fraca, confirmacao, persistencia, limpeza de cookies e login antigo/novo.
- Cobertura frontend estrutural para proteger o formulario interno de senha e o contrato do `AuthContext`.

### Changed

- React Doctor foi estabilizado com allowlists/supressoes rastreaveis para awaits sequenciais e registros mecanicos de backend, mantendo score `100/100` nas validacoes recentes.
- Vite dev proxy passou a cobrir `/api` e `/ws/chat` com alvo configuravel por `VITE_DEV_API_TARGET`, preservando uso local contra backend `3000` ou Docker publicado em `3001`.
- Lista de conversas do chat manteve altura/scroll estaveis e leitura da conversa ativa ao receber `conversation:update` realtime.
- Versao do frontend, backend, `backend/VERSION`, README e changelog atualizada para `1.0.12`.

### Fixed

- Corrigida regressao de desenvolvimento local em que o chat realtime podia exibir erro quando o proxy WebSocket do Vite nao encaminhava `/ws/chat`.
- Protegida a troca interna de senha contra chamadas sem sessao, sem CSRF, com senha atual incorreta, senha fraca, confirmacao divergente ou senha nova igual a atual.

## [1.0.11] - 2026-06-10

### Upgrade notes

Usuarios que ja estavam na `1.0.10` devem executar uma regularizacao unica no servidor antes de atualizar, porque as tags do repositorio foram sincronizadas novamente para remover arquivos locais de documentacao do historico Git.

No servidor/VPS, entre na pasta onde esta o `docker-compose.yml` do NexusZAP Free e rode:

```bash
git fetch --force --prune --prune-tags origin '+refs/heads/*:refs/remotes/origin/*' '+refs/tags/*:refs/tags/*'
git reset --hard origin/main
docker compose -p nexuszap-free up -d --no-deps --build backend frontend
```

Use `sudo` antes dos comandos se o projeto estiver em uma pasta protegida, como `/root/NEXUSZAP-FREE`. O `--no-deps` evita recriar o Postgres e preserva os volumes do banco e das midias.

### Added

- Nova implementação do chat no painel para conversas pessoais e grupos do WhatsApp, com suporte ampliado a mensagens e mídias recebidas, incluindo imagem, vídeo, áudio, documento, PDF, GIF em loop e sticker.
- Nova experiência visual de mídias no chat do painel, aproximando GIFs, stickers, documentos, reações e horário das mensagens do comportamento esperado no WhatsApp Web.
- Nova ação local para apagar conversa no painel, limpando as mensagens e removendo o contato da lista local sem executar limpeza remota no WhatsApp.
- Painel usa logo compacta no menu lateral recolhido, preservando a marca mesmo quando a navegação está compactada.

### Changed

- Logo do painel e da tela de login foi aumentada usando assets recortadas para remover margem transparente dos PNGs originais.
- Badge de licença no README foi trocado para `source-available`, alinhado à licença customizada do projeto.
- Backend foi marcado como `private` nos metadados npm para reduzir risco de publicação acidental.
- Versão do frontend, backend, `backend/VERSION`, `README` e changelog atualizada para `1.0.11`.

## [1.0.10] - 2026-06-08

### Added

- Update Center passa a ter botão `Ampliar` nos logs do job, abrindo um popup maior com fonte monoespaçada e rolagem para leitura mais nítida.

### Fixed

- Update Center agora exige Docker Compose V2 antes de alterar containers, bloqueando ambientes com `docker-compose` legado que podem falhar com `KeyError: ContainerConfig`.
- Fluxo Docker do update preserva o Postgres durante atualizações, inicia container existente sem recriar volume e sobe backend/frontend com `--no-deps`.
- Migrations Prisma passam a aguardar Postgres saudável no banco `nexus_chatbot_db` antes de executar.
- Job de update só marca sucesso após validar Postgres, backend e frontend saudáveis, evitando conclusão falsa no painel.
- Painel recupera melhor o estado do job quando o backend reinicia ou o usuário recarrega a página durante uma atualização.

### Changed

- Imagem do backend passa a instalar Docker CLI oficial com plugin Docker Compose V2 para update remoto.
- Healthcheck do Postgres passa a validar explicitamente o banco `nexus_chatbot_db`.
- Versão do frontend, backend, `backend/VERSION`, `README` e artefatos de release atualizada para `1.0.10`.

## [1.0.9] - 2026-06-07

### Added

- Integrações passam a renderizar itens adicionais de order bump em mensagens padrão quando o payload enviar `order_bumps` ou `orderBumps`.
- Normalização aceita nome do item adicional em `name`, `product.name`, `offer.name`, `subscription_plan.name` ou `subscriptionPlan.name`, com valor vindo de `amount`, `total`, `price` ou `value`.

### Changed

- Documentação do painel de integrações passa a listar os campos opcionais de order bump e a regra de renderização nos eventos suportados.
- Versão do frontend, backend, `backend/VERSION`, `README` e artefatos de release atualizada para `1.0.9`.

## [1.0.8] - 2026-06-07

### Fixed

- Update Center preserva a porta HTTP atual do frontend quando ela já pertence ao container `frontend` do projeto Docker Compose, evitando troca indevida de `8081` para outra porta durante recriação do painel.

### Changed

- Versão do frontend, backend, `backend/VERSION`, `README` e artefatos de release atualizada para `1.0.8`.

## [1.0.7] - 2026-06-07

### Fixed

- Update Center agora preserva o projeto Docker Compose `nexuszap-free` quando executado de dentro do backend, evitando conflito com o container `nexus-postgres` existente.
- Verificação e aplicação de migrations no update remoto passam a garantir o Postgres ativo e executar o backend com `--no-deps`, sem tentar recriar dependências já em execução.

### Changed

- Versão do frontend, backend, `backend/VERSION`, `README` e artefatos de release atualizada para `1.0.7`.

## [1.0.6] - 2026-06-07

### Added

- Limite operacional de instâncias WhatsApp aumentado para 5, preservando Telegram fora da contagem e slots WhatsApp ordenados de 1 a 5.
- Teste dedicado para proteger criação da 4ª/5ª instância, rejeição da 6ª e reaproveitamento do menor slot livre.

### Fixed

- Corrigida corrida de autenticação no login que podia deixar a transição para o painel inconsistente até recarregar a página.

### Changed

- Frontend passa a exibir capacidade e mensagens de criação usando o limite de 5 instâncias WhatsApp.
- Versão do frontend, backend, `backend/VERSION`, `README` e artefatos de release atualizada para `1.0.6`.

## [1.0.5] - 2026-05-31

### Added

- Templates de integracao agora podem usar botoes nativos internos para acoes ja existentes: `cta_url` em links e `cta_copy` em Pix copia e cola/linha digitavel de boleto.
- Auditoria de dispatch passou a registrar `interactiveButtonKinds`, `interactiveButtonCount`, caminhos interativos nativos e `skipped_interactive_button` quando a segunda mensagem Pix/Boleto foi substituida por botao.
- Normalizacao de integracoes passa a aceitar imagem do produto tambem em `product_image_url`, `productImageUrl`, `product.*` no topo do payload e aliases equivalentes nos blocos `order`, `checkout_session` e `subscription`.

### Fixed

- Eventos de integracao com imagem valida preservam o envio da imagem mesmo quando botoes interativos automaticos tambem sao gerados.
- Eventos de integracao com imagem e botoes automaticos agora tentam enviar mídia e botoes no mesmo payload interativo quando o socket suporta upload de mídia para native flow.
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
