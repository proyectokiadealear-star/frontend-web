"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getVehicles,
  getConcessionaires,
  getSedes,
  transferVehicle,
} from "@/lib/api";
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
import { FileText, Upload, X } from "lucide-react";
import toast from "react-hot-toast";

export default function CambioConcesionarioPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterSede, setFilterSede] = useState("");

  const [sedes, setSedes] = useState<CatalogItem[]>([]);
  const [concessionaires, setConcessionaires] = useState<CatalogItem[]>([]);

  // Action state
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [targetConcessionaire, setTargetConcessionaire] = useState("");
  const [cessionFile, setCessionFile] = useState<File | undefined>(undefined);
  const [fileInputKey, setFileInputKey] = useState(0);

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
    getConcessionaires()
      .then((r) => setConcessionaires(r.data))
      .catch(() => {});
  }, []);

  const openAction = (v: Vehicle) => {
    setSelectedVehicle(v);
    setTargetConcessionaire("");
    setCessionFile(undefined);
    setFileInputKey((k) => k + 1);
    setActionOpen(true);
  };

  const closeAction = () => {
    setActionOpen(false);
    setSelectedVehicle(null);
  };

  const handleTransfer = async () => {
    if (!selectedVehicle || !targetConcessionaire) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("targetConcessionaire", targetConcessionaire);
      if (cessionFile) fd.append("cessionDocument", cessionFile);
      await transferVehicle(selectedVehicle.id, fd);
      toast.success("Vehículo cedido correctamente. Estado: CEDIDO");
      setConfirmOpen(false);
      closeAction();
      fetchVehicles();
    } catch {
      toast.error("Error al ceder el vehículo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Cesión a Concesionario"
        subtitle="Transfiere la propiedad de un vehículo a otro concesionario"
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
                  <StatusBadge status={v.status} />
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAction(v);
                    }}
                  >
                    Ceder
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
        title="Ceder vehículo a concesionario"
        description={selectedVehicle ? `${selectedVehicle.model} · Chasis: ${selectedVehicle.chassis}` : ""}
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={closeAction}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!targetConcessionaire) {
                  toast.error("Selecciona un concesionario");
                  return;
                }
                if (!cessionFile) {
                  toast.error("Adjunta el documento de cesión");
                  return;
                }
                setConfirmOpen(true);
              }}
            >
              Ceder vehículo
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Concesionario destino"
            value={targetConcessionaire}
            onChange={(e) => setTargetConcessionaire(e.target.value)}
            options={concessionaires.map((c) => ({
              value: c.name,
              label: c.name,
            }))}
            placeholder="Seleccionar..."
            required
          />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Documento de cesión (PDF) <span className="text-red-500">*</span>
            </label>
            {cessionFile ? (
              <div className="flex items-center justify-between border border-amber-200 rounded-xl px-4 py-3 bg-amber-50">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <FileText size={13} className="text-amber-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {cessionFile.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCessionFile(undefined);
                    setFileInputKey((k) => k + 1);
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                  title="Quitar archivo"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="cessionFile"
                  className="inline-flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-400 cursor-pointer transition-colors w-full justify-center"
                >
                  <Upload size={15} />
                  Seleccionar PDF
                </label>
                <input
                  key={fileInputKey}
                  id="cessionFile"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setCessionFile(e.target.files?.[0])}
                />
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              <strong>Atención:</strong> Esta acción cambiará el estado del vehículo
              a <strong>CEDIDO</strong> de forma definitiva. No se puede revertir.
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleTransfer}
        loading={saving}
        title="Ceder vehículo"
        description={`¿Ceder definitivamente el vehículo ${selectedVehicle?.chassis} al concesionario ${targetConcessionaire}? El estado cambiará a CEDIDO.`}
        confirmLabel="Sí, ceder"
      />
    </div>
  );
}
