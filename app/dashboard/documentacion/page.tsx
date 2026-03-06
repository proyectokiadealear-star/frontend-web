"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getVehicles, getSedes, getDocumentation, updateDocumentation } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import {
  VehicleStatus,
  AccessoryKey,
  AccessoryLabel,
  AccessoryClassification,
  AccessoryClassificationLabel,
} from "@/lib/constants";
import type { Vehicle, CatalogItem, AccessoryItem } from "@/types";
import { Pencil } from "lucide-react";
import toast from "react-hot-toast";

const STATUSES = [
  { value: VehicleStatus.ENVIADO_A_MATRICULAR, label: "Enviado a Matricular" },
  { value: VehicleStatus.CERTIFICADO_STOCK, label: "Certificado en Stock" },
  { value: VehicleStatus.DOCUMENTACION_PENDIENTE, label: "Doc. Pendiente" },
  { value: VehicleStatus.REAPERTURA_OT, label: "Reapertura OT" },
];

const ALL_ACCESSORY_KEYS = Object.values(AccessoryKey);
const CLASSIFICATION_OPTIONS = Object.entries(AccessoryClassificationLabel).map(
  ([value, label]) => ({ value, label })
);

export default function DocumentacionListPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sedes, setSedes] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterSede, setFilterSede] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>(VehicleStatus.ENVIADO_A_MATRICULAR);

  // Edit accessories modal
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [editAccessories, setEditAccessories] = useState<AccessoryItem[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

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

  const openEditAccessories = async (v: Vehicle) => {
    setEditVehicle(v);
    setEditLoading(true);
    try {
      const res = await getDocumentation(v.id);
      const existing: AccessoryItem[] = res.data.accessories ?? [];
      // Build full list — keep existing classifications, default NO_APLICA for missing
      const map = new Map(existing.map((a) => [a.key.toUpperCase(), a]));
      const full: AccessoryItem[] = ALL_ACCESSORY_KEYS.map((key) => {
        const found = map.get(key);
        return found
          ? { key: found.key, classification: found.classification, notes: found.notes }
          : { key: key as AccessoryItem["key"], classification: AccessoryClassification.NO_APLICA as AccessoryItem["classification"] };
      });
      setEditAccessories(full);
    } catch {
      toast.error("Error al cargar accesorios");
      setEditVehicle(null);
    } finally {
      setEditLoading(false);
    }
  };

  const saveAccessories = async () => {
    if (!editVehicle) return;
    setEditSaving(true);
    try {
      const formData = new FormData();
      formData.append("accessories", JSON.stringify(editAccessories));
      await updateDocumentation(editVehicle.id, formData);
      toast.success("Accesorios actualizados");
      setEditVehicle(null);
      fetchVehicles();
    } catch {
      toast.error("Error al guardar accesorios");
    } finally {
      setEditSaving(false);
    }
  };

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
                  <div className="flex gap-1">
                    {v.status === VehicleStatus.DOCUMENTACION_PENDIENTE && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Pencil size={13} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditAccessories(v);
                          }}
                        >
                          Editar
                        </Button>
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
                      </>
                    )}
                    {(v.status === VehicleStatus.ENVIADO_A_MATRICULAR ||
                      v.status === VehicleStatus.CERTIFICADO_STOCK) && (
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
                    )}
                    {v.status === VehicleStatus.REAPERTURA_OT && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/documentacion/${v.id}`);
                        }}
                      >
                        Documentar reapertura
                      </Button>
                    )}
                  </div>
                </div>
              }
            />
          ))}
        </div>
      )}

      <Pagination page={page} total={total} limit={limit} onChange={setPage} />

      {/* Edit Accessories Modal */}
      <Modal
        open={!!editVehicle}
        onClose={() => !editSaving && setEditVehicle(null)}
        title={`Editar Accesorios — ${editVehicle?.chassis ?? ""}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditVehicle(null)} disabled={editSaving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={saveAccessories} loading={editSaving} disabled={editLoading}>
              Guardar cambios
            </Button>
          </div>
        }
      >
        {editLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 uppercase">
                    Accesorio
                  </th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                    Clasificación
                  </th>
                </tr>
              </thead>
              <tbody>
                {editAccessories.map((acc, idx) => (
                  <tr key={acc.key} className="border-b border-gray-100">
                    <td className="py-2.5 pr-3 text-gray-700">
                      {AccessoryLabel[acc.key.toUpperCase() as keyof typeof AccessoryLabel] ??
                        acc.key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </td>
                    <td className="py-2.5">
                      <select
                        value={acc.classification}
                        onChange={(e) => {
                          const updated = [...editAccessories];
                          updated[idx] = { ...acc, classification: e.target.value as AccessoryItem["classification"] };
                          setEditAccessories(updated);
                        }}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 transition-colors cursor-pointer"
                      >
                        {CLASSIFICATION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
