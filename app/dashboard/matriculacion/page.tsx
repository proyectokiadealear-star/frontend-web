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
import { VehicleStatus } from "@/lib/constants";
import type { Vehicle } from "@/types";
import { Send, Clock, CheckCircle, FileCheck } from "lucide-react";
import toast from "react-hot-toast";

export default function MatriculacionPage() {
  const [porArribar, setPorArribar] = useState<Vehicle[]>([]);
  const [enviados, setEnviados] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state — Enviar a matricular
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Modal state — Recepción de matrícula
  const [receiveTarget, setReceiveTarget] = useState<Vehicle | null>(null);
  const [receiveDate, setReceiveDate] = useState("");
  const [savingReceive, setSavingReceive] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [porRes, envRes] = await Promise.all([
        getVehicles({ status: VehicleStatus.POR_ARRIBAR, limit: 100 }),
        getVehicles({ status: VehicleStatus.ENVIADO_A_MATRICULAR, limit: 100 }),
      ]);
      setPorArribar(porRes.data.data || []);
      setEnviados(envRes.data.data || []);
    } catch {
      toast.error("Error al cargar vehículos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          value={porArribar.length}
          icon={<Clock size={18} />}
          color="default"
        />
        <StatsCard
          label="Enviados a matricular"
          value={enviados.length}
          icon={<CheckCircle size={18} />}
          color="blue"
        />
        <StatsCard
          label="Matrícula recibida"
          value={enviados.filter((v) => v.registrationReceivedDate).length}
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
            {porArribar.length}
          </span>
        </div>

        {loading ? (
          <SkeletonGrid cols={1} rows={3} />
        ) : porArribar.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Send size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">
              No hay vehículos pendientes de envío a matricular.
            </p>
          </div>
        ) : (
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Estado
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {porArribar.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {v.chassis}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {v.model}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v.year}</td>
                    <td className="px-4 py-3 text-gray-600">{v.color}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {v.sede}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Send size={13} />}
                        onClick={() => {
                          setSelected(v);
                          setDate(new Date().toISOString().slice(0, 10));
                        }}
                      >
                        Enviar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enviados recientemente */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Enviados a matricular
          </h2>
          <span className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full">
            {enviados.length}
          </span>
        </div>

        {loading ? (
          <SkeletonGrid cols={1} rows={2} />
        ) : enviados.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400">
              Aún no se han enviado vehículos a matricular.
            </p>
          </div>
        ) : (
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
                    Color
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Recepción matrícula
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enviados.map((v) => {
                  const received = v.registrationReceivedDate;
                  const receivedStr =
                    received && typeof received === "string"
                      ? received
                      : received && typeof received === "object" && "_seconds" in received
                      ? new Date(received._seconds * 1000).toLocaleDateString("es-EC")
                      : null;

                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {v.chassis}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {v.model}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{v.color}</td>
                      <td className="px-4 py-3">
                        {receivedStr ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            <FileCheck size={12} />
                            {receivedStr}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Pendiente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!receivedStr && (
                          <Button
                            size="sm"
                            variant="outline"
                            icon={<FileCheck size={13} />}
                            onClick={() => {
                              setReceiveTarget(v);
                              setReceiveDate(new Date().toISOString().slice(0, 10));
                            }}
                          >
                            Recepción
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              max={new Date().toISOString().slice(0, 10)}
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
              max={new Date().toISOString().slice(0, 10)}
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
