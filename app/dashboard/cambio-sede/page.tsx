"use client";

import { useState, useEffect, useCallback } from "react";
import { getVehicles, getSedes, changeVehicleSede } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import type { Vehicle, CatalogItem } from "@/types";
import toast from "react-hot-toast";

export default function CambioSedePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterSede, setFilterSede] = useState("");

  const [sedes, setSedes] = useState<CatalogItem[]>([]);

  // Action state
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [newSede, setNewSede] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const limit = 12;

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVehicles({
        chassis: search || undefined,
        sede: filterSede || undefined,
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
  }, [search, filterSede, page]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    getSedes()
      .then((r) => setSedes(r.data))
      .catch(() => {});
  }, []);

  const openAction = (v: Vehicle) => {
    setSelectedVehicle(v);
    setNewSede("");
    setActionOpen(true);
  };

  const closeAction = () => {
    setActionOpen(false);
    setSelectedVehicle(null);
  };

  const handleConfirm = async () => {
    if (!selectedVehicle || !newSede) return;
    setSaving(true);
    try {
      await changeVehicleSede(selectedVehicle.id, newSede);
      toast.success(`Sede cambiada a ${newSede} correctamente`);
      setConfirmOpen(false);
      closeAction();
      fetchVehicles();
    } catch {
      toast.error("Error al cambiar la sede");
    } finally {
      setSaving(false);
    }
  };

  const sedeDestOptions = sedes
    .filter((s) => (s.code || s.name) !== selectedVehicle?.sede)
    .map((s) => ({ value: s.code || s.name, label: s.name }));

  return (
    <div>
      <PageHeader
        title="Cambio de Sede"
        subtitle="Transfiere un vehículo a otra sede sin cambiar su estado"
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
            options: [
              { value: "", label: "Todas las sedes" },
              ...sedes.map((s) => ({ value: s.code || s.name, label: s.name })),
            ],
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
              footer={
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={v.status} />
                    {v.sede && (
                      <span className="text-xs text-gray-400">{v.sede}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAction(v);
                    }}
                  >
                    Cambiar sede
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      )}

      <Pagination page={page} total={total} limit={limit} onChange={setPage} />

      {/* Action Modal */}
      <Modal
        open={actionOpen}
        onClose={closeAction}
        title="Cambio de sede"
        description={
          selectedVehicle
            ? `${selectedVehicle.model} · Chasis: ${selectedVehicle.chassis} · Sede actual: ${selectedVehicle.sede}`
            : ""
        }
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={closeAction}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!newSede) {
                  toast.error("Selecciona una sede destino");
                  return;
                }
                setConfirmOpen(true);
              }}
            >
              Confirmar cambio
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Sede destino"
            value={newSede}
            onChange={(e) => setNewSede(e.target.value)}
            options={sedeDestOptions}
            placeholder="Seleccionar sede..."
            required
          />
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              El vehículo se trasladará a la nueva sede sin cambiar su estado actual.
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        loading={saving}
        title="Confirmar cambio de sede"
        description={`¿Cambiar el vehículo ${selectedVehicle?.chassis} de ${selectedVehicle?.sede} a ${newSede}?`}
        confirmLabel="Confirmar cambio"
        variant="primary"
      />
    </div>
  );
}
