"use client";

import { useAuth } from "@/contexts/AuthContext";
import { RoleEnum } from "@/lib/constants";
import { JefeDashboard } from "./JefeDashboard";
import { DocumentacionDashboard } from "./DocumentacionDashboard";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  console.log("[Dashboard] role:", user.role);

  if (user.role === RoleEnum.DOCUMENTACION) {
    return <DocumentacionDashboard />;
  }

  // JEFE_TALLER and SOPORTE
  return <JefeDashboard />;
}
