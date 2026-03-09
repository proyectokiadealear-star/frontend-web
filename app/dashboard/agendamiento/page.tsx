"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getAppointments,
  getVehicles,
  getSedes,
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
import type { Appointment, Vehicle, UserProfile, CatalogItem } from "@/types";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  MapPin,
  User,
  IdCard,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildCalendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Only show appointments for AGENDADO vehicles (not ENTREGADO / CEDIDO)
const ACTIVE_STATUSES = new Set([
  VehicleStatus.AGENDADO,
  VehicleStatus.LISTO_PARA_ENTREGA,
]);

export default function AgendamientoPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [readyVehicles, setReadyVehicles] = useState<Vehicle[]>([]);
  const [advisors, setAdvisors] = useState<UserProfile[]>([]);
  const [sedes, setSedes] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"calendar" | "pending" | "list">("calendar");

  // Calendar navigation
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Filters
  const [filterSede, setFilterSede] = useState("");
  const [filterAdvisor, setFilterAdvisor] = useState("");

  // List tab filter
  const [listFilterDate, setListFilterDate] = useState(todayStr());

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editAppointment, setEditAppointment] = useState<Appointment | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vehicleId: "",
    scheduledDate: "",
    scheduledTime: "09:00",
    assignedAdvisorId: "",
    assignedAdvisorName: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [apptRes, readyRes, advisorRes, liderRes, sedeRes] = await Promise.all([
        getAppointments(),
        getVehicles({
          status: `${VehicleStatus.LISTO_PARA_ENTREGA},${VehicleStatus.AGENDADO}`,
          limit: 100,
        }),
        getUsers({ role: RoleEnum.ASESOR }),
        getUsers({ role: RoleEnum.LIDER_TECNICO }),
        getSedes(),
      ]);
      setAppointments(apptRes.data);
      setReadyVehicles(readyRes.data.data || []);
      // Merge asesores + líderes técnicos, sorted by name
      const merged = [...(advisorRes.data ?? []), ...(liderRes.data ?? [])];
      merged.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setAdvisors(merged);
      setSedes(sedeRes.data || []);
    } catch {
      toast.error("Error al cargar agendamientos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setEditAppointment(null);
    setForm({
      vehicleId: vehicle.id,
      scheduledDate: "",
      scheduledTime: "09:00",
      assignedAdvisorId: "",
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
      assignedAdvisorId: appt.assignedAdvisorId,
      assignedAdvisorName: appt.assignedAdvisorName,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.scheduledDate || !form.scheduledTime || !form.assignedAdvisorId) {
      toast.error("Completa todos los campos");
      return;
    }
    setSaving(true);
    try {
      if (editAppointment) {
        await updateAppointment(editAppointment.id, {
          scheduledDate: form.scheduledDate,
          scheduledTime: form.scheduledTime,
          assignedAdvisorId: form.assignedAdvisorId,
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

  // ── Filtered appointments: only AGENDADO, optionally by sede and advisor ──
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      // Only AGENDADO vehicles (usando campo plano del API)
      if (a.status !== VehicleStatus.AGENDADO) return false;
      // Sede filter (campo plano)
      if (filterSede && a.sede !== filterSede) return false;
      // Advisor filter (assignedAdvisorId es el campo real del API)
      if (filterAdvisor && a.assignedAdvisorId !== filterAdvisor) return false;
      return true;
    });
  }, [appointments, filterSede, filterAdvisor]);

  const byDate = useMemo(
    () =>
      filteredAppointments.reduce<Record<string, Appointment[]>>((acc, a) => {
        const d = a.scheduledDate;
        if (!acc[d]) acc[d] = [];
        acc[d].push(a);
        return acc;
      }, {}),
    [filteredAppointments]
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

  // KPI: count of AGENDADO this month
  const thisMonthPrefix = `${String(viewYear)}-${String(viewMonth + 1).padStart(2, "0")}`;
  const monthTotal = Object.entries(byDate)
    .filter(([d]) => d.startsWith(thisMonthPrefix))
    .reduce((sum, [, arr]) => sum + arr.length, 0);

  // List tab: filter all appointments by selected date
  const listAppointments = useMemo(() => {
    if (!listFilterDate) return appointments;
    return appointments.filter((a) => a.scheduledDate === listFilterDate);
  }, [appointments, listFilterDate]);

  return (
    <div>
      <PageHeader
        title="Agendamiento de Entregas"
        subtitle="Gestiona las fechas y asesores de entrega"
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { key: "calendar", label: "Calendario" },
          { key: "pending", label: "Pendientes de agendar" },
          { key: "list", label: "Listado" },
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
        <div className="space-y-4">
          {/* ── Toolbar: sede filter + advisor filter + month KPI ───────── */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Sede filter */}
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-gray-400 shrink-0" />
              <select
                value={filterSede}
                onChange={(e) => { setFilterSede(e.target.value); setSelectedDay(null); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
              >
                <option value="">Todas las sedes</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.code || s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Advisor filter */}
            <div className="flex items-center gap-2">
              <User size={15} className="text-gray-400 shrink-0" />
              <select
                value={filterAdvisor}
                onChange={(e) => { setFilterAdvisor(e.target.value); setSelectedDay(null); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
              >
                <option value="">Todos los asesores</option>
                {advisors.map((a) => (
                  <option key={a.uid} value={a.uid}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Month summary */}
            <div className="ml-auto flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
              <CalendarDays size={14} className="text-gray-400" />
              <span className="text-xs text-gray-600 font-medium">
                {monthTotal} agendado{monthTotal !== 1 ? "s" : ""} en {MONTHS_ES[viewMonth]}
                {filterSede ? ` · ${filterSede}` : ""}
                {filterAdvisor ? ` · ${advisors.find(a => a.uid === filterAdvisor)?.displayName ?? ""}` : ""}
              </span>
            </div>
          </div>

          {/* ── Calendar + side panel ───────────────────────────────────── */}
          <div className="flex gap-5">
            {/* Calendar grid */}
            <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {/* Month header */}
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

              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
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
                        "min-h-[96px] p-1.5 border-b border-r border-gray-100 transition-colors",
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
                            {appts.slice(0, 2).map((appt) => (
                              <div
                                key={appt.id}
                                onClick={(e) => { e.stopPropagation(); openEdit(appt); }}
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-white text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
                                  colorForAdvisor(appt.assignedAdvisorId)
                                )}
                                title={`${appt.scheduledTime} · ${appt.model ?? "Vehículo"}${appt.clientName ? ` · ${appt.clientName}` : ""}`}
                              >
                                {/* Line 1: time + model */}
                                <div className="flex items-center gap-1 truncate">
                                  <span className="shrink-0 opacity-80">{appt.scheduledTime}</span>
                                  <span className="truncate">{appt.model ?? "Vehículo"}</span>
                                </div>
                                {/* Line 2: client name (if available) */}
                                {appt.clientName && (
                                  <div className="truncate opacity-90 text-[9px] mt-0.5">
                                    {appt.clientName}
                                  </div>
                                )}
                              </div>
                            ))}
                            {appts.length > 2 && (
                              <p className="text-[10px] text-gray-400 pl-1">
                                +{appts.length - 2} más
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Side panel ────────────────────────────────────────────── */}
            <div className="w-80 shrink-0">
              {selectedDay ? (
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden h-fit">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(selectedDay + "T00:00:00").toLocaleDateString("es-EC", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }).replace(/^\w/, (c) => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selectedAppts.length} entrega
                      {selectedAppts.length !== 1 ? "s" : ""}
                      {filterSede ? ` · ${filterSede}` : ""}
                    </p>
                  </div>

                  {selectedAppts.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <CalendarDays size={24} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">Sin entregas este día</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                      {selectedAppts
                        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
                        .map((appt) => (
                          <AppointmentCard
                            key={appt.id}
                            appt={appt}
                            onEdit={() => openEdit(appt)}
                          />
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-6 text-center">
                  <CalendarDays size={28} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">
                    Selecciona un día para ver sus entregas
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : tab === "pending" ? (
        /* ── Pending tab ──────────────────────────────────────────────── */
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Vehículos con estado <strong>Listo para Entrega</strong> sin fecha asignada.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyVehicles
              .filter((v) => v.status === VehicleStatus.LISTO_PARA_ENTREGA)
              .map((v) => (
                <div
                  key={v.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 space-y-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {v.model} — {v.color}
                    </p>
                    <p className="text-xs font-chassis text-gray-500">{v.chassis}</p>
                    <p className="text-xs text-gray-400 mt-1">{v.sede}</p>
                    {v.clientName && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <User size={10} />
                        {v.clientName}
                        {v.clientId && (
                          <span className="text-gray-400">· {v.clientId}</span>
                        )}
                      </p>
                    )}
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
                No hay vehículos pendientes de agendar.
              </p>
            )}
          </div>
        </div>
      ) : (
        /* ── List tab ─────────────────────────────────────────────────── */
        <div className="space-y-4">
          {/* Date filter */}
          <div className="flex items-center gap-3">
            <div className="w-52">
              <DateInput
                label=""
                value={listFilterDate}
                onChange={(v) => setListFilterDate(v)}
              />
            </div>
            <span className="text-sm text-gray-500">
              {listAppointments.length} agendado{listAppointments.length !== 1 ? "s" : ""}
              {listFilterDate
                ? ` · ${new Date(listFilterDate + "T00:00:00").toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}`
                : ""}
            </span>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">VIN / Chasis</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Cédula</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Asesor / T. Líder</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Fecha</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {listAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-sm text-gray-400 py-10">
                      No hay agendamientos para este día.
                    </td>
                  </tr>
                ) : (
                  listAppointments
                    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
                    .map((appt) => (
                      <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-chassis text-xs text-gray-500">
                          {appt.chassis ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {appt.clientName ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {appt.clientId ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {appt.assignedAdvisorName ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {appt.scheduledDate}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {appt.scheduledTime}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Agendar / Reagendar ─────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editAppointment ? "Reagendar entrega" : "Agendar entrega"}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editAppointment ? "Guardar cambios" : "Agendar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {selectedVehicle && (
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm space-y-1">
              <p className="font-medium text-gray-900">
                {selectedVehicle.model} — {selectedVehicle.color}
              </p>
              <p className="text-xs text-gray-500 font-chassis">
                {selectedVehicle.chassis}
              </p>
              {selectedVehicle.clientName && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <User size={11} />
                  {selectedVehicle.clientName}
                  {selectedVehicle.clientId && (
                    <span className="text-gray-400 ml-1">· C.I. {selectedVehicle.clientId}</span>
                  )}
                </p>
              )}
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
            value={form.assignedAdvisorId}
            onChange={(e) => {
              const advisor = advisors.find((a) => a.uid === e.target.value);
              setForm((p) => ({
                ...p,
                assignedAdvisorId: e.target.value,
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

// ── Sub-component: side panel appointment card ────────────────────────────────
function AppointmentCard({
  appt,
  onEdit,
}: {
  appt: Appointment;
  onEdit: () => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "w-2 h-2 rounded-full mt-1.5 shrink-0",
            colorForAdvisor(appt.assignedAdvisorId)
          )}
        />
        <div className="flex-1 min-w-0 space-y-1">
          {/* Time + model */}
          <p className="text-xs font-semibold text-gray-900 flex items-center gap-1">
            <Clock size={11} className="text-gray-400 shrink-0" />
            {appt.scheduledTime}
            <span className="text-gray-400 font-normal">·</span>
            <span className="truncate">{appt.model ?? "Vehículo"}</span>
          </p>

          {/* Chassis */}
          {appt.chassis && (
            <p className="text-[11px] text-gray-400 font-chassis truncate">
              {appt.chassis}
            </p>
          )}

          {/* Client name */}
          {appt.clientName && (
            <p className="text-[11px] text-gray-600 flex items-center gap-1">
              <User size={10} className="text-gray-400 shrink-0" />
              <span className="font-medium">{appt.clientName}</span>
            </p>
          )}

          {/* Client ID */}
          {appt.clientId && (
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <IdCard size={10} className="text-gray-400 shrink-0" />
              C.I. {appt.clientId}
            </p>
          )}

          {/* Sede */}
          {appt.sede && (
            <p className="text-[11px] text-gray-400 flex items-center gap-1">
              <MapPin size={10} className="shrink-0" />
              {appt.sede}
            </p>
          )}

          {/* Advisor */}
          <p className="text-[11px] text-gray-400">{appt.assignedAdvisorName}</p>

          {/* Status */}
          {appt.status && (
            <div className="pt-0.5">
              <StatusBadge status={appt.status as import("@/lib/constants").VehicleStatusType} />
            </div>
          )}
        </div>

        <button
          onClick={onEdit}
          className="text-[10px] text-blue-600 hover:text-blue-800 font-medium shrink-0 cursor-pointer mt-0.5"
        >
          Editar
        </button>
      </div>
    </div>
  );
}
