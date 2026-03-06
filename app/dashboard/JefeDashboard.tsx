"use client";

import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import dynamic from "next/dynamic";

const DashboardBI = dynamic(() => import("./DashboardBI").then((m) => m.DashboardBI), {
  ssr: false,
  loading: () => (
    <div className="mt-4 rounded-2xl bg-gray-100 animate-pulse" style={{ height: 400 }} />
  ),
});

export function JefeDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <PageHeader
        title="Dashboard General"
        subtitle={`Bienvenido, ${user?.displayName || user?.email}`}
      />

      {/* Business Intelligence */}
      <DashboardBI />
    </div>
  );
}
