import { useEffect, useState } from "react";
import { api } from "../lib/axios";
import { QrCode, Smartphone, Play, Square, AlertCircle, Bot, MessageCircle, Send, Save, Trash2, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../contexts/ToastContext";

type Status = {
  id: string;
  name: string;
  status: string;
  qr: string | null;
  active: boolean;
  aiWhatsappEnabled: boolean;
  aiTelegramEnabled: boolean;
  telegram?: {
    online: boolean;
    label: string | null;
  };
};

type TelegramStatus = {
  configured: boolean;
  online: boolean;
  label: string | null;
  instanceId?: string;
};

export function Instancia() {
  const [data, setData] = useState<Status | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [token, setToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [testingToken, setTestingToken] = useState(false);
  const { addToast } = useToast();

  const loadStatus = async () => {
    try {
      const [statusRes, telegramRes] = await Promise.all([
        api.get<Status>("/agent/status"),
        api.get<TelegramStatus>("/agent/telegram/status").catch(() => ({ data: { configured: false, online: false, label: null } })),
      ]);
      setData(statusRes.data);
      setTelegramStatus(telegramRes.data);
      setError(null);
    } catch (err) {
      setError("Não foi possível carregar o status da instância");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(() => {
      loadStatus().catch(() => {});
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    if (!data) return;
    setWorking(true);
    try {
      if (data.status === "CONNECTED") {
        await api.post("/agent/stop");
        addToast("Conexão encerrada", "success");
      } else {
        await api.post("/agent/start");
        addToast("Iniciando conexão...", "info");
      }
      await loadStatus();
    } catch {
      addToast("Erro ao alterar status", "error");
    } finally {
      setWorking(false);
    }
  };

  const handleAiToggle = async (channel: "whatsapp" | "telegram") => {
    if (!data) return;
    setWorking(true);
    try {
      const key = channel === "whatsapp" ? "aiWhatsappEnabled" : "aiTelegramEnabled";
      const nextValue = !data[key];
      await api.put("/agent/config", { [key]: nextValue });
      addToast(
        nextValue
          ? `${channel === "whatsapp" ? "WhatsApp" : "Telegram"}: IA ativada`
          : `${channel === "whatsapp" ? "WhatsApp" : "Telegram"}: IA desativada`,
        "success"
      );
      await loadStatus();
    } catch {
      addToast("Erro ao alterar atendimento com IA", "error");
    } finally {
      setWorking(false);
    }
  };

  const handleSaveToken = async () => {
    if (!token.trim()) return;
    setSavingToken(true);
    try {
      const res = await api.post("/agent/telegram/save-token", { token: token.trim() });
      if (res.data.success) {
        addToast("Token salvo e bot iniciado!", "success");
        setToken("");
        await loadStatus();
      }
    } catch (err: any) {
      addToast(err?.response?.data?.error || "Erro ao salvar token", "error");
    } finally {
      setSavingToken(false);
    }
  };

  const handleRemoveToken = async () => {
    if (!confirm("Remover token do Telegram?")) return;
    try {
      await api.delete("/agent/telegram/token");
      addToast("Token removido", "success");
      await loadStatus();
    } catch {
      addToast("Erro ao remover token", "error");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONNECTED": return "success";
      case "DISCONNECTED": return "danger";
      case "RECONNECTING": return "warning";
      default: return "default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "CONNECTED": return "Conectado";
      case "DISCONNECTED": return "Desconectado";
      case "RECONNECTING": return "Reconectando...";
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-32 rounded-lg bg-gray-200 dark:bg-slate-700 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 rounded-lg bg-gray-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-64 rounded-lg bg-gray-200 dark:bg-slate-700 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-8">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">Erro ao carregar status</h3>
            <p className="text-sm text-red-700 dark:text-red-400 mb-4">{error || "Dados não disponíveis"}</p>
            <Button variant="secondary" size="sm" onClick={loadStatus}>Tente novamente</Button>
          </div>
        </div>
      </Card>
    );
  }

  const isOnline = data.status === "CONNECTED";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{data.name}</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie suas conexões</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={getStatusColor(data.status)}>
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isOnline ? "bg-current animate-pulse" : ""}`} />
            {getStatusText(data.status)}
          </Badge>
          <Button onClick={() => void handleToggle()} disabled={working} loading={working} variant={isOnline ? "danger" : "primary"}>
            {isOnline ? <><Square className="w-4 h-4 mr-2" />Desconectar</> : <><Play className="w-4 h-4 mr-2" />Conectar</>}
          </Button>
        </div>
      </div>

      {/* Token Telegram */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Bot Telegram</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure o token do bot para ativar o Telegram
              </p>
            </div>
            {telegramStatus?.configured && (
              <Badge variant={telegramStatus.online ? "success" : "danger"}>
                {telegramStatus.online ? "Online" : "Offline"}
              </Badge>
            )}
          </div>

          {telegramStatus?.configured ? (
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Bot configurado: {telegramStatus.label}
                  </p>
                  <p className="text-xs text-gray-500">Token salvo com segurança</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void handleRemoveToken()}>
                <Trash2 className="w-4 h-4 mr-2" />
                Remover
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Token do Bot (@BotFather)
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Cole o token do seu bot (ex: 123456789:ABCdef...)"
                    className="flex-1 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm text-gray-900 outline-none backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-gray-100"
                  />
                  <Button onClick={() => void handleSaveToken()} disabled={!token.trim() || savingToken} loading={savingToken}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Obtenha o token em: @BotFather → /newbot
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Section */}
        <Card className="lg:col-span-2">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Informações da Instância</h2>
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/70 dark:bg-slate-800/50">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">ID</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{data.id}</p>
                </div>
                <div className="space-y-3 rounded-xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/70 dark:bg-slate-800/50">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Atendimento com IA</p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">WhatsApp</span>
                    </div>
                    <Button size="sm" variant={data.aiWhatsappEnabled ? "danger" : "secondary"} onClick={() => void handleAiToggle("whatsapp")} disabled={working}>
                      {data.aiWhatsappEnabled ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Telegram</span>
                    </div>
                    <Button size="sm" variant={data.aiTelegramEnabled ? "danger" : "secondary"} onClick={() => void handleAiToggle("telegram")} disabled={working || !telegramStatus?.configured}>
                      {data.aiTelegramEnabled ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* QR Code Section */}
        <Card header={<h3 className="font-semibold text-gray-900 dark:text-white">Conexão WhatsApp</h3>}>
          {isOnline ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center mb-3">
                <Smartphone className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Dispositivo Conectado</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pronto para uso</p>
            </div>
          ) : data.qr ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_14px_26px_-20px_rgba(15,23,42,0.6)] dark:border-slate-700/70 dark:bg-white">
                <QRCodeSVG value={data.qr} level="M" includeMargin size={256} bgColor="#ffffff" fgColor="#000000" />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Escaneie com WhatsApp</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <QrCode className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Clique em "Conectar" para gerar o QR code</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
