"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getVehicles, getSedes } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { VehicleStatus } from "@/lib/constants";
import type { Vehicle, CatalogItem } from "@/types";
import toast from "react-hot-toast";

const STATUSES = [
  { value: VehicleStatus.CERTIFICADO_STOCK, label: "Certificado en Stock" },
  { value: VehicleStatus.DOCUMENTACION_PENDIENTE, label: "Doc. Pendiente" },
];

export default function DocumentacionListPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sedes, setSedes] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterSede, setFilterSede] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>(VehicleStatus.CERTIFICADO_STOCK);

  const limit = 12;

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVehicles({
        chassis: search || undefined,
        sede: filterSede || undefined,
        status: filterStatus || undefined,
        page,
        limit,
      });
      const data = res.data;
      setVehicles(data.data || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Error al cargar vehículos");
    } finally {
      setLoading(false);
    }
  }, [search, filterSede, filterStatus, page]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    getSedes()
      .then((r) => setSedes(r.data))
      .catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader
        title="Documentación de Vehículos"
        subtitle="Asocia clientes, carga documentos y clasifica accesorios"
      />

      <SearchFilterBar
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Buscar por chasis..."
        filters={[
          {
            label: "Sede",
            key: "sede",
            value: filterSede,
            onChange: (v) => { setFilterSede(v); setPage(1); },
            options: sedes.map((s) => ({ value: s.code || s.name, label: s.name })),
          },
          {
            label: "Estado",
            key: "status",
            value: filterStatus,
            onChange: (v) => { setFilterStatus(v); setPage(1); },
            options: STATUSES,
          },
        ]}
      />

      {loading ? (
        <SkeletonGrid cols={3} rows={2} />
      ) : vehicles.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-sm text-gray-400">
            No se encontraron vehículos con los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onClick={() => router.push(`/dashboard/documentacion/${v.id}`)}
              footer={
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={v.status} />
                  {v.status !== VehicleStatus.DOCUMENTADO && (
                    <Button
                      size="sm"
                      variant={
                        v.status === VehicleStatus.DOCUMENTACION_PENDIENTE
                          ? "outline"
                          : "primary"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/documentacion/${v.id}`);
                      }}
                    >
                      {v.status === VehicleStatus.DOCUMENTACION_PENDIENTE
                        ? "Continuar"
                        : "Documentar"}
                    </Button>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}

      <Pagination page={page} total={total} limit={limit} onChange={setPage} />
    </div>
  );
}
