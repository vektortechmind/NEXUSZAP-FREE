import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/axios";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../contexts/ToastContext";
import type { IntegrationDashboardResponse } from "../features/dashboard/integrationDashboard";
import {
  EMPTY_INTEGRATION_CREDENTIALS_WORKSPACE,
  getIssuableCredentialInstances,
  type IntegrationCredentialDetail,
  type IntegrationCredentialsWorkspace,
} from "../features/integrations/credentials";
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
  const [credentialsWorkspace, setCredentialsWorkspace] = useState<IntegrationCredentialsWorkspace>(EMPTY_INTEGRATION_CREDENTIALS_WORKSPACE);
  const [expandedCredentialInstanceId, setExpandedCredentialInstanceId] = useState<string | null>(null);
  const [credentialDetail, setCredentialDetail] = useState<IntegrationCredentialDetail | null>(null);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueModalInstanceId, setIssueModalInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialDetailLoading, setCredentialDetailLoading] = useState(false);
  const [credentialActionLoading, setCredentialActionLoading] = useState<"issue" | "rotate" | null>(null);
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

  const loadCredentialDetail = useCallback(async (instanceId: string) => {
    setCredentialDetailLoading(true);
    try {
      const response = await api.get<IntegrationCredentialDetail>(`/dashboard/integrations/credentials/${instanceId}`);
      setCredentialDetail(response.data);
      return true;
    } catch {
      addToast("Erro ao carregar credenciais da instância", "error");
      setCredentialDetail(null);
      return false;
    } finally {
      setCredentialDetailLoading(false);
    }
  }, [addToast]);

  const loadCredentialsWorkspace = useCallback(async (preferredInstanceId?: string | null) => {
    setCredentialsLoading(true);
    try {
      const response = await api.get<IntegrationCredentialsWorkspace>("/dashboard/integrations/credentials");
      setCredentialsWorkspace(response.data);

      setExpandedCredentialInstanceId((current) => {
        const target = preferredInstanceId ?? current;
        if (!target) return null;
        return response.data.instances.some((item) => item.instanceId === target) ? target : null;
      });

      setIssueModalInstanceId((current) => {
        const target = preferredInstanceId ?? current;
        const issuable = getIssuableCredentialInstances(response.data);
        if (target && issuable.some((item) => item.instanceId === target)) return target;
        return issuable[0]?.instanceId ?? null;
      });

      return true;
    } catch {
      addToast("Erro ao carregar workspace de credenciais", "error");
      setCredentialsWorkspace(EMPTY_INTEGRATION_CREDENTIALS_WORKSPACE);
      setExpandedCredentialInstanceId(null);
      setIssueModalInstanceId(null);
      setCredentialDetail(null);
      return false;
    } finally {
      setCredentialsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    let active = true;
    const loadInitialData = async () => {
      const [overviewLoaded, credentialsLoaded] = await Promise.all([
        loadOverview(),
        loadCredentialsWorkspace(),
      ]);
      if (!active) return;
      if (!overviewLoaded) {
        setOverview(EMPTY_INTEGRATIONS);
      }
      if (!credentialsLoaded) {
        setCredentialsWorkspace(EMPTY_INTEGRATION_CREDENTIALS_WORKSPACE);
      }
      setLoading(false);
    };
    void loadInitialData();
    return () => {
      active = false;
    };
  }, [loadCredentialsWorkspace, loadOverview]);

  const refreshOverview = useCallback(async () => {
    setRefreshing(true);
    try {
      const [overviewLoaded] = await Promise.all([
        loadOverview(),
        loadCredentialsWorkspace(expandedCredentialInstanceId),
      ]);
      if (expandedCredentialInstanceId) {
        await loadCredentialDetail(expandedCredentialInstanceId);
      }
      if (overviewLoaded) addToast("Visão operacional atualizada", "success");
    } finally {
      setRefreshing(false);
    }
  }, [addToast, expandedCredentialInstanceId, loadCredentialDetail, loadCredentialsWorkspace, loadOverview]);

  const handleToggleCredentialInstance = useCallback((instanceId: string) => {
    if (expandedCredentialInstanceId === instanceId) {
      setExpandedCredentialInstanceId(null);
      setCredentialDetail(null);
      return;
    }

    setExpandedCredentialInstanceId(instanceId);
    if (credentialDetail?.instanceId === instanceId) return;
    void loadCredentialDetail(instanceId);
  }, [credentialDetail?.instanceId, expandedCredentialInstanceId, loadCredentialDetail]);

  const handleOpenIssueModal = useCallback((instanceId?: string | null) => {
    const issuableInstances = getIssuableCredentialInstances(credentialsWorkspace);
    const nextInstanceId = instanceId && issuableInstances.some((item) => item.instanceId === instanceId)
      ? instanceId
      : issuableInstances[0]?.instanceId ?? null;
    setIssueModalInstanceId(nextInstanceId);
    setIssueModalOpen(true);
  }, [credentialsWorkspace]);

  const handleCloseIssueModal = useCallback(() => {
    setIssueModalOpen(false);
  }, []);

  const handleCopyCredentialField = useCallback(async (label: string, value: string | null) => {
    if (!value) {
      addToast(`${label} indisponível para cópia`, "warning");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      addToast(`${label} copiado`, "success");
    } catch {
      addToast(`Não foi possível copiar ${label}`, "error");
    }
  }, [addToast]);

  const submitCredentialAction = useCallback(async (instanceId: string, action: "issue" | "rotate") => {
    setCredentialActionLoading(action);
    try {
      const response = await api.post<IntegrationCredentialDetail>(`/dashboard/integrations/credentials/${instanceId}/${action}`);
      addToast(action === "issue" ? "secretToken gerado com sucesso" : "secretToken rotacionado com sucesso", "success");
      await loadCredentialsWorkspace(instanceId);
      setExpandedCredentialInstanceId(instanceId);
      setCredentialDetail(response.data);
      if (action === "issue") {
        setIssueModalOpen(false);
      }
    } catch {
      addToast(action === "issue" ? "Erro ao gerar secretToken" : "Erro ao rotacionar secretToken", "error");
    } finally {
      setCredentialActionLoading(null);
    }
  }, [addToast, loadCredentialsWorkspace]);

  if (loading && !overview) {
    return <IntegracoesSkeleton />;
  }

  const data = overview ?? EMPTY_INTEGRATIONS;

  return (
    <IntegrationWorkspacePage
      overview={data}
      credentialsWorkspace={credentialsWorkspace}
      expandedCredentialInstanceId={expandedCredentialInstanceId}
      credentialDetail={credentialDetail}
      issueModalOpen={issueModalOpen}
      issueModalInstanceId={issueModalInstanceId}
      credentialsLoading={credentialsLoading}
      credentialDetailLoading={credentialDetailLoading}
      credentialActionLoading={credentialActionLoading}
      refreshing={refreshing}
      onRefresh={() => void refreshOverview()}
      onToggleCredentialInstance={handleToggleCredentialInstance}
      onOpenIssueModal={handleOpenIssueModal}
      onCloseIssueModal={handleCloseIssueModal}
      onSelectIssueInstance={setIssueModalInstanceId}
      onIssueCredential={(instanceId) => void submitCredentialAction(instanceId, "issue")}
      onRotateCredential={(instanceId) => void submitCredentialAction(instanceId, "rotate")}
      onCopyCredentialField={(label, value) => void handleCopyCredentialField(label, value)}
    />
  );
}
