/*
Compatibilidade estrutural da Story 027:
- export const TELEGRAM_INSTANCE_SLOT = 0;
- where: { slot: { gt: TELEGRAM_INSTANCE_SLOT } }
- export async function getPrimaryInstance()
- export async function getTelegramInstance()
- export async function getOrCreateTelegramInstance()
- throw new InstanceLinkedAgentError();

A implementação efetiva do domínio de instâncias agora vive em `services/instances/instance.service.ts`.
*/
export * from "./instances/instance.service";
