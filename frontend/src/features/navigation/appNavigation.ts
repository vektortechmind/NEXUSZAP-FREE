import { Bot, Boxes, Cable, KeyRound, LayoutDashboard } from "lucide-react";

export type AppNavItem = {
  name: string;
  path: string;
  icon: typeof LayoutDashboard;
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    label: "Operação",
    items: [
      { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { name: "Instâncias", path: "/", icon: Boxes },
      { name: "Integrações", path: "/integracoes", icon: Cable },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { name: "Agente IA", path: "/agente", icon: Bot },
    ],
  },
  {
    label: "Sistema",
    items: [
      { name: "Configurações", path: "/settings", icon: KeyRound },
    ],
  },
];

const ROUTE_META = [
  { match: (path: string) => path === "/", title: "Instâncias" },
  { match: (path: string) => path.startsWith("/dashboard"), title: "Dashboard" },
  { match: (path: string) => path.startsWith("/integracoes"), title: "Integrações" },
  { match: (path: string) => path.startsWith("/agente") || path.startsWith("/telegram"), title: "Agentes" },
  { match: (path: string) => path.startsWith("/settings"), title: "Configurações" },
] as const;

export function getAppRouteTitle(pathname: string) {
  return ROUTE_META.find((route) => route.match(pathname))?.title ?? "Instâncias";
}
