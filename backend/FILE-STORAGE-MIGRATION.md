# File Storage Migration And Rollback

## Objetivo

Migrar o armazenamento principal dos binários de conhecimento do PostgreSQL para filesystem local estruturado, preservando metadados e compatibilidade de leitura para registros legados.

## Novo contrato

- binário principal: filesystem local do servidor
- banco: ownership, `instanceId`, `agentId`, `channel`, `filename`, `mimetype`, `storagePath`, `sizeBytes`, `extracted`
- coluna `data`: mantida apenas como fallback temporário de compatibilidade para arquivos legados durante a transição

## Estrutura de diretórios

Raiz padrão:

- `backend/storage/knowledge/`

Estrutura por arquivo:

- `<channel>/<instanceId>/<fileId>-<filename-sanitizado>`

Exemplos:

- `whatsapp/instance-a/uuid-manual.pdf`
- `telegram/instance-b/uuid-base-conhecimento.txt`

## Plano de migração incremental

1. aplicar a migration que adiciona `storagePath` e `sizeBytes`, e torna `data` opcional
2. publicar a versão da aplicação com escrita principal no filesystem e leitura com fallback para `data`
3. executar rotina operacional de backfill para arquivos legados:
   - ler `data` do banco
   - gravar binário em `storagePath`
   - preencher `sizeBytes`
   - manter `data` até validação final
4. validar amostragem de download e extração
5. após estabilização operacional, opcionalmente limpar `data` dos registros já migrados

## Rollback

Rollback de aplicação:

- voltar para a versão anterior ainda compatível com leitura de `data`

Rollback de dados:

- como `data` permanece preservado na fase incremental, o sistema antigo continua conseguindo servir os arquivos já existentes
- se um arquivo novo foi salvo apenas no filesystem e ainda não houver rotina de réplica para `data`, o rollback exige manter a versão nova até concluir backfill reverso ou reexecutar upload

## Observações operacionais

- a segregação por `instanceId` continua obrigatória no path
- backups precisam incluir banco e diretório `storage/knowledge`
- arquivos órfãos em disco devem ser tratados por rotina administrativa posterior, fora desta story
