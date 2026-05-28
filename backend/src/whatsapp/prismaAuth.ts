import {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
  proto
} from "@whiskeysockets/baileys";
import { prisma } from "../database/prisma";
import { safeLogError } from "../utils/redaction";

/**
 * Adaptador customizado para armazenar o estado de autenticação do Baileys no Prisma.
 */
export async function usePrismaAuthState(instanceId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> {
  
  const writeData = async (data: any, key: string) => {
    const value = JSON.stringify(data, BufferJSON.replacer);
    await prisma.session.upsert({
      where: {
        instanceId_key: { instanceId, key }
      },
      update: { value },
      create: { instanceId, key, value }
    });
  };

  const readData = async (key: string) => {
    try {
      const session = await prisma.session.findUnique({
        where: {
          instanceId_key: { instanceId, key }
        }
      });
      if (!session) {
        if (key === "creds") console.log(`[PrismaAuth] ⚠️ Nenhuma credencial encontrada para ${instanceId}`);
        return null;
      }
      if (key === "creds") console.log(`[PrismaAuth] ✅ Credenciais encontradas para ${instanceId}`);
      return JSON.parse(session.value, BufferJSON.reviver);
    } catch (error) {
      console.error(`[PrismaAuth] ❌ Erro ao ler chave ${key}:`, safeLogError(error));
      return null;
    }
  };

  const removeData = async (key: string) => {
    try {
      await prisma.session.delete({
        where: {
          instanceId_key: { instanceId, key }
        }
      });
    } catch (error) {
      // Ignorar se não existir
    }
  };

  const creds: AuthenticationCreds = await readData("creds") || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const _category in data) {
            const category = _category as keyof typeof data;
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(value, key) : removeData(key));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => writeData(creds, "creds")
  };
}
