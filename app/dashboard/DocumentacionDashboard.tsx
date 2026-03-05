"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getVehicles } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatsCard } from "@/components/ui/StatsCard";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useRouter } from "next/navigation";
import type { Vehicle } from "@/types";
import { VehicleStatus } from "@/lib/constants";
import { Car, Clock, Send, FileText } from "lucide-react";
import toast from "react-hot-toast";

type ActiveTab = "documentar" | "pendiente";

export function DocumentacionDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const [porArribarCount, setPorArribarCount] = useState(0);
  const [enviadoVehicles, setEnviadoVehicles] = useState<Vehicle[]>([]);
  const [certifiedVehicles, setCertifiedVehicles] = useState<Vehicle[]>([]);
  const [pendingVehicles, setPendingVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("documentar");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [porArribarRes, enviadoRes, certifiedRes, pendingRes] = await Promise.all([
        getVehicles({ status: VehicleStatus.POR_ARRIBAR, limit: 1 }),
        getVehicles({ status: VehicleStatus.ENVIADO_A_MATRICULAR, limit: 50 }),
        getVehicles({ status: VehicleStatus.CERTIFICADO_STOCK, limit: 50 }),
        getVehicles({ status: VehicleStatus.DOCUMENTACION_PENDIENTE, limit: 50 }),
      ]);

      setPorArribarCount(porArribarRes.data.total || 0);
      setEnviadoVehicles(enviadoRes.data.data || []);
      setCertifiedVehicles(certifiedRes.data.data || []);
      setPendingVehicles(pendingRes.data.data || []);
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabs: { key: ActiveTab; label: string; count: number }[] = [
    { key: "documentar", label: "Listos para Documentar", count: enviadoVehicles.length + certifiedVehicles.length },
    { key: "pendiente", label: "Doc. Pendiente", count: pendingVehicles.length },
  ];

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle={`Bienvenida, ${user?.displayName || user?.email}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Por arribar"
          value={porArribarCount}
          icon={<Clock size={18} />}
          color="default"
        />
        <StatsCard
          label="Enviados a matricular"
          value={enviadoVehicles.length}
          icon={<Send size={18} />}
          color="blue"
        />
        <StatsCard
          label="Listos para documentar"
          value={certifiedVehicles.length}
          icon={<Car size={18} />}
          color="green"
        />
        <StatsCard
          label="Doc. pendiente"
          value={pendingVehicles.length}
          icon={<FileText size={18} />}
          color="amber"
        />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? "border-b-2 border-gray-900 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Tab: Listos para documentar ───────────────────── */}
      {activeTab === "documentar" && (
        <section>
          {/* Enviados a Matricular (ready for doc) */}
          {enviadoVehicles.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Enviados a Matricular
                </h2>
                <span className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full">
                  {enviadoVehicles.length}
                </span>
              </div>
              {loading ? (
                <SkeletonGrid cols={3} rows={1} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {enviadoVehicles.map((v) => (
                    <VehicleCard
                      key={v.id}
                      vehicle={v}
                      footer={
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge status={v.status} />
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/documentacion/${v.id}`);
                            }}
                          >
                            Documentar
                          </Button>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Certificados en Stock */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Certificados en Stock
            </h2>
            <span className="text-xs bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded-full">
              {certifiedVehicles.length}
            </span>
          </div>
          {loading ? (
            <SkeletonGrid cols={3} rows={1} />
          ) : certifiedVehicles.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">No hay vehículos certificados pendientes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {certifiedVehicles.slice(0, 6).map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  footer={
                    <Button
                      size="sm"
                      variant="primary"
                      fullWidth
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/documentacion/${v.id}`);
                      }}
                    >
                      Documentar
                    </Button>
                  }
                />
              ))}
              {certifiedVehicles.length > 6 && (
                <div className="flex items-center justify-center border border-dashed border-gray-300 rounded-xl p-4">
                  <button
                    onClick={() => router.push("/dashboard/documentacion")}
                    className="text-sm text-blue-600 hover:underline cursor-pointer"
                  >
                    Ver {certifiedVehicles.length - 6} más →
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ─── Tab: Documentación pendiente ──────────────────── */}
      {activeTab === "pendiente" && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Documentación en standby
            </h2>
            <span className="text-xs bg-amber-50 text-amber-600 font-medium px-2 py-0.5 rounded-full">
              {pendingVehicles.length}
            </span>
          </div>
          {loading ? (
            <SkeletonGrid cols={3} rows={1} />
          ) : pendingVehicles.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">No hay documentación pendiente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingVehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  footer={
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={v.status} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/documentacion/${v.id}`);
                        }}
                      >
                        Continuar
                      </Button>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
