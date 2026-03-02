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
import { Car, Clock, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate } from "@/lib/utils";

export function DocumentacionDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const [certifiedVehicles, setCertifiedVehicles] = useState<Vehicle[]>([]);
  const [pendingVehicles, setPendingVehicles] = useState<Vehicle[]>([]);
  const [documentedToday, setDocumentedToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [certifiedRes, pendingRes] = await Promise.all([
        getVehicles({ status: VehicleStatus.CERTIFICADO_STOCK, limit: 50 }),
        getVehicles({ status: VehicleStatus.DOCUMENTACION_PENDIENTE, limit: 50 }),
      ]);

      const certified = certifiedRes.data.data || [];
      const pending = pendingRes.data.data || [];

      setCertifiedVehicles(certified);
      setPendingVehicles(pending);

      // Count documented today (vehicles with documentationDate = today)
      const today = formatDate(new Date().toISOString());
      // Simulated from available data - in production would come from API
      setDocumentedToday(0);
      void today;
    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle={`Bienvenida, ${user?.displayName || user?.email}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatsCard
          label="Listos para documentar"
          value={certifiedVehicles.length}
          icon={<Car size={18} />}
          color="blue"
        />
        <StatsCard
          label="Documentación pendiente"
          value={pendingVehicles.length}
          icon={<Clock size={18} />}
          color="amber"
        />
        <StatsCard
          label="Documentados hoy"
          value={documentedToday}
          icon={<CheckCircle size={18} />}
          color="green"
        />
      </div>

      {/* Listos para documentar */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Vehículos certificados — Listos para documentar
          </h2>
          <span className="text-xs text-gray-400 font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
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

      {/* Documentación en standby */}
      {pendingVehicles.length > 0 && (
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
