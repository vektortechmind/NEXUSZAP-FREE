import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/axios";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../contexts/ToastContext";
import type { IntegrationDashboardResponse } from "../features/dashboard/integrationDashboard";
import { IntegrationWorkspacePage } from "../features/integrations/IntegrationWorkspacePage";
import { EMPTY_INTEGRATIONS } from "../features/integrations/workspace";

function IntegracoesSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-24" />
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-44" />)}
      </div>
      <Skeleton className="h-[34rem]" />
    </div>
  );
}

export function Integracoes() {
  const [overview, setOverview] = useState<IntegrationDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addToast } = useToast();

  const loadOverview = useCallback(async () => {
    try {
      const response = await api.get<IntegrationDashboardResponse>("/dashboard/integrations");
      setOverview(response.data);
      return true;
    } catch {
      addToast("Erro ao carregar área de integrações", "error");
      return false;
    }
  }, [addToast]);

  useEffect(() => {
    let active = true;
    const loadInitialOverview = async () => {
      const loaded = await loadOverview();
      if (!active) return;
      if (!loaded) {
        setOverview(EMPTY_INTEGRATIONS);
      }
      setLoading(false);
    };
    void loadInitialOverview();
    return () => {
      active = false;
    };
  }, [loadOverview]);

  const refreshOverview = useCallback(async () => {
    setRefreshing(true);
    try {
      const loaded = await loadOverview();
      if (loaded) addToast("Visão operacional atualizada", "success");
    } finally {
      setRefreshing(false);
    }
  }, [addToast, loadOverview]);

  if (loading && !overview) {
    return <IntegracoesSkeleton />;
  }

  const data = overview ?? EMPTY_INTEGRATIONS;

  return (
    <IntegrationWorkspacePage overview={data} refreshing={refreshing} onRefresh={() => void refreshOverview()} />
  );
}
