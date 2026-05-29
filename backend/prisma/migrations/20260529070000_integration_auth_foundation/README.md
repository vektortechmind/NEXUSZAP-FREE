# Story 032 Migration Notes

## Deploy Strategy

1. Run this migration before enabling any ingress endpoint that consumes integration tokens.
2. Generate the Prisma client after deploy with `npm exec prisma generate`.
3. The partial unique index `IntegrationCredential_instanceId_active_key` guarantees a single ACTIVE credential per instance at the database layer.
4. If deploy fails while applying the migration, do not expose the integration surface; the application can keep running without Story 032 features because no existing tables are modified.

## Rollback Strategy

1. Disable any code path that issues or rotates integration credentials.
2. Revoke newly created integration credentials if partial rollout already exposed them.
3. Roll back by dropping, in order:
   - `IntegrationReplayKey`
   - `IntegrationCredential`
   - index `IntegrationCredential_instanceId_active_key`
   - enum `IntegrationCredentialStatus`
4. Regenerate the Prisma client after rollback if the application code is also reverted.

## Operational Note

This migration is additive only. It does not rewrite existing business tables, but the new uniqueness rule means concurrent credential issuance must stay transactional in application code.
