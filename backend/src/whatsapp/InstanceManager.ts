import makeWASocket, {
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import NodeCache from "node-cache";
import P from "pino";
import { prisma } from "../database/prisma";
import { integrationDispatchReceiptService } from "../services/integrations/integrationDispatchReceipt.service";
import { getOrCreatePrimaryInstance, getPrimaryInstance, listInstances } from "../services/instances/instance.service";
import { safeLogError } from "../utils/redaction";
import { clearLabelsForInstance, getLabelsCacheDiagnostics, onInstanceLabelEdit } from "./labelsCache";
import { clearLastMessagesForInstance, getLastMessageCacheDiagnostics } from "./lastMessageCache";
import { handleIncomingMessage } from "./messageHandler";
import { usePrismaAuthState } from "./prismaAuth";

type InstanceRuntime = {
  sock: WASocket | null;
  starting: boolean;
  manualStop: boolean;
  lastQr: string | null;
  resetManualStopTimer: NodeJS.Timeout | null;
};

export class InstanceManager {
  private static runtimes = new Map<string, InstanceRuntime>();

  private static ensureRuntime(instanceId: string): InstanceRuntime {
    const existing = this.runtimes.get(instanceId);
    if (existing) return existing;

    const created: InstanceRuntime = {
      sock: null,
      starting: false,
      manualStop: false,
      lastQr: null,
      resetManualStopTimer: null,
    };
    this.runtimes.set(instanceId, created);
    return created;
  }

  private static async createSocket(instanceId: string, onQr?: (qr: string) => void) {
    const runtime = this.ensureRuntime(instanceId);
    const [{ state, saveCreds }, { version }] = await Promise.all([
      usePrismaAuthState(instanceId),
      fetchLatestBaileysVersion(),
    ]);

    const msgRetryCounterCache = new NodeCache();
    const logger = P({ level: "silent" }) as any;
    const cachedKeys = makeCacheableSignalKeyStore(state.keys, logger);

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: cachedKeys,
      },
      logger,
      msgRetryCounterCache,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
    });

    runtime.sock = sock;
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("labels.edit", (label) => onInstanceLabelEdit(instanceId, label));

    sock.ev.on("messages.update", async (updates) => {
      for (const update of updates) {
        try {
          await integrationDispatchReceiptService.recordBaileysMessageUpdate(update);
        } catch (err) {
          console.error("[Baileys] Falha ao processar recibo de dispatch:", safeLogError(err));
        }

        try {
          const { chatService } = await import("../services/chat.service");
          await chatService.recordBaileysMessageUpdate(instanceId, update);
        } catch (err) {
          console.error("[Baileys] Falha ao processar recibo do chat:", safeLogError(err));
        }
      }
    });

    sock.ev.on("presence.update", (update) => {
      const jid = typeof update.id === "string" ? update.id : null;
      if (!jid) return;
      const presences = Object.values(update.presences ?? {});
      const isTyping = presences.some((presence) => {
        const state = String(presence.lastKnownPresence ?? "").toLowerCase();
        return state === "composing" || state === "recording";
      });
      void import("../services/chat.service")
        .then(({ chatService }) => chatService.emitPresenceUpdate({ instanceId, jid, isTyping }))
        .catch((err) => console.error("[Baileys] Falha ao emitir presença do chat:", safeLogError(err)));
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        runtime.lastQr = qr;
        onQr?.(qr);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = !runtime.manualStop && statusCode !== DisconnectReason.loggedOut;

        console.log(`[Baileys] Conexão fechada para ${instanceId}. Code: ${statusCode}. ShouldReconnect: ${shouldReconnect}`);
        runtime.sock = null;

        if (shouldReconnect) {
          await prisma.instance.update({
            where: { id: instanceId },
            data: { status: "RECONNECTING" },
          });
          setTimeout(() => {
            this.start(instanceId, onQr).catch((err) => {
              console.error(`[Baileys] Falha ao reconectar instância ${instanceId}:`, safeLogError(err));
            });
          }, 5000);
          return;
        }

        await prisma.instance.update({
          where: { id: instanceId },
          data: { status: "DISCONNECTED" },
        });
        runtime.lastQr = null;

        if (statusCode === DisconnectReason.loggedOut) {
          await prisma.session.deleteMany({ where: { instanceId } });
          clearLastMessagesForInstance(instanceId);
          clearLabelsForInstance(instanceId);
          console.log(`[Baileys] Logout detectado na instância ${instanceId}. Sessão limpa.`);
        }
      }

      if (connection === "open") {
        runtime.lastQr = null;
        await prisma.instance.update({
          where: { id: instanceId },
          data: { status: "CONNECTED" },
        });
        console.log(`[Baileys] Conexão estabelecida com sucesso para ${instanceId}.`);
      }
    });

    sock.ev.on("messages.upsert", async (m) => {
      if (m.type !== "notify") return;

      for (const msg of m.messages) {
        try {
          await handleIncomingMessage(sock, instanceId, msg);
        } catch (err) {
          console.error("[Baileys] Falha ao processar mensagem:", safeLogError(err));
        }
      }
    });
  }

  static getLastQr(instanceId?: string): string | null {
    if (instanceId) return this.ensureRuntime(instanceId).lastQr;

    const primaryRuntime = [...this.runtimes.values()].find((runtime) => runtime.lastQr);
    return primaryRuntime?.lastQr ?? null;
  }

  private static async getOrCreateDefaultInstance() {
    return getOrCreatePrimaryInstance();
  }

  static async loadInstancesOnBoot(): Promise<void> {
    const instances = await listInstances();
    let restored = 0;
    let skipped = 0;

    for (const instance of instances) {
      const session = await prisma.session.findUnique({
        where: { instanceId_key: { instanceId: instance.id, key: "creds" } },
      });

      if (!session) {
        skipped += 1;
        console.log(`[Baileys] Boot: Nenhuma sessão salva para "${instance.name}".`);
        continue;
      }

      console.log(`[Baileys] Boot: Restaurando sessão do agente "${instance.name}"...`);
      await this.start(instance.id);
      restored += 1;
    }

    console.info("[Baileys] Boot: reconstrução de runtime concluída", {
      restored,
      skipped,
      runtimeEntries: this.runtimes.size,
      labelCache: getLabelsCacheDiagnostics(),
      lastMessageCache: getLastMessageCacheDiagnostics(),
    });
  }

  static async start(instanceId?: string, onQr?: (qr: string) => void, opts?: { userInitiated?: boolean }) {
    const instance = instanceId
      ? await prisma.instance.findUnique({ where: { id: instanceId } })
      : await this.getOrCreateDefaultInstance();

    if (!instance) {
      throw new Error("Instância não encontrada.");
    }

    const runtime = this.ensureRuntime(instance.id);
    if (runtime.starting) {
      console.log(`[Baileys] start ignorado para ${instance.id}: inicialização em andamento.`);
      return;
    }

    if (opts?.userInitiated) {
      runtime.manualStop = false;
    } else if (runtime.manualStop) {
      console.log(`[Baileys] start ignorado para ${instance.id}: parada manual ativa.`);
      return;
    }

    if (runtime.sock) {
      console.log(`[Baileys] start ignorado para ${instance.id}: socket já ativo.`);
      return;
    }

    runtime.starting = true;
    if (runtime.resetManualStopTimer) {
      clearTimeout(runtime.resetManualStopTimer);
      runtime.resetManualStopTimer = null;
    }

    try {
      await this.createSocket(instance.id, onQr);
    } finally {
      runtime.starting = false;
    }
  }

  static async stop(instanceId?: string) {
    const instance = instanceId
      ? await prisma.instance.findUnique({ where: { id: instanceId } })
      : await getPrimaryInstance();

    if (!instance) return;

    const runtime = this.ensureRuntime(instance.id);
    runtime.manualStop = true;
    runtime.lastQr = null;

    if (runtime.resetManualStopTimer) {
      clearTimeout(runtime.resetManualStopTimer);
    }

    if (runtime.sock) {
      try {
        runtime.sock.ev.removeAllListeners("messages.upsert");
        runtime.sock.ev.removeAllListeners("messages.update");
        runtime.sock.ev.removeAllListeners("presence.update");
        runtime.sock.ev.removeAllListeners("connection.update");
        await runtime.sock.logout();
      } catch (err) {
        console.error(`[InstanceManager] logout ${instance.id}:`, safeLogError(err));
      }
      runtime.sock = null;
    }

    clearLastMessagesForInstance(instance.id);
    clearLabelsForInstance(instance.id);

    await prisma.instance.update({
      where: { id: instance.id },
      data: { status: "DISCONNECTED" },
    });

    runtime.resetManualStopTimer = setTimeout(() => {
      runtime.manualStop = false;
      runtime.resetManualStopTimer = null;
    }, 8000);
  }

  static get(instanceId?: string) {
    if (instanceId) return this.ensureRuntime(instanceId).sock;
    const primary = [...this.runtimes.values()].find((runtime) => runtime.sock);
    return primary?.sock ?? null;
  }

  static isRunning(instanceId?: string): boolean {
    if (instanceId) return !!this.ensureRuntime(instanceId).sock;
    return [...this.runtimes.values()].some((runtime) => !!runtime.sock);
  }

  static getRuntimeDiagnostics() {
    return {
      runtimes: Array.from(this.runtimes.entries()).map(([instanceId, runtime]) => ({
        instanceId,
        running: !!runtime.sock,
        starting: runtime.starting,
        manualStop: runtime.manualStop,
        hasQr: !!runtime.lastQr,
      })),
      total: this.runtimes.size,
    };
  }
}
