import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "../lib/storage";
import { api } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";
import type { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "taxi_dispatch_token";
const USER_KEY = "taxi_dispatch_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedToken = await storage.getItem(TOKEN_KEY);
      const storedUser = await storage.getItem(USER_KEY);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUserState(JSON.parse(storedUser));
        connectSocket(storedToken);
      }
      setLoading(false);
    })();
  }, []);

  const login = async (phone: string, password: string) => {
    const { token: newToken, user: newUser } = await api.login(phone, password);
    await storage.setItem(TOKEN_KEY, newToken);
    await storage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUserState(newUser);
    connectSocket(newToken);
  };

  const logout = async () => {
    await storage.deleteItem(TOKEN_KEY);
    await storage.deleteItem(USER_KEY);
    disconnectSocket();
    setToken(null);
    setUserState(null);
  };

  const setUser = (updated: AuthUser) => {
    setUserState(updated);
    storage.setItem(USER_KEY, JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
