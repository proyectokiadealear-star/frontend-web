"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { authLogin } from "@/lib/api";
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

const STORAGE_KEY = "kia_user";
const TOKEN_KEY = "kia_token";

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

    // Debug: log completo de la respuesta para identificar campos reales
    console.log("[AuthContext] login response:", data);

    // El backend puede devolver los datos en el root o anidados en 'user' o 'data'
    const nested = data as unknown as Record<string, Record<string, string>>;
    const payload: Record<string, string> =
      nested.user ?? nested.data ?? data;

    console.log("[AuthContext] payload extraído:", payload);

    // Acepta múltiples nombres posibles para el token
    const token: string =
      (data as Record<string, string>).token ||
      (data as Record<string, string>).accessToken ||
      (data as Record<string, string>).access_token ||
      (data as Record<string, string>).idToken ||
      (data as Record<string, string>).id_token ||
      "";

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

    console.log("[AuthContext] usuario autenticado:", { uid: authUser.uid, role: authUser.role, sede: authUser.sede });

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
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
