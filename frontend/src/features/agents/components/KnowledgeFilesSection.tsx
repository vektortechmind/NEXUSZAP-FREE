import { AlertCircle, FileText, RefreshCw, Send, Trash2, Upload } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { InlineAlert } from "../../../components/ui/InlineAlert";
import { Panel } from "../../../components/ui/Panel";
import { Section } from "../../../components/ui/Section";
import { Skeleton } from "../../../components/ui/Skeleton";
import type { KnowledgeFile } from "../types";

const KNOWLEDGE_FILE_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

function fileKind(file: KnowledgeFile) {
  return file.mimetype.split("/")[1]?.toUpperCase() || file.mimetype || "DOC";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data indisponível"
    : KNOWLEDGE_FILE_DATE_FORMATTER.format(date);
}

export function KnowledgeFilesSection({
  title,
  description,
  emptyTitle,
  emptyDescription,
  accent = "emerald",
  files,
  loading,
  refreshing,
  error,
  uploading,
  accept,
  uploadLabel,
  uploadHint,
  disabled,
  onUpload,
  onRefresh,
  showRefreshAction = true,
  onRemove,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  accent?: "emerald" | "sky";
  files: KnowledgeFile[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  uploading: boolean;
  accept: string;
  uploadLabel: string;
  uploadHint: string;
  disabled?: boolean;
  onUpload: (file: File) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
  showRefreshAction?: boolean;
  onRemove: (fileId: string) => void | Promise<void>;
}) {
  const isSky = accent === "sky";
  const icon = isSky ? <Send size={22} aria-hidden="true" /> : <FileText size={22} aria-hidden="true" />;
  const labelClass = disabled
    ? "cursor-not-allowed opacity-70"
    : isSky
      ? "cursor-pointer hover:border-sky-400 hover:bg-sky-50/50 focus-within:border-sky-500 dark:hover:border-sky-700 dark:hover:bg-sky-950/20"
      : "cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 focus-within:border-emerald-500 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20";

  return (
    <Section
      title={title}
      description={description}
      actions={showRefreshAction && onRefresh ? (
        <Button variant="ghost" size="sm" onClick={() => void onRefresh()} disabled={refreshing || loading || disabled}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Atualizar
        </Button>
      ) : undefined}
    >
      <Panel className={`p-4 transition-opacity duration-200 ${refreshing ? "opacity-70" : ""}`}>
        <label className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition dark:border-slate-700 dark:bg-slate-950/45 ${labelClass}`}>
          <input
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onUpload(file);
              event.currentTarget.value = "";
            }}
            disabled={uploading || disabled}
          />
          <span className="rounded-lg bg-white p-3 text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
            <Upload className={`h-5 w-5 ${uploading ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true" />
          </span>
          <span className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-50">{uploading ? "Enviando arquivo" : uploadLabel}</span>
          <span className="mt-1 text-xs text-slate-600 dark:text-slate-400">{uploadHint}</span>
        </label>

        {error ? <InlineAlert tone="warning" className="mt-4" icon={<AlertCircle size={16} aria-hidden="true" />}>{error}</InlineAlert> : null}

        <div className="mt-4 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : null}

          {!loading && files.length === 0 && !error ? (
            <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} className="py-8" />
          ) : null}

          {!loading && files.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{file.filename}</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{fileKind(file)} • {formatDate(file.createdAt)}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => void onRemove(file.id)} disabled={disabled} aria-label={`Excluir ${file.filename}`}>
                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>
    </Section>
  );
}
