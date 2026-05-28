import React, { createContext, useContext, useState, useEffect } from "react";
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data.user);
        setError(null);
      })
      .catch((err) => {
        console.error("[AuthContext] Erro ao validar sessão:", err);
        setUser(null);
        if (!err.response) {
          setError("Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (emailParam: string, passwordParam: string) => {
    const loginRes = await api.post<{ user?: AuthUser }>("/auth/login", { email: emailParam, password: passwordParam });
    if (loginRes.data.user) {
      setUser(loginRes.data.user);
      return;
    }
    const res = await api.get("/auth/me");
    setUser(res.data.user);
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, error }}>
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
