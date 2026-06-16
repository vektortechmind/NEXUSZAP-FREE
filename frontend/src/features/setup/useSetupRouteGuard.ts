import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/axios";

type SetupStatusResponse = {
  adminSetupRequired: boolean;
  setupTokenRequired: boolean;
  setupCompleted?: boolean;
  setupOpen?: boolean;
};

type SetupRouteGuardState = {
  checking: boolean;
  error: string;
};

function buildStatusUrl(search: string): string {
  const token = new URLSearchParams(search).get("token");
  if (!token) return "/setup/status";
  return `/setup/status?token=${encodeURIComponent(token)}`;
}

function isSetupStillOpen(status: SetupStatusResponse): boolean {
  if (typeof status.setupOpen === "boolean") {
    return status.setupOpen;
  }

  return Boolean(status.setupTokenRequired && status.adminSetupRequired && !status.setupCompleted);
}

function setupStatusError(error: unknown): string {
  if (!isAxiosError(error)) return "Nao foi possivel verificar o status da instalacao.";
  if (!error.response) return "A API nao respondeu ao verificar o status da instalacao.";
  return (error.response.data as { error?: string } | undefined)?.error ?? "Nao foi possivel verificar o status da instalacao.";
}

export function useSetupRouteGuard(): SetupRouteGuardState {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [state, setState] = useState<SetupRouteGuardState>({ checking: true, error: "" });

  useEffect(() => {
    let active = true;

    const verifySetup = async () => {
      try {
        const response = await api.get<SetupStatusResponse>(buildStatusUrl(search));
        if (!active) return;

        if (!isSetupStillOpen(response.data)) {
          navigate("/login", { replace: true });
          return;
        }

        setState({ checking: false, error: "" });
      } catch (error) {
        if (!active) return;
        setState({ checking: false, error: setupStatusError(error) });
      }
    };

    setState({ checking: true, error: "" });
    void verifySetup();

    return () => {
      active = false;
    };
  }, [navigate, search]);

  return state;
}
