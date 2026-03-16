"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/PageHeader";
import dynamic from "next/dynamic";

const DashboardBI = dynamic(() => import("./DashboardBI").then((m) => m.DashboardBI), {
  ssr: false,
  loading: () => (
    <div className="mt-4 rounded-2xl bg-gray-100 animate-pulse" style={{ height: 400 }} />
  ),
});

const DashboardEntregados = dynamic(
  () => import("./DashboardEntregados").then((m) => m.DashboardEntregados),
  {
    ssr: false,
    loading: () => (
      <div className="mt-4 rounded-2xl bg-gray-100 animate-pulse" style={{ height: 400 }} />
    ),
  }
);

const DashboardCallCenter = dynamic(
  () => import("./DashboardCallCenter").then((m) => m.DashboardCallCenter),
  {
    ssr: false,
    loading: () => (
      <div className="mt-4 rounded-2xl bg-gray-100 animate-pulse" style={{ height: 400 }} />
    ),
  }
);

const TABS = [
  { id: "bi", label: "Business Intelligence" },
  { id: "entregados", label: "Vehículos Entregados" },
  { id: "callcenter", label: "Call Center" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function JefeDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("bi");

  return (
    <div>
      <PageHeader
        title="Dashboard General"
        subtitle={`Bienvenido, ${user?.displayName || user?.email}`}
      />

      {/* ── Tab Bar ── */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-1" aria-label="Secciones del dashboard">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                  isActive
                    ? "border-red-600 text-red-600 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent",
                ].join(" ")}
                aria-selected={isActive}
                role="tab"
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab Panels ── */}
      <div className="mt-6">
        {activeTab === "bi" && <DashboardBI />}
        {activeTab === "entregados" && <DashboardEntregados />}
        {activeTab === "callcenter" && <DashboardCallCenter />}
      </div>
    </div>
  );
}
