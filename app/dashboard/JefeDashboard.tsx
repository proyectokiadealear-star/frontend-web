"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getVehicleStatsBySede, getTodayDeliveries, getVehicles } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatsCard } from "@/components/ui/StatsCard";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useRouter } from "next/navigation";
import type { Vehicle } from "@/types";
import { VehicleStatus } from "@/lib/constants";
import { Car, Calendar, FileText, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardBI } from "./DashboardBI";

interface StatsData {
  total: number;
  byStatus: Record<string, number>;
  bySede: Record<string, number>;
}

export function JefeDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<StatsData | null>(null);
  const [todayDeliveries, setTodayDeliveries] = useState<Vehicle[]>([]);
  const [recentVehicles, setRecentVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, deliveriesRes, vehiclesRes] = await Promise.all([
        getVehicleStatsBySede(),
        getTodayDeliveries(),
        getVehicles({ limit: 6 }),
      ]);
      setStats(statsRes.data as StatsData);
      setTodayDeliveries(deliveriesRes.data);
      setRecentVehicles(vehiclesRes.data.data || []);
    } catch {
      toast.error("Error al cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = [
    {
      label: "En Instalación",
      value: stats?.byStatus?.[VehicleStatus.EN_INSTALACION] ?? "—",
      icon: <Clock size={18} />,
      color: "amber" as const,
    },
    {
      label: "Listos para entrega",
      value: stats?.byStatus?.[VehicleStatus.LISTO_PARA_ENTREGA] ?? "—",
      icon: <Car size={18} />,
      color: "green" as const,
    },
    {
      label: "Agendados hoy",
      value: todayDeliveries.length,
      icon: <Calendar size={18} />,
      color: "blue" as const,
    },
    {
      label: "Pendiente documentar",
      value: stats?.byStatus?.[VehicleStatus.CERTIFICADO_STOCK] ?? "—",
      icon: <FileText size={18} />,
      color: "default" as const,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard General"
        subtitle={`Bienvenido, ${user?.displayName || user?.email}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <StatsCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Entregas de hoy */}
      {todayDeliveries.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Agendados para hoy
            </h2>
            <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
              {todayDeliveries.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayDeliveries.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onClick={() => router.push(`/dashboard/stock/${v.id}`)}
                footer={<StatusBadge status={v.status} />}
              />
            ))}
          </div>
        </section>
      )}

      {/* Inventario reciente */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Inventario activo reciente
          </h2>
          <button
            onClick={() => router.push("/dashboard/stock")}
            className="text-xs text-blue-600 hover:underline cursor-pointer"
          >
            Ver todo →
          </button>
        </div>
        {loading ? (
          <SkeletonGrid cols={3} rows={1} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentVehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onClick={() => router.push(`/dashboard/stock/${v.id}`)}
                footer={<StatusBadge status={v.status} />}
              />
            ))}
            {recentVehicles.length === 0 && (
              <p className="col-span-3 text-sm text-gray-400 py-6 text-center">
                Sin vehículos en inventario activo.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Estado por sede */}
      {stats?.bySede && Object.keys(stats.bySede).length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            Vehículos por sede
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(stats.bySede).map(([sede, count]) => (
              <div
                key={sede}
                className="border border-gray-200 rounded-xl p-4 bg-white flex items-center justify-between"
              >
                <span className="text-sm font-medium text-gray-700">{sede}</span>
                <span className="text-xl font-bold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Business Intelligence */}
      <DashboardBI />
    </div>
  );
}
