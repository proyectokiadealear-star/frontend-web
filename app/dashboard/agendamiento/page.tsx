"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getAppointments,
  getVehicles,
  createAppointment,
  updateAppointment,
  getUsers,
} from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { DateInput } from "@/components/ui/DateInput";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { VehicleStatus, RoleEnum } from "@/lib/constants";
import type { Appointment, Vehicle, UserProfile } from "@/types";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const DAY_NAMES = ["Lun", "Mar", "Mi\u00e9", "Jue", "Vie", "S\u00e1b", "Dom"];

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const APPT_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function colorForAdvisor(uid: string | undefined) {
  if (!uid) return APPT_COLORS[0];
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return APPT_COLORS[h % APPT_COLORS.length];
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function buildCalendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push(`${year}-${mm}-${dd}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function AgendamientoPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [readyVehicles, setReadyVehicles] = useState<Vehicle[]>([]);
  const [advisors, setAdvisors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"calendar" | "pending">("calendar");

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editAppointment, setEditAppointment] = useState<Appointment | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vehicleId: "",
    scheduledDate: "",
    scheduledTime: "09:00",
    assignedAdvisorUid: "",
    assignedAdvisorName: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [apptRes, readyRes, advisorRes] = await Promise.all([
        getAppointments(),
        getVehicles({
          status: `${VehicleStatus.LISTO_PARA_ENTREGA},${VehicleStatus.AGENDADO}`,
          limit: 50,
        }),
        getUsers({ role: RoleEnum.ASESOR }),
      ]);
      setAppointments(apptRes.data);
      setReadyVehicles(readyRes.data.data || []);
      setAdvisors(advisorRes.data);
    } catch {
      toast.error("Error al cargar agendamientos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setEditAppointment(null);
    setForm({
      vehicleId: vehicle.id,
      scheduledDate: "",
      scheduledTime: "09:00",
      assignedAdvisorUid: "",
      assignedAdvisorName: "",
    });
    setModalOpen(true);
  };

  const openEdit = (appt: Appointment) => {
    setEditAppointment(appt);
    setSelectedVehicle(null);
    setForm({
      vehicleId: appt.vehicleId,
      scheduledDate: appt.scheduledDate,
      scheduledTime: appt.scheduledTime,
      assignedAdvisorUid: appt.assignedAdvisorUid,
      assignedAdvisorName: appt.assignedAdvisorName,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.scheduledDate || !form.scheduledTime || !form.assignedAdvisorUid) {
      toast.error("Completa todos los campos");
      return;
    }
    setSaving(true);
    try {
      if (editAppointment) {
        await updateAppointment(editAppointment.id, {
          scheduledDate: form.scheduledDate,
          scheduledTime: form.scheduledTime,
          assignedAdvisorUid: form.assignedAdvisorUid,
          assignedAdvisorName: form.assignedAdvisorName,
        });
        toast.success("Agendamiento actualizado");
      } else {
        await createAppointment(form);
        toast.success("Entrega agendada correctamente");
      }
      setModalOpen(false);
      fetchData();
    } catch {
      toast.error("Error al guardar el agendamiento");
    } finally {
      setSaving(false);
    }
  };

  const byDate = useMemo(
    () =>
      appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
        const d = a.scheduledDate;
        if (!acc[d]) acc[d] = [];
        acc[d].push(a);
        return acc;
      }, {}),
    [appointments]
  );

  const calendarCells = useMemo(
    () => buildCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const today_s = todayStr();
  const selectedAppts = selectedDay ? (byDate[selectedDay] ?? []) : [];

  return (
    <div>
      <PageHeader
        title="Agendamiento de Entregas"
        subtitle="Gestiona las fechas y asesores de entrega"
      />

      <div className="flex border-b border-gray-200 mb-6">
        {[
          { key: "calendar", label: "Calendario" },
          { key: "pending", label: "Pendientes de agendar" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
              tab === t.key
                ? "border-b-2 border-gray-900 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={5} />
      ) : tab === "calendar" ? (
        <div className="flex gap-5">
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <button
                onClick={prevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <h2 className="text-sm font-semibold text-gray-900">
                {MONTHS_ES[viewMonth]} {viewYear}
              </h2>
              <button
                onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarCells.map((cell, i) => {
                const appts = cell ? (byDate[cell] ?? []) : [];
                const isToday = cell === today_s;
                const isSelected = cell === selectedDay;

                return (
                  <div
                    key={i}
                    onClick={() => cell && setSelectedDay(cell === selectedDay ? null : cell)}
                    className={cn(
                      "min-h-[90px] p-1.5 border-b border-r border-gray-100 transition-colors",
                      cell ? "cursor-pointer" : "bg-gray-50/50",
                      isSelected && "bg-blue-50",
                      cell && !isSelected && "hover:bg-gray-50",
                      (i + 1) % 7 === 0 && "border-r-0",
                      i >= calendarCells.length - 7 && "border-b-0"
                    )}
                  >
                    {cell && (
                      <>
                        <div className="flex justify-end mb-1">
                          <span
                            className={cn(
                              "w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium",
                              isToday
                                ? "bg-gray-900 text-white"
                                : isSelected
                                ? "text-blue-700 font-semibold"
                                : "text-gray-600"
                            )}
                          >
                            {Number(cell.slice(-2))}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {appts.slice(0, 3).map((appt) => (
                            <div
                              key={appt.id}
                              onClick={(e) => { e.stopPropagation(); openEdit(appt); }}
                              className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-[10px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity",
                                colorForAdvisor(appt.assignedAdvisorUid)
                              )}
                              title={`${appt.scheduledTime} - ${appt.vehicle?.model ?? "Vehiculo"}`}
                            >
                              <span className="shrink-0">{appt.scheduledTime}</span>
                              <span className="truncate">{appt.vehicle?.model ?? "Vehiculo"}</span>
                            </div>
                          ))}
                          {appts.length > 3 && (
                            <p className="text-[10px] text-gray-400 pl-1">+{appts.length - 3} mas</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-72 shrink-0">
            {selectedDay ? (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden h-fit">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(selectedDay + "T00:00:00").toLocaleDateString("es-EC", {
                      weekday: "long", day: "numeric", month: "long",
                    }).replace(/^\w/, (c) => c.toUpperCase())}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedAppts.length} entrega{selectedAppts.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {selectedAppts.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <CalendarDays size={24} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Sin entregas este dia</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {selectedAppts
                      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
                      .map((appt) => (
                        <div key={appt.id} className="px-4 py-3">
                          <div className="flex items-start gap-2.5">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full mt-1.5 shrink-0",
                                colorForAdvisor(appt.assignedAdvisorUid)
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-900">
                                {appt.scheduledTime} - {appt.vehicle?.model ?? "Vehiculo"}
                              </p>
                              {appt.vehicle?.chassis && (
                                <p className="text-[11px] text-gray-500 mt-0.5 font-chassis truncate">
                                  {appt.vehicle.chassis}
                                </p>
                              )}
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {appt.assignedAdvisorName}
                              </p>
                              {appt.vehicle?.status && (
                                <div className="mt-1.5">
                                  <StatusBadge status={appt.vehicle.status} />
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => openEdit(appt)}
                              className="text-[10px] text-blue-600 hover:text-blue-800 font-medium shrink-0 cursor-pointer mt-0.5"
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-6 text-center h-fit">
                <CalendarDays size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Selecciona un dia para ver sus entregas</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Vehiculos con estado <strong>Listo para Entrega</strong> sin fecha asignada.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyVehicles
              .filter((v) => v.status === VehicleStatus.LISTO_PARA_ENTREGA)
              .map((v) => (
                <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{v.model} - {v.color}</p>
                    <p className="text-xs font-chassis text-gray-500">{v.chassis}</p>
                    <p className="text-xs text-gray-400 mt-1">{v.sede}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={v.status} />
                    <Button size="sm" icon={<Plus size={12} />} onClick={() => openCreate(v)}>
                      Agendar
                    </Button>
                  </div>
                </div>
              ))}
            {readyVehicles.filter((v) => v.status === VehicleStatus.LISTO_PARA_ENTREGA).length === 0 && (
              <p className="col-span-3 text-sm text-gray-400 text-center py-8">
                No hay vehiculos pendientes de agendar.
              </p>
            )}
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editAppointment ? "Reagendar entrega" : "Agendar entrega"}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editAppointment ? "Guardar cambios" : "Agendar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {selectedVehicle && (
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <p className="font-medium text-gray-900">{selectedVehicle.model}</p>
              <p className="text-xs text-gray-500 font-chassis">{selectedVehicle.chassis}</p>
            </div>
          )}
          <DateInput
            label="Fecha de entrega"
            value={form.scheduledDate}
            onChange={(v) => setForm((p) => ({ ...p, scheduledDate: v }))}
            required
          />
          <Input
            label="Hora"
            type="time"
            value={form.scheduledTime}
            onChange={(e) => setForm((p) => ({ ...p, scheduledTime: e.target.value }))}
            required
          />
          <Select
            label="Asesor asignado"
            value={form.assignedAdvisorUid}
            onChange={(e) => {
              const advisor = advisors.find((a) => a.uid === e.target.value);
              setForm((p) => ({
                ...p,
                assignedAdvisorUid: e.target.value,
                assignedAdvisorName: advisor?.displayName ?? "",
              }));
            }}
            options={advisors.map((a) => ({ value: a.uid, label: a.displayName }))}
            required
          />
        </div>
      </Modal>
    </div>
  );
}