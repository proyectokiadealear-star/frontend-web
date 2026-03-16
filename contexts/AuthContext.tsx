"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { authLogin, authLogout } from "@/lib/api";
import { STORAGE_TOKEN_KEY, STORAGE_REFRESH_KEY, STORAGE_USER_KEY } from "@/lib/api";
import type { RoleEnumType } from "@/lib/constants";

interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  role: RoleEnumType;
  sede: string;
  token: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

const STORAGE_KEY = STORAGE_USER_KEY;
const TOKEN_KEY = STORAGE_TOKEN_KEY;
const REFRESH_KEY = STORAGE_REFRESH_KEY;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authLogin(email, password);

    // El backend puede devolver los datos en el root o anidados en 'user' o 'data'
    const nested = data as unknown as Record<string, Record<string, string>>;
    const payload: Record<string, string> =
      nested.user ?? nested.data ?? data;

    // Acepta múltiples nombres posibles para el token
    const token: string =
      (data as Record<string, string>).token ||
      (data as Record<string, string>).accessToken ||
      (data as Record<string, string>).access_token ||
      (data as Record<string, string>).idToken ||
      (data as Record<string, string>).id_token ||
      "";

    const refreshToken: string =
      (data as Record<string, string>).refreshToken ?? "";

    if (!token) {
      console.error("[AuthContext] No se encontró token en la respuesta:", Object.keys(data));
      throw new Error("El servidor no devolvió un token de autenticación");
    }

    const authUser: AuthUser = {
      uid: payload.uid,
      email: payload.email,
      displayName: payload.displayName ?? payload.name ?? payload.email,
      role: payload.role as RoleEnumType,
      sede: payload.sede ?? "",
      token,
    };

    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (refreshToken) await authLogout(refreshToken);
    } catch {
      // best-effort: el backend puede estar caído o el token ya venció
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
