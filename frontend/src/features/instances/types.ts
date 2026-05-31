export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";
export type CreateChannel = "WHATSAPP" | "TELEGRAM";

export type InstanceStatus = {
  id: string;
  channel: "WHATSAPP";
  slot: number;
  name: string;
  status: string;
  qr: string | null;
  active: boolean;
  connected: boolean;
  available: boolean;
  occupied: boolean;
  aiWhatsappEnabled: boolean;
  agent: { id: string; name: string } | null;
};

export type TelegramStatus = {
  configured: boolean;
  online: boolean;
  label: string | null;
  instanceId?: string;
  instanceName?: string | null;
  channel?: "TELEGRAM";
};

export type WhatsappCard = {
  key: string;
  id: string;
  channel: "WHATSAPP";
  name: string;
  status: string;
  connected: boolean;
  details: string;
  qr: string | null;
  slot: number;
  occupied: boolean;
  available: boolean;
  aiWhatsappEnabled: boolean;
  agent: { id: string; name: string } | null;
};

export type TelegramCard = {
  key: string;
  id: string;
  channel: "TELEGRAM";
  name: string;
  status: string;
  connected: boolean;
  details: string;
  configured: boolean;
  label: string | null;
  instanceName: string | null;
};

export type ChannelCard = WhatsappCard | TelegramCard;

export type CreateModalState = {
  open: boolean;
  channel: CreateChannel;
  name: string;
  token: string;
  creating: boolean;
  createdInstanceId: string | null;
  createdInstanceName: string | null;
  qr: string | null;
  error: string | null;
};

export const initialCreateModalState: CreateModalState = {
  open: false,
  channel: "WHATSAPP",
  name: "",
  token: "",
  creating: false,
  createdInstanceId: null,
  createdInstanceName: null,
  qr: null,
  error: null,
};
