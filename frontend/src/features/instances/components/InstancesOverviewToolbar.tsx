import { Plus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Toolbar } from "../../../components/ui/Toolbar";
import { StatusDot } from "../../../components/ui/StatusDot";
import { MAX_WHATSAPP_INSTANCES, type StatusTone, type TelegramStatus } from "../types";

function StatusPill({ tone, label, pulse }: { tone: StatusTone; label: string; pulse?: boolean }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
      <StatusDot tone={tone} pulse={pulse} />
      {label}
    </span>
  );
}

export function InstancesOverviewToolbar({
  instancesCount,
  connectedWhatsApp,
  availableWhatsApp,
  telegramStatus,
  onCreate,
}: {
  instancesCount: number;
  connectedWhatsApp: number;
  availableWhatsApp: number;
  telegramStatus: TelegramStatus | null;
  onCreate: () => void;
}) {
  return (
    <Toolbar aria-label="Resumo das instâncias">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="info" label={`${instancesCount}/${MAX_WHATSAPP_INSTANCES} instâncias WhatsApp`} />
            <StatusPill tone={connectedWhatsApp > 0 ? "success" : "neutral"} pulse={connectedWhatsApp > 0} label={`${connectedWhatsApp} conectadas`} />
            <StatusPill tone={availableWhatsApp > 0 ? "info" : "neutral"} label={`${availableWhatsApp} disponíveis`} />
            <StatusPill
              tone={telegramStatus?.online ? "success" : telegramStatus?.configured ? "danger" : "neutral"}
              pulse={telegramStatus?.online}
              label={telegramStatus?.configured ? `Telegram ${telegramStatus.online ? "online" : "offline"}` : "Telegram sem token"}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Cards operacionais por canal</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">A criação de novas instâncias agora acontece por um fluxo guiado, sem bloco fixo acima da grade.</p>
          </div>
        </div>
        <div className="flex w-full justify-start lg:w-auto lg:justify-end">
          <Button onClick={onCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Criar instância
          </Button>
        </div>
      </div>
    </Toolbar>
  );
}
