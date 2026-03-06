"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { RoleEnum } from "@/lib/constants";
import { JefeDashboard } from "./JefeDashboard";
import { DocumentacionDashboard } from "./DocumentacionDashboard";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === RoleEnum.BODEGUERO) {
      router.replace("/dashboard/stock");
    }
  }, [user, router]);

  if (!user) return null;

  if (user.role === RoleEnum.DOCUMENTACION) {
    return <DocumentacionDashboard />;
  }

  if (user.role === RoleEnum.BODEGUERO) {
    // BODEGUERO has no dashboard — redirect to stock directly via layout
    // The sidebar already points to /dashboard/stock as the only entry
    return null;
  }

  // JEFE_TALLER and SOPORTE
  return <JefeDashboard />;
}
