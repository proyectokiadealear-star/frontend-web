"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getVehicles,
  getStatusHistory,
  getCertification,
  getDocumentation,
  getDeliveryCeremony,
  getSedes,
} from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { TraceabilityTimeline } from "@/components/vehicles/TraceabilityTimeline";
import { formatDate } from "@/lib/utils";
import { generateVehiclePDF } from "@/lib/generateVehiclePDF";
import { VehicleStatus, VehicleStatusLabel } from "@/lib/constants";
import type { Vehicle, Certification, Documentation, DeliveryCeremony, StatusHistoryEntry } from "@/types";
import { FileDown, X } from "lucide-react";
import toast from "react-hot-toast";

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  ...Object.entries(VehicleStatusLabel).map(([k, v]) => ({ value: k, label: v })),
];

export default function ReportesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sedeFilter, setSedeFilter] = useState("");
  const [sedes, setSedes] = useState<string[]>([]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [timeline, setTimeline] = useState<StatusHistoryEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [drawerCert, setDrawerCert] = useState<Certification | null>(null);
  const [drawerDoc, setDrawerDoc] = useState<Documentation | null>(null);
  const [drawerCeremony, setDrawerCeremony] = useState<DeliveryCeremony | null>(null);

  const LIMIT = 20;

  // Cargar sedes desde el catálogo (fuente de verdad) al montar
  useEffect(() => {
    getSedes()
      .then((res) => {
        const names = (res.data ?? [])
          .map((s) => s.name)
          .filter(Boolean)
          .sort() as string[];
        setSedes(names);
      })
      .catch(() => { /* silencioso, el filtro queda vacío */ });
  }, []);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVehicles({
        chassis: search || undefined,
        status: statusFilter || undefined,
        sede: sedeFilter || undefined,
        page,
        limit: LIMIT,
      });
      const body = res.data;
      const rows: Vehicle[] = body.data ?? [];
      setVehicles(rows);
      setTotal(body.total ?? 0);
    } catch {
      toast.error("Error al cargar vehículos");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sedeFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sedeFilter]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const openDrawer = async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setDrawerOpen(true);
    setDrawerCert(null);
    setDrawerDoc(null);
    setDrawerCeremony(null);
    setTimelineLoading(true);
    try {
      const [histRes, certRes, docRes, cerRes] = await Promise.allSettled([
        getStatusHistory(vehicle.id),
        getCertification(vehicle.id),
        getDocumentation(vehicle.id),
        getDeliveryCeremony(vehicle.id),
      ]);
      setTimeline(histRes.status === "fulfilled" ? histRes.value.data : []);
      setDrawerCert(certRes.status === "fulfilled" ? certRes.value.data : null);
      setDrawerDoc(docRes.status === "fulfilled" ? docRes.value.data : null);
      setDrawerCeremony(cerRes.status === "fulfilled" ? cerRes.value.data : null);
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  // PDF desde la tabla (sin abrir drawer): fetch rápido y genera
  const handleTablePDF = async (vehicle: Vehicle) => {
    const toastId = toast.loading("Preparando reporte...");
    try {
      const [histRes, certRes, docRes, cerRes] = await Promise.allSettled([
        getStatusHistory(vehicle.id),
        getCertification(vehicle.id),
        getDocumentation(vehicle.id),
        getDeliveryCeremony(vehicle.id),
      ]);
      generateVehiclePDF({
        vehicle,
        cert: certRes.status === "fulfilled" ? certRes.value.data : null,
        doc: docRes.status === "fulfilled" ? docRes.value.data : null,
        ceremony: cerRes.status === "fulfilled" ? cerRes.value.data : null,
        history: histRes.status === "fulfilled" ? histRes.value.data : [],
      });
      toast.dismiss(toastId);
    } catch {
      toast.error("Error al generar el reporte", { id: toastId });
    }
  };

  // PDF desde el drawer (datos ya cargados)
  const handleDrawerPDF = () => {
    if (!selectedVehicle) return;
    generateVehiclePDF({
      vehicle: selectedVehicle,
      cert: drawerCert,
      doc: drawerDoc,
      ceremony: drawerCeremony,
      history: timeline,
    });
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <PageHeader
        title="Reportes y Trazabilidad"
        subtitle="Historial completo de estados por vehículo"
      />

      {/* Filters */}
      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por chasis, modelo..."
        filters={[
          {
            key: "status",
            label: "Estado",
            value: statusFilter,
            options: STATUS_OPTIONS,
            onChange: setStatusFilter,
          },
          {
            key: "sede",
            label: "Sede",
            value: sedeFilter,
            options: [
              { value: "", label: "Todas las sedes" },
              ...sedes.map((s) => ({ value: s, label: s })),
            ],
            onChange: setSedeFilter,
          },
        ]}
      />

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-4">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Chasis</th>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Sede</th>
                <th className="px-4 py-3">Recepción</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-10">
                    No hay vehículos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-chassis text-gray-700">
                      {v.chassis}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {v.model}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{v.sede}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {v.receptionDate ? formatDate(v.receptionDate) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDrawer(v)}
                        >
                          Trazabilidad
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<FileDown size={14} />}
                          onClick={() => handleTablePDF(v)}
                          title="Descargar PDF"
                        >
                          PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            page={page}
            total={total}
            limit={LIMIT}
            onChange={setPage}
          />
        </div>
      )}

      {/* Traceability Drawer */}
      {drawerOpen && selectedVehicle && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedVehicle.model}
                </p>
                <p className="text-xs font-chassis text-gray-500">
                  {selectedVehicle.chassis}
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <StatusBadge status={selectedVehicle.status} />
                <Button
                  size="sm"
                  variant="outline"
                  icon={<FileDown size={14} />}
                  onClick={handleDrawerPDF}
                >
                  Descargar PDF
                </Button>
              </div>
              <hr className="border-gray-100" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Historial de estados
              </h3>
              {timelineLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <TraceabilityTimeline history={timeline} />
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
