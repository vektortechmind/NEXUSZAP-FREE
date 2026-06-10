import { FileText, Image, Mic, Paperclip, SendHorizontal, Square, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import type { ChatMessage } from "./types";
import { getMessagePreviewText } from "./chatDisplay";

type ChatMediaType = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";

type ChatInputProps = {
  disabled?: boolean;
  sending?: boolean;
  replyingTo?: ChatMessage | null;
  onCancelReply?: () => void;
  onSend: (body: string) => Promise<void> | void;
  onSendMedia?: (input: { file: File; messageType: ChatMediaType; caption?: string | null }) => Promise<void> | void;
};

type PendingMedia = {
  file: File;
  messageType: Exclude<ChatMediaType, "AUDIO">;
  previewUrl: string | null;
};

function getRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function formatRecordingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function mediaTypeFromFile(file: File): Extract<ChatMediaType, "IMAGE" | "VIDEO"> {
  return file.type.toLowerCase().startsWith("video/") ? "VIDEO" : "IMAGE";
}

export function ChatInput({ disabled, sending, replyingTo, onCancelReply, onSend, onSendMedia }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelRecordingRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const busy = Boolean(disabled || sending);
  const canSend = Boolean(value.trim() || pendingMedia);
  const recordingSupported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";

  const stopRecordingTimer = () => {
    if (!recordingTimerRef.current) return;
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  };

  const cleanupRecording = () => {
    stopRecordingTimer();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    cancelRecordingRef.current = false;
    setRecording(false);
    setRecordingSeconds(0);
  };

  useEffect(() => () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => () => {
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
  }, [pendingMedia?.previewUrl]);

  const clearPendingMedia = () => {
    setPendingMedia((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  };

  const submit = async () => {
    const body = value.trim();
    if (pendingMedia) {
      if (busy || recording || !onSendMedia) return;
      const caption = value.trim() || null;
      const media = pendingMedia;
      clearPendingMedia();
      setValue("");
      await onSendMedia({ file: media.file, messageType: media.messageType, caption });
      return;
    }
    if (!body || busy || recording) return;
    setValue("");
    await onSend(body);
  };

  const selectPendingMedia = (file: File | undefined, messageType: Exclude<ChatMediaType, "AUDIO">) => {
    if (!file || busy || !onSendMedia) return;
    clearPendingMedia();
    const previewUrl = messageType === "DOCUMENT" ? null : URL.createObjectURL(file);
    setPendingMedia({ file, messageType, previewUrl });
  };

  const submitMedia = async (file: File | undefined, messageType: ChatMediaType) => {
    if (!file || busy || !onSendMedia) return;
    const caption = messageType === "AUDIO" ? null : value.trim() || null;
    setValue("");
    await onSendMedia({ file, messageType, caption });
  };

  const startRecording = async () => {
    if (busy || recording || !onSendMedia) return;
    if (!recordingSupported) {
      window.alert?.("Gravacao de audio nao suportada neste navegador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      cancelRecordingRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const cancelled = cancelRecordingRef.current;
        const chunks = chunksRef.current;
        const type = recorder.mimeType || mimeType || "audio/webm";
        cleanupRecording();
        if (cancelled || chunks.length === 0) return;
        const extension = type.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunks, { type });
        const file = new File([blob], `gravacao-${Date.now().toString(36)}.${extension}`, { type });
        void submitMedia(file, "AUDIO");
      };
      recorder.start();
      setAttachmentsOpen(false);
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((current) => current + 1), 1000);
    } catch (err) {
      cleanupRecording();
      console.error(err);
      window.alert?.("Nao foi possivel acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;
    recorderRef.current.stop();
  };

  const cancelRecording = () => {
    cancelRecordingRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      return;
    }
    cleanupRecording();
  };

  return (
    <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      {replyingTo ? (
        <div className="mb-2 flex items-center gap-2 rounded-md border-l-4 border-emerald-500 bg-slate-100 px-3 py-2 dark:bg-slate-900">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Respondendo {replyingTo.fromMe ? "Voce" : "contato"}</p>
            <p className="truncate text-xs text-slate-600 dark:text-slate-400">{getMessagePreviewText(replyingTo)}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800"
            aria-label="Cancelar resposta"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="relative flex items-end gap-2">
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/mpeg,video/quicktime,video/webm,video/3gpp"
          className="sr-only"
          disabled={busy || !onSendMedia}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) selectPendingMedia(file, mediaTypeFromFile(file));
          }}
        />
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          disabled={busy || !onSendMedia}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            selectPendingMedia(file, "DOCUMENT");
          }}
        />

        {attachmentsOpen ? (
          <div className="absolute bottom-14 left-0 z-20 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => {
                setAttachmentsOpen(false);
                mediaInputRef.current?.click();
              }}
            >
              <Image size={17} aria-hidden="true" />
              <span>Fotos e videos</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => {
                setAttachmentsOpen(false);
                documentInputRef.current?.click();
              }}
            >
              <FileText size={17} aria-hidden="true" />
              <span>Documento</span>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setAttachmentsOpen((current) => !current)}
          disabled={busy || recording || !onSendMedia}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-emerald-300"
          aria-label="Anexar"
          title="Anexar"
        >
          <Paperclip size={20} aria-hidden="true" />
        </button>

        {recording ? (
          <div className="flex min-h-11 flex-1 items-center gap-3 rounded-full border border-red-200 bg-red-50 px-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" aria-hidden="true" />
            <span className="font-semibold">{formatRecordingTime(recordingSeconds)}</span>
            <span className="min-w-0 flex-1 truncate">Gravando audio</span>
            <button type="button" onClick={cancelRecording} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/40" aria-label="Cancelar gravacao">
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ) : pendingMedia ? (
          <div className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
            {pendingMedia.messageType === "IMAGE" && pendingMedia.previewUrl ? (
              <img src={pendingMedia.previewUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
            ) : null}
            {pendingMedia.messageType === "VIDEO" && pendingMedia.previewUrl ? (
              <video src={pendingMedia.previewUrl} className="h-14 w-14 rounded-xl object-cover" muted playsInline />
            ) : null}
            {pendingMedia.messageType === "DOCUMENT" ? (
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                <FileText size={24} aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{pendingMedia.file.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {pendingMedia.messageType === "DOCUMENT" ? "Documento" : pendingMedia.messageType === "VIDEO" ? "Video" : "Foto"}
              </p>
            </div>
            <button type="button" onClick={clearPendingMedia} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800" aria-label="Remover anexo">
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <label className="sr-only" htmlFor="chat-message-input">Mensagem</label>
            <textarea
              id="chat-message-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              disabled={busy}
              rows={1}
              placeholder="Digite uma mensagem"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-full border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </>
        )}

        {canSend && !recording ? (
          <Button type="button" size="md" disabled={busy} loading={sending} aria-label="Enviar mensagem" onClick={() => void submit()} className="h-12 w-12 rounded-full px-0 shadow-md shadow-emerald-900/15">
            <SendHorizontal size={21} strokeWidth={2.6} aria-hidden="true" />
          </Button>
        ) : (
          <button
            type="button"
            onClick={recording ? stopRecording : () => void startRecording()}
            disabled={busy || !onSendMedia || (!recording && !recordingSupported)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
            aria-label={recording ? "Enviar gravacao" : "Gravar audio"}
            title={recording ? "Enviar gravacao" : "Gravar audio"}
          >
            {recording ? <Square size={16} fill="currentColor" aria-hidden="true" /> : <Mic size={19} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}
