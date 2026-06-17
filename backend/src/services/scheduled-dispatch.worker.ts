import { ChatInstanceOfflineError, ChatProviderSendError } from "./chat.baileys";
import { chatService, createChatService, normalizeChatJid } from "./chat.service";
import {
  createScheduledDispatchService,
  type ScheduledDispatchUrlButton,
  type ScheduledDispatchViewRecord,
  scheduledDispatchService,
} from "./scheduled-dispatch.service";
import { downloadIntegrationImageAsset } from "./integrations/integrationDispatchRuntime.service";
import { InstanceManager } from "../whatsapp/InstanceManager";
import { sendCtaUrlInteractiveMessage, sendNativeInteractiveMessage, type NativeInteractiveRelaySocket } from "../whatsapp/interactiveSender";
import { safeErrorMessage } from "../utils/redaction";

type ScheduledDispatchWorkerDeps = {
  service?: ReturnType<typeof createScheduledDispatchService>;
  chat?: Pick<ReturnType<typeof createChatService>, "sendTextMessage" | "sendMediaMessage">;
  socketLookup?: (instanceId: string) => NativeInteractiveRelaySocket | null;
  mediaDownloader?: typeof downloadIntegrationImageAsset;
  intervalMs?: number;
  batchSize?: number;
};

type ScheduledDispatchExecutionResult = {
  providerMessageId: string | null;
};

function buildRecipientJid(dispatch: ScheduledDispatchViewRecord) {
  if (dispatch.recipientJid) return normalizeChatJid(dispatch.recipientJid);
  if (dispatch.recipientPhone) return normalizeChatJid(dispatch.recipientPhone);
  throw new Error("Disparo sem destino valido.");
}

function buildInteractiveFallbackText(body: string | null, buttons: ScheduledDispatchUrlButton[]) {
  const parts = [body?.trim() ?? "", ...buttons.map((button, index) => `${index + 1}. ${button.text}: ${button.url}`)];
  return parts.filter(Boolean).join("\n");
}

function mimeTypeFromUrl(url: string, contentType: ScheduledDispatchViewRecord["contentType"]) {
  const normalized = url.toLowerCase();
  if (contentType === "IMAGE") {
    if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
    if (normalized.endsWith(".webp")) return "image/webp";
    return "image/png";
  }
  if (normalized.endsWith(".mov")) return "video/quicktime";
  if (normalized.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

function mapFailure(error: unknown) {
  if (error instanceof ChatInstanceOfflineError) {
    return { failureCode: error.code, providerError: error.message };
  }
  if (error instanceof ChatProviderSendError) {
    return { failureCode: error.code, providerError: error.message };
  }
  const message = safeErrorMessage(error, "Falha ao processar disparo agendado.");
  if (/download/i.test(message)) {
    return { failureCode: "SCHEDULED_DISPATCH_MEDIA_DOWNLOAD_FAILED", providerError: message };
  }
  return { failureCode: "SCHEDULED_DISPATCH_RUNTIME_ERROR", providerError: message };
}

export function createScheduledDispatchWorker(deps: ScheduledDispatchWorkerDeps = {}) {
  const service = deps.service ?? scheduledDispatchService;
  const chat = deps.chat ?? chatService;
  const socketLookup = deps.socketLookup ?? ((instanceId: string) => InstanceManager.get(instanceId));
  const mediaDownloader = deps.mediaDownloader ?? downloadIntegrationImageAsset;
  const intervalMs = Math.max(deps.intervalMs ?? 15_000, 1_000);
  const batchSize = Math.min(Math.max(deps.batchSize ?? 10, 1), 100);

  let timer: NodeJS.Timeout | null = null;
  let running = false;

  async function executeDispatch(dispatch: ScheduledDispatchViewRecord): Promise<ScheduledDispatchExecutionResult> {
    const jid = buildRecipientJid(dispatch);
    const buttons = dispatch.buttons;

    if (dispatch.contentType === "TEXT") {
      const body = dispatch.body?.trim();
      if (!body) throw new Error("Disparo de texto sem body valido.");

      if (buttons.length > 0) {
        const sock = socketLookup(dispatch.instanceId);
        if (!sock) throw new ChatInstanceOfflineError(dispatch.instanceId);
        const result = await sendCtaUrlInteractiveMessage(sock, jid, {
          body,
          buttons: buttons.map((button) => ({ text: button.text, url: button.url })),
        }, {
          fallbackText: buildInteractiveFallbackText(body, buttons),
        });
        return { providerMessageId: result.providerMessageId ?? result.fallbackProviderMessageId ?? null };
      }

      const sent = await chat.sendTextMessage({
        instanceId: dispatch.instanceId,
        jid,
        body,
      });
      return { providerMessageId: sent.providerMessageId ?? null };
    }

    if (!dispatch.mediaUrl) {
      throw new Error("Disparo com midia sem mediaUrl valida.");
    }

    const media = await mediaDownloader(dispatch.mediaUrl);
    if (dispatch.contentType === "IMAGE" && buttons.length > 0) {
      const sock = socketLookup(dispatch.instanceId);
      if (!sock) throw new ChatInstanceOfflineError(dispatch.instanceId);
      const result = await sendNativeInteractiveMessage(sock, jid, {
        body: dispatch.body?.trim() || "Abrir conteudo",
        buttons: buttons.map((button) => ({ kind: "cta_url" as const, text: button.text, url: button.url })),
      }, {
        fallbackText: buildInteractiveFallbackText(dispatch.body, buttons),
        headerImageBuffer: media.buffer,
        headerImageMimeType: media.mimeType ?? mimeTypeFromUrl(dispatch.mediaUrl, dispatch.contentType),
      });
      return { providerMessageId: result.providerMessageId ?? result.fallbackProviderMessageId ?? null };
    }

    if (dispatch.contentType === "VIDEO" && buttons.length > 0) {
      throw new Error("Disparo de video nao suporta botoes URL nesta etapa.");
    }

    const sent = await chat.sendMediaMessage({
      instanceId: dispatch.instanceId,
      jid,
      messageType: dispatch.contentType,
      buffer: media.buffer,
      mimeType: media.mimeType ?? mimeTypeFromUrl(dispatch.mediaUrl, dispatch.contentType),
      caption: dispatch.body,
      fileName: dispatch.contentType === "VIDEO" ? "video.mp4" : "imagem",
    });
    return { providerMessageId: sent.providerMessageId ?? null };
  }

  async function processClaimedDispatch(dispatch: ScheduledDispatchViewRecord) {
    try {
      const result = await executeDispatch(dispatch);
      await service.markDispatchSent({
        id: dispatch.id,
        providerMessageId: result.providerMessageId,
        processedAt: new Date(),
      });
    } catch (error) {
      const failure = mapFailure(error);
      await service.markDispatchFailed({
        id: dispatch.id,
        failureCode: failure.failureCode,
        providerError: failure.providerError,
        processedAt: new Date(),
      });
    }
  }

  return {
    async runDue(now = new Date()) {
      if (running) return 0;
      running = true;
      try {
        const claimed = await service.claimDueDispatches({ now, limit: batchSize });
        for (const dispatch of claimed) {
          // react-doctor-disable-next-line react-doctor/async-await-in-loop -- The worker processes claimed jobs sequentially to avoid duplicate socket contention and preserve deterministic status transitions.
          await processClaimedDispatch(dispatch);
        }
        return claimed.length;
      } finally {
        running = false;
      }
    },

    start() {
      if (timer) return;
      timer = setInterval(() => {
        void this.runDue().catch(() => undefined);
      }, intervalMs);
    },

    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
  };
}

export const scheduledDispatchWorker = createScheduledDispatchWorker();
