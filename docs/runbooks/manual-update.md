# Runbook de Atualizacao Manual e Rollback

## Objetivo

O painel da aplicacao e somente consultivo para versoes. A aplicacao remota de update foi desativada por seguranca para evitar execucao de codigo a partir de zipballs, tags ou tokens comprometidos.

## Pre-requisitos

- Acesso operacional ao servidor ou pipeline de deploy.
- Release/tag validada pelo responsavel de DevOps.
- Backup recente do banco PostgreSQL.
- Backup ou snapshot do diretorio da aplicacao antes do deploy.
- Variaveis de producao revisadas, incluindo `GITHUB_REPO`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_PASSWORD` e `ENCRYPTION_KEY`.

## Atualizacao Manual

1. Validar a release no GitHub e confirmar autor, tag, changelog e artefatos esperados.
2. Baixar o codigo/artefato em uma estacao ou runner confiavel, fora do processo da aplicacao em execucao.
3. Instalar dependencias em ambiente limpo.
4. Executar os gates: `npm run build`, `npm test --prefix backend` e `npm run lint --prefix frontend`.
5. Criar backup operacional do PostgreSQL e snapshot do diretorio atual da aplicacao.
6. Publicar o novo artefato pelo processo de deploy aprovado.
7. Reiniciar os servicos da aplicacao.
8. Validar logs, healthcheck, login administrativo e fluxo principal do chatbot.

## Rollback Manual

1. Parar os servicos da aplicacao.
2. Restaurar o snapshot/artefato da versao anterior.
3. Restaurar o backup PostgreSQL somente se a migracao alterou dados de forma incompatível.
4. Subir os servicos novamente.
5. Validar healthcheck, login administrativo e fluxo principal do chatbot.
6. Registrar incidente, causa raiz e versao revertida.

## Regras de Seguranca

- Nao aplicar zipball ou release diretamente a partir do backend em runtime.
- Nao registrar token GitHub em logs, respostas HTTP ou mensagens de erro.
- Nao usar `owner/repo` como repositorio em producao.
- Nao executar rollback automatico que mova arquivos da aplicacao sem operador ou pipeline autorizado.
