import makeWASocket, {
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import NodeCache from "node-cache";
import P from "pino";
import { prisma } from "../database/prisma";
import { handleIncomingMessage } from "./messageHandler";
import { onInstanceLabelEdit } from "./labelsCache";
import { usePrismaAuthState } from "./prismaAuth";
import { safeLogError } from "../utils/redaction";

export class InstanceManager {
  private static sock: WASocket | null = null;
  private static starting = false;
  /** Evita reconexão automática após parada manual */
  private static manualStop = false;
  /** Último QR (para polling) */
  private static lastQr: string | null = null;

  static getLastQr(): string | null {
    return this.lastQr;
  }

  /**
   * Garante que existe pelo menos um Agente no banco e retorna seu ID.
   */
  private static async getOrCreateDefaultInstance() {
    let instance = await prisma.instance.findFirst();
    if (!instance) {
      instance = await prisma.instance.create({
        data: { name: "Agente Principal" }
      });
    }
    return instance;
  }

  /**
   * Ao subir o servidor: reconecta se houver sessão salva.
   */
  static async loadInstancesOnBoot(): Promise<void> {
    const instance = await prisma.instance.findFirst();
    if (!instance) return;

    // Verifica se existe o registro 'creds' no banco para esta instância
    const session = await prisma.session.findUnique({
      where: { instanceId_key: { instanceId: instance.id, key: "creds" } }
    });

    if (!session) {
      console.log(`[Baileys] Boot: Nenhuma sessão salva para "${instance.name}".`);
      return;
    }

    // Se houver sessão, tentamos conectar automaticamente no boot
    console.log(`[Baileys] Boot: Restaurando sessão do agente "${instance.name}"...`);
    await this.start();
  }

  static async start(onQr?: (qr: string) => void, opts?: { userInitiated?: boolean }) {
    if (this.starting) {
      console.log("[Baileys] start ignorado: inicializacao em andamento.");
      return;
    }
    if (opts?.userInitiated) {
      this.manualStop = false;
    } else if (this.manualStop) {
      console.log("[Baileys] start ignorado: parada manual ativa.");
      return;
    }
    this.starting = true;

    try {
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners("messages.upsert");
          this.sock.ev.removeAllListeners("connection.update");
          await this.sock.logout();
        } catch {
          /* ignore */
        }
        this.sock = null;
      }

      const instance = await this.getOrCreateDefaultInstance();
      const instanceId = instance.id;

      const { state, saveCreds } = await usePrismaAuthState(instanceId);
      const { version } = await fetchLatestBaileysVersion();

      const msgRetryCounterCache = new NodeCache();
      const logger = P({ level: 'silent' }) as any;
      const cachedKeys = makeCacheableSignalKeyStore(state.keys, logger);

      const sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: cachedKeys
        },
        logger,
        msgRetryCounterCache,
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false
      });

      this.sock = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("labels.edit", (label) => {
        onInstanceLabelEdit(instanceId, label);
      });

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.lastQr = qr;
          if (onQr) onQr(qr);
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect =
            !this.manualStop && statusCode !== DisconnectReason.loggedOut;

          console.log(`[Baileys] Conexão fechada. Code: ${statusCode}. ShouldReconnect: ${shouldReconnect}`);

          this.sock = null;

          if (shouldReconnect) {
            await prisma.instance.update({
              where: { id: instanceId },
              data: { status: "RECONNECTING" }
            });
            console.log("[Baileys] Tentando reconectar em 5s...");
            setTimeout(() => {
              void this.start(onQr);
            }, 5000);
          } else {
            await prisma.instance.update({
              where: { id: instanceId },
              data: { status: "DISCONNECTED" }
            });
            this.lastQr = null;
            if (statusCode === DisconnectReason.loggedOut) {
              await prisma.session.deleteMany({
                where: { instanceId }
              });
              console.log("[Baileys] Logout detectado. Sessão limpa.");
            }
          }
        } else if (connection === "open") {
          this.lastQr = null;
          await prisma.instance.update({
            where: { id: instanceId },
            data: { status: "CONNECTED" }
          });
          console.log("[Baileys] Conexão estabelecida com sucesso.");
        }
      });

      sock.ev.on("messages.upsert", async (m) => {
        if (m.type === "notify") {
          for (const msg of m.messages) {
            try {
              await handleIncomingMessage(sock, instanceId, msg);
            } catch (err) {
              console.error("[Baileys] Falha ao processar mensagem:", safeLogError(err));
            }
          }
        }
      });
    } finally {
      this.starting = false;
    }
  }

  static async stop() {
    this.manualStop = true;
    this.lastQr = null;

    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners("messages.upsert");
        this.sock.ev.removeAllListeners("connection.update");
        await this.sock.logout();
      } catch (err) {
        console.error(`[InstanceManager] logout:`, safeLogError(err));
      }
      this.sock = null;
    }

    const instance = await prisma.instance.findFirst();
    if (instance) {
      await prisma.instance.update({
        where: { id: instance.id },
        data: { status: "DISCONNECTED" }
      });
    }

    setTimeout(() => (this.manualStop = false), 8000);
  }

  static get() {
    return this.sock;
  }

  static isRunning(): boolean {
    return !!this.sock;
  }
}
