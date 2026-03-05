"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getVehicles, getSedes, deleteVehicle } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Button } from "@/components/ui/Button";
import { RoleEnum, VehicleStatus, VehicleStatusLabel } from "@/lib/constants";
import type { Vehicle, CatalogItem } from "@/types";
import toast from "react-hot-toast";

export default function StockPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isJefe =
    user?.role === RoleEnum.JEFE_TALLER || user?.role === RoleEnum.SOPORTE;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sedes, setSedes] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterSede, setFilterSede] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      toast.error("Error al cargar el inventario");
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

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteVehicle(deleteId);
      toast.success("Vehículo eliminado");
      setDeleteId(null);
      fetchVehicles();
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const statusOptions = Object.entries(VehicleStatusLabel).map(([v, l]) => ({
    value: v,
    label: l,
  }));

  return (
    <div>
      <PageHeader
        title="Stock de Vehículos"
        subtitle="Inventario activo de todas las sedes"
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
            options: statusOptions,
          },
        ]}
      />

      {loading ? (
        <SkeletonGrid cols={3} rows={2} />
      ) : vehicles.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-sm text-gray-400">No se encontraron vehículos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onClick={() => router.push(`/dashboard/stock/${v.id}`)}
              footer={
                <div className="flex items-center justify-between gap-1">
                  <StatusBadge status={v.status} />
                  <div className="flex gap-1">
                    {(v.status === VehicleStatus.CERTIFICADO_STOCK ||
                      v.status === VehicleStatus.ENVIADO_A_MATRICULAR) &&
                      user?.role === RoleEnum.DOCUMENTACION && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/documentacion/${v.id}`);
                          }}
                        >
                          Documentar
                        </Button>
                      )}
                    {isJefe && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(v.id);
                        }}
                        className="text-red-500 hover:bg-red-50"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              }
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        total={total}
        limit={limit}
        onChange={setPage}
      />

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar vehículo"
        description="Esta acción es irreversible. ¿Confirmas la eliminación?"
        confirmLabel="Eliminar"
      />
    </div>
  );
}
