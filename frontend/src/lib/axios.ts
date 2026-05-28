import axios from "axios";

const configuredBase = import.meta.env.VITE_API_URL;
const localProdFallback = `http://127.0.0.1:${import.meta.env.VITE_LOCAL_API_PORT || "3000"}/api`;
const base = configuredBase || (import.meta.env.DEV ? "/api" : localProdFallback);

const authRedirect = (err: unknown) => {
  if (axios.isAxiosError(err) && err.response?.status === 401) {
    const path = window.location.pathname;
    if (path !== "/login") {
      window.location.href = "/login";
    }
  }
  return Promise.reject(err);
};

/** Rotas normais (config, status, arquivos). */
export const api = axios.create({
  baseURL: base,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: "csrfToken",
  xsrfHeaderName: "x-csrf-token",
  timeout: 45_000
});

/** Health checks de IA (várias chamadas externas; pode levar > 1 min). */
export const apiLong = axios.create({
  baseURL: base,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: "csrfToken",
  xsrfHeaderName: "x-csrf-token",
  timeout: 120_000
});

api.interceptors.response.use((res) => res, authRedirect);
apiLong.interceptors.response.use((res) => res, authRedirect);
