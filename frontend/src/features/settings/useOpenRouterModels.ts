import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { api } from "../../lib/axios";
import type { OpenRouterModelsResponse } from "./providerSettings";
import { openRouterModelIdSet } from "./providerSettings";

export function useOpenRouterModels(openrouterKey: string | null | undefined) {
  const [debouncedKey, setDebouncedKey] = useState("");
  const [models, setModels] = useState<OpenRouterModelsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelTab, setModelTab] = useState("free");
  const [modelSearch, setModelSearch] = useState("");

  useEffect(() => {
    const key = openrouterKey?.trim() ?? "";
    const timer = window.setTimeout(() => setDebouncedKey(key), 550);
    return () => window.clearTimeout(timer);
  }, [openrouterKey]);

  useEffect(() => {
    if (!debouncedKey || debouncedKey.length < 12) {
      const timer = window.setTimeout(() => {
        setModels(null);
        setError(null);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      setModels(null);
    }, 0);

    api
      .post<OpenRouterModelsResponse>("/agent/openrouter-models", { openrouterKey: debouncedKey }, { signal: controller.signal })
      .then((res) => setModels(res.data))
      .catch((err: unknown) => {
        if (axios.isCancel(err)) return;
        if (axios.isAxiosError(err) && err.code === "ERR_CANCELED") return;
        const msg = axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : "Não foi possível listar os modelos OpenRouter";
        setError(msg);
        setModels(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [debouncedKey]);

  const listedModels = useMemo(() => {
    if (!models) return [];
    const source = modelTab === "free" ? models.free : models.paid;
    const query = modelSearch.trim().toLowerCase();
    if (!query) return source;
    return source.filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(query));
  }, [modelSearch, modelTab, models]);

  const refreshModels = async () => {
    const key = openrouterKey?.trim() ?? "";
    if (key.length < 12) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<OpenRouterModelsResponse>("/agent/openrouter-models", { openrouterKey: key });
      setModels(res.data);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error
        ? String(err.response.data.error)
        : "Não foi possível listar os modelos";
      setError(msg);
      setModels(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    modelTab,
    setModelTab,
    modelSearch,
    setModelSearch,
    models,
    loading,
    error,
    listedModels,
    idSet: openRouterModelIdSet(models),
    refreshModels,
  };
}
