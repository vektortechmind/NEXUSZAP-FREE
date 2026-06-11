import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { api } from "../lib/axios";

/** Payload JWT retornado por `/api/auth/me` */
export type AuthUser = {
  email: string;
  role: string;
};

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (emailParam: string, passwordParam: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authRequestSeq = useRef(0);

  useEffect(() => {
    const seq = ++authRequestSeq.current;
    api
      .get("/auth/me")
      .then((res) => {
        if (seq !== authRequestSeq.current) return;
        setUser(res.data.user);
        setError(null);
      })
      .catch((err) => {
        if (seq !== authRequestSeq.current) return;
        console.error("[AuthContext] Erro ao validar sessão:", err);
        setUser(null);
        if (!err.response) {
          setError("Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
        }
      })
      .finally(() => {
        if (seq === authRequestSeq.current) setLoading(false);
      });
  }, []);

  const login = useCallback(async (emailParam: string, passwordParam: string) => {
    const seq = ++authRequestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const loginRes = await api.post<{ user?: AuthUser }>("/auth/login", { email: emailParam, password: passwordParam });
      if (seq !== authRequestSeq.current) return;
      if (loginRes.data.user) {
        setUser(loginRes.data.user);
        return;
      }
      const res = await api.get("/auth/me");
      if (seq !== authRequestSeq.current) return;
      setUser(res.data.user);
    } finally {
      if (seq === authRequestSeq.current) setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    ++authRequestSeq.current;
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    ++authRequestSeq.current;
    await api.post("/auth/change-password", { currentPassword, newPassword, confirmPassword });
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, changePassword, error }), [user, loading, login, logout, changePassword, error]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
};
