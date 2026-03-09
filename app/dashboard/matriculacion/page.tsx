"use client";

import { useEffect, useState, useCallback } from "react";
import { getVehicles, sendToRegistration, receiveRegistration } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { Modal } from "@/components/ui/Modal";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { StatsCard } from "@/components/ui/StatsCard";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { VehicleStatus, VehicleStatusLabel } from "@/lib/constants";
import type { Vehicle } from "@/types";
import { Send, Clock, FileCheck, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { localToday } from "@/lib/utils";

/* Statuses where matrícula reception can still be registered */
const TRACKING_STATUSES = [
  VehicleStatus.ENVIADO_A_MATRICULAR,
  VehicleStatus.DOCUMENTACION_PENDIENTE,
  VehicleStatus.DOCUMENTADO,
  VehicleStatus.CERTIFICADO_STOCK,
  VehicleStatus.ORDEN_GENERADA,
  VehicleStatus.ASIGNADO,
  VehicleStatus.EN_INSTALACION,
  VehicleStatus.INSTALACION_COMPLETA,
  VehicleStatus.REAPERTURA_OT,
  VehicleStatus.LISTO_PARA_ENTREGA,
] as const;

const PAGE_SIZE = 7;

export default function MatriculacionPage() {
  // POR_ARRIBAR table state
  const [porArribar, setPorArribar] = useState<Vehicle[]>([]);
  const [totalArribar, setTotalArribar] = useState(0);
  const [searchArribar, setSearchArribar] = useState("");
  const [pageArribar, setPageArribar] = useState(1);
  const [loadingArribar, setLoadingArribar] = useState(true);

  // Tracking table state
  const [enProceso, setEnProceso] = useState<Vehicle[]>([]);
  const [totalTracking, setTotalTracking] = useState(0);
  const [searchChassis, setSearchChassis] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [pageTracking, setPageTracking] = useState(1);
  const [loadingTracking, setLoadingTracking] = useState(true);

  // Keep a separate loading flag for KPIs (totals without search)
  const [kpiCounts, setKpiCounts] = useState({ porArribar: 0, pendientes: 0, recibidos: 0 });

  // Modal state — Enviar a matricular
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Modal state — Recepción de matrícula
  const [receiveTarget, setReceiveTarget] = useState<Vehicle | null>(null);
  const [receiveDate, setReceiveDate] = useState("");
  const [savingReceive, setSavingReceive] = useState(false);

  // ── Fetch POR_ARRIBAR with server-side search + pagination ─────────────────
  const fetchArribar = useCallback(async () => {
    setLoadingArribar(true);
    try {
      const res = await getVehicles({
        status: VehicleStatus.POR_ARRIBAR,
        chassis: searchArribar || undefined,
        page: pageArribar,
        limit: PAGE_SIZE,
      });
      setPorArribar(res.data.data || []);
      setTotalArribar(res.data.total || 0);
    } catch {
      toast.error("Error al cargar vehículos por arribar");
    } finally {
      setLoadingArribar(false);
    }
  }, [searchArribar, pageArribar]);

  // ── Fetch tracking (ENVIADO_A_MATRICULAR … LISTO_PARA_ENTREGA) ─────────────
  const fetchTracking = useCallback(async () => {
    setLoadingTracking(true);
    try {
      const res = await getVehicles({
        status: TRACKING_STATUSES.join(","),
        chassis: searchChassis || undefined,
        page: pageTracking,
        limit: PAGE_SIZE,
      });
      const all: Vehicle[] = res.data.data || [];
      setEnProceso(all);
      setTotalTracking(res.data.total || 0);
    } catch {
      toast.error("Error al cargar seguimiento");
    } finally {
      setLoadingTracking(false);
    }
  }, [searchChassis, filterStatus, pageTracking]);

  // ── Fetch KPI counts (unfiltered totals for the summary cards) ─────────────
  const fetchKpis = useCallback(async () => {
    try {
      const [porRes, trackRes] = await Promise.all([
        getVehicles({ status: VehicleStatus.POR_ARRIBAR, limit: 1 }),
        getVehicles({ status: TRACKING_STATUSES.join(","), limit: 1 }),
      ]);
      const trackingAll = trackRes.data.total || 0;
      // We can't easily split pendientes/recibidos from totals without fetching all,
      // so keep KPI as approximation from last full fetch
      setKpiCounts((prev) => ({
        ...prev,
        porArribar: porRes.data.total || 0,
        pendientes: trackingAll,
      }));
    } catch { /* silent */ }
  }, []);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchArribar(), fetchTracking(), fetchKpis()]);
  }, [fetchArribar, fetchTracking, fetchKpis]);

  // Each table reacts to its own filters independently
  useEffect(() => { fetchArribar(); }, [fetchArribar]);
  useEffect(() => { fetchTracking(); }, [fetchTracking]);
  // KPIs only need to refresh after mutations (not on filter changes)
  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  const handleSend = async () => {
    if (!selected || !date) {
      toast.error("Selecciona la fecha de envío");
      return;
    }
    setSaving(true);
    try {
      await sendToRegistration(selected.id, date);
      toast.success("Vehículo enviado a matricular");
      setSelected(null);
      setDate("");
      fetchData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al enviar a matricular";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async () => {
    if (!receiveTarget || !receiveDate) {
      toast.error("Selecciona la fecha de recepción");
      return;
    }
    setSavingReceive(true);
    try {
      await receiveRegistration(receiveTarget.id, receiveDate);
      toast.success("Recepción de matrícula registrada");
      setReceiveTarget(null);
      setReceiveDate("");
      fetchData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al registrar recepción";
      toast.error(msg);
    } finally {
      setSavingReceive(false);
    }
  };

  /* Client-side split for the tracking table (server already filtered by chassis) */
  const pendientes = enProceso.filter((v) => !v.registrationReceivedDate);
  const recibidos  = enProceso.filter((v) =>  !!v.registrationReceivedDate);

  /* Apply optional status filter client-side (chassis already filtered server-side) */
  const filteredTracking = pendientes.filter((v) =>
    !filterStatus || v.status === filterStatus
  );

  const statusFilterOptions = TRACKING_STATUSES.map((s) => ({
    value: s,
    label: VehicleStatusLabel[s] ?? s,
  }));

  return (
    <div>
      <PageHeader
        title="Matriculación"
        subtitle="Gestiona el envío a matricular de los vehículos registrados"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatsCard
          label="Por arribar"
          value={kpiCounts.porArribar}
          icon={<Clock size={18} />}
          color="default"
        />
        <StatsCard
          label="Pendiente recepción"
          value={kpiCounts.pendientes}
          icon={<AlertCircle size={18} />}
          color="amber"
        />
        <StatsCard
          label="Matrícula recibida"
          value={recibidos.length}
          icon={<FileCheck size={18} />}
          color="green"
        />
      </div>

      {/* Por Arribar — Tabla principal */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Pendientes de envío a matricular
          </h2>
          <span className="text-xs bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full">
            {totalArribar}
          </span>
        </div>

        <SearchFilterBar
          searchValue={searchArribar}
          onSearchChange={(v) => { setSearchArribar(v); setPageArribar(1); }}
          searchPlaceholder="Buscar por chasis..."
        />

        {loadingArribar ? (
          <SkeletonGrid cols={1} rows={3} />
        ) : porArribar.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Send size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">
              {totalArribar === 0
                ? "No hay vehículos pendientes de envío a matricular."
                : "No se encontraron vehículos con ese chasis."}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Chasis
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Modelo
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Año
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Color
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Sede
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {porArribar.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{v.chassis}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{v.model}</td>
                      <td className="px-4 py-3 text-gray-600">{v.year}</td>
                      <td className="px-4 py-3 text-gray-600">{v.color}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{v.sede}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<Send size={13} />}
                          onClick={() => { setSelected(v); setDate(localToday()); }}
                        >
                          Enviar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={pageArribar}
              total={totalArribar}
              limit={PAGE_SIZE}
              onChange={setPageArribar}
            />
          </>
        )}
      </div>

      {/* Seguimiento de matriculación */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Pendiente recepción de matrícula
          </h2>
          <span className="text-xs bg-amber-50 text-amber-600 font-medium px-2 py-0.5 rounded-full">
            {totalTracking} pendientes
          </span>
        </div>

        <SearchFilterBar
          searchValue={searchChassis}
          onSearchChange={(v) => { setSearchChassis(v); setPageTracking(1); }}
          searchPlaceholder="Buscar por chasis..."
          filters={[
            {
              label: "Estado",
              key: "status",
              value: filterStatus,
              onChange: (v) => { setFilterStatus(v); setPageTracking(1); },
              options: statusFilterOptions,
            },
          ]}
        />

        {loadingTracking ? (
          <SkeletonGrid cols={1} rows={2} />
        ) : filteredTracking.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400">
              {totalTracking === 0
                ? "Todos los vehículos tienen recepción de matrícula registrada."
                : "No se encontraron vehículos con esos filtros."}
            </p>
          </div>
        ) : (
          <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Chasis</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Modelo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Color</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado actual</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTracking.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{v.chassis}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{v.model}</td>
                    <td className="px-4 py-3 text-gray-600">{v.color}</td>
                    <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<FileCheck size={13} />}
                        onClick={() => { setReceiveTarget(v); setReceiveDate(localToday()); }}
                      >
                        Recepción
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={pageTracking}
            total={totalTracking}
            limit={PAGE_SIZE}
            onChange={setPageTracking}
          />
        </>
        )}
      </div>

      {/* Modal: Enviar a Matricular */}
      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setDate("");
        }}
        title="Enviar a Matricular"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelected(null);
                setDate("");
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSend}
              loading={saving}
              disabled={saving || !date}
              icon={<Send size={14} />}
            >
              Enviar a Matricular
            </Button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900">
                {selected.model} — {selected.color}
              </p>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {selected.chassis}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={selected.status} />
              </div>
            </div>

            <DateInput
              label="Fecha de envío a matricular"
              value={date}
              onChange={setDate}
              required
              max={localToday()}
            />

            <p className="text-xs text-gray-400">
              Al confirmar, el vehículo pasará a estado{" "}
              <span className="font-medium text-indigo-600">
                Enviado a Matricular
              </span>{" "}
              y quedará disponible para documentar.
            </p>
          </div>
        )}
      </Modal>

      {/* Modal: Recepción de Matrícula */}
      <Modal
        open={!!receiveTarget}
        onClose={() => {
          setReceiveTarget(null);
          setReceiveDate("");
        }}
        title="Registrar Recepción de Matrícula"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setReceiveTarget(null);
                setReceiveDate("");
              }}
              disabled={savingReceive}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleReceive}
              loading={savingReceive}
              disabled={savingReceive || !receiveDate}
              icon={<FileCheck size={14} />}
            >
              Registrar Recepción
            </Button>
          </div>
        }
      >
        {receiveTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900">
                {receiveTarget.model} — {receiveTarget.color}
              </p>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {receiveTarget.chassis}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={receiveTarget.status} />
              </div>
            </div>

            <DateInput
              label="Fecha de recepción de matrícula"
              value={receiveDate}
              onChange={setReceiveDate}
              required
              max={localToday()}
            />

            <p className="text-xs text-gray-400">
              Registra la fecha en que se recibió la matrícula física del
              vehículo.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
