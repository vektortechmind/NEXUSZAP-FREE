import { House, MessageCircle, Send, Settings2, Sparkles, Server, Waypoints } from "lucide-react";

export type AppNavItem = {
  name: string;
  path: string;
  icon: typeof House;
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    label: "Operação",
    items: [
      { name: "Dashboard", path: "/dashboard", icon: House },
      { name: "Conversas", path: "/chat", icon: MessageCircle },
      { name: "Disparos", path: "/disparos", icon: Send },
      { name: "Instâncias", path: "/", icon: Server },
      { name: "Integrações", path: "/integracoes", icon: Waypoints },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { name: "Agentes de IA", path: "/agente", icon: Sparkles },
    ],
  },
  {
    label: "Sistema",
    items: [
      { name: "Configurações", path: "/settings", icon: Settings2 },
    ],
  },
];

const ROUTE_META = [
  { match: (path: string) => path === "/", title: "Instâncias" },
  { match: (path: string) => path.startsWith("/dashboard"), title: "Dashboard" },
  { match: (path: string) => path.startsWith("/chat"), title: "Conversas" },
  { match: (path: string) => path.startsWith("/disparos"), title: "Disparos" },
  { match: (path: string) => path.startsWith("/integracoes"), title: "Integrações" },
  { match: (path: string) => path.startsWith("/agente") || path.startsWith("/telegram"), title: "Agentes de IA" },
  { match: (path: string) => path.startsWith("/settings"), title: "Configurações" },
] as const;

export function getAppRouteTitle(pathname: string) {
  return ROUTE_META.find((route) => route.match(pathname))?.title ?? "Instâncias";
}
