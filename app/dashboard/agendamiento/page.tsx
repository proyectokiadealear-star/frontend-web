"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  getAppointments,
  fetchAllPagesCursor,
  getSedes,
  createAppointment,
  updateAppointment,
  getUsers,
  isRequestAborted,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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
  Building2,
  TrendingUp,
  Search,
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
  const { user } = useAuth();
  // Roles that CAN schedule: JEFE_TALLER, SOPORTE, ASESOR, LIDER_TECNICO
  // Read-only roles: BODEGUERO, PERSONAL_TALLER, DOCUMENTACION
  const SCHEDULING_ROLES = new Set([
    RoleEnum.JEFE_TALLER,
    RoleEnum.SOPORTE,
    RoleEnum.ASESOR,
    RoleEnum.LIDER_TECNICO,
  ]);
  const isReadOnly = !user?.role || !SCHEDULING_ROLES.has(user.role as Parameters<typeof SCHEDULING_ROLES.has>[0]);
  const canFilterSede =
    user?.role === RoleEnum.JEFE_TALLER || user?.role === RoleEnum.SOPORTE || user?.role === RoleEnum.SUPERVISOR;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [readyVehicles, setReadyVehicles] = useState<Vehicle[]>([]);
  const [vehiclesPagesFetched, setVehiclesPagesFetched] = useState(0);
  const [vehiclesLoadedCount, setVehiclesLoadedCount] = useState(0);
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
  const fetchControllerRef = useRef<AbortController | null>(null);

  /** Fetch ALL vehicles for the given statuses using cursor pagination */
  const fetchAllVehicles = useCallback(async (statuses: string, signal?: AbortSignal): Promise<Vehicle[]> => {
    const { items } = await fetchAllPagesCursor<Vehicle>("/vehicles", {
      params: { status: statuses },
      limit: 200,
      maxPages: 50,
      signal,
      onPage: async (pageData, meta) => {
        setVehiclesPagesFetched(meta.pageNumber);
        setVehiclesLoadedCount(meta.accumulated);
        setReadyVehicles((prev) =>
          meta.pageNumber === 1 ? [...pageData.data] : [...prev, ...pageData.data],
        );
      },
    });
    return items;
  }, []);

  const fetchData = useCallback(async () => {
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    setLoading(true);
    setVehiclesPagesFetched(0);
    setVehiclesLoadedCount(0);
    setReadyVehicles([]);
    try {
      const [apptRes, readyVehiclesAll, advisorRes, liderRes, sedeRes] = await Promise.all([
        getAppointments(undefined, { signal: controller.signal }),
        fetchAllVehicles(`${VehicleStatus.LISTO_PARA_ENTREGA},${VehicleStatus.AGENDADO}`, controller.signal),
        getUsers({ role: RoleEnum.ASESOR }, { signal: controller.signal }),
        getUsers({ role: RoleEnum.LIDER_TECNICO }, { signal: controller.signal }),
        getSedes({ signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;

      setAppointments(apptRes.data.data ?? []);
      setReadyVehicles(readyVehiclesAll);
      // Merge asesores + líderes técnicos, sorted by name
      const merged = [...(advisorRes.data ?? []), ...(liderRes.data ?? [])];
      merged.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setAdvisors(merged);
      setSedes(sedeRes.data || []);
    } catch (error) {
      if (isRequestAborted(error)) return;
      toast.error("Error al cargar agendamientos");
    } finally {
      if (fetchControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [fetchAllVehicles]);

  useEffect(() => {
    fetchData();
    return () => {
      fetchControllerRef.current?.abort();
    };
  }, [fetchData]);

  const openCreate = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setEditAppointment(null);
    // Pre-select current user as advisor if they are ASESOR or LIDER_TECNICO
    const isSelfRole =
      user?.role === RoleEnum.ASESOR || user?.role === RoleEnum.LIDER_TECNICO;
    setForm({
      vehicleId: vehicle.id,
      scheduledDate: "",
      scheduledTime: "09:00",
      assignedAdvisorId: isSelfRole ? (user?.uid ?? "") : "",
      assignedAdvisorName: isSelfRole ? (user?.displayName ?? "") : "",
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

  // List tab filter: sede
  const [listFilterSede, setListFilterSede] = useState("");

  // Pending tab filters
  const [pendingSearchChassis, setPendingSearchChassis] = useState("");
  const [pendingFilterSede, setPendingFilterSede] = useState("");

  // ── Pagination state ──────────────────────────────────────────────────────
  const PENDING_PAGE_SIZE = 12;
  const LIST_PAGE_SIZE = 15;
  const [pendingPage, setPendingPage] = useState(1);
  const [listPage, setListPage] = useState(1);

  // List tab: filter all appointments by selected date + sede
  const listAppointments = useMemo(() => {
    const filtered = appointments.filter((a) => {
      if (listFilterDate && a.scheduledDate !== listFilterDate) return false;
      if (listFilterSede && a.sede !== listFilterSede) return false;
      return true;
    });
    // Sort: active (not delivered) first, then already delivered (ENTREGADO / CEDIDO) at the bottom
    const DELIVERED_STATUSES = [VehicleStatus.ENTREGADO, VehicleStatus.CEDIDO] as string[];
    return [...filtered].sort((a, b) => {
      const aDelivered = DELIVERED_STATUSES.includes(a.status ?? "");
      const bDelivered = DELIVERED_STATUSES.includes(b.status ?? "");
      if (aDelivered !== bDelivered) return aDelivered ? 1 : -1;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });
  }, [appointments, listFilterDate, listFilterSede]);

  // ── Sede config (colores + labels) ────────────────────────────────────────
  const SEDE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    SURMOTOR:       { label: "Surmotor",       color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", dot: "bg-emerald-500" },
    SHYRIS:         { label: "Shyris",          color: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200",  dot: "bg-orange-500"  },
    GRANDA_CENTENO: { label: "Granda Centeno",  color: "text-violet-700",  bg: "bg-violet-50",   border: "border-violet-200",  dot: "bg-violet-500"  },
  };
  const SEDE_ORDER = ["SURMOTOR", "SHYRIS", "GRANDA_CENTENO"];

  // ── Contadores por sede (siempre sobre fecha seleccionada, sin filtro de sede) ──
  const sedeCounters = useMemo(() => {
    const base = appointments.filter((a) =>
      listFilterDate ? a.scheduledDate === listFilterDate : true
    );
    const counts: Record<string, number> = {};
    for (const sede of SEDE_ORDER) {
      counts[sede] = base.filter((a) => a.sede === sede).length;
    }
    counts["TOTAL"] = base.length;
    return counts;
  }, [appointments, listFilterDate]);

  // ── Pending tab: vehículos filtrados ─────────────────────────────────────
  const pendingVehiclesAll = useMemo(() => {
    return readyVehicles.filter((v) => {
      if (v.status !== VehicleStatus.LISTO_PARA_ENTREGA) return false;
      if (pendingSearchChassis && !v.chassis?.toLowerCase().includes(pendingSearchChassis.toLowerCase())) return false;
      if (canFilterSede && pendingFilterSede && v.sede !== pendingFilterSede) return false;
      return true;
    });
  }, [readyVehicles, pendingSearchChassis, pendingFilterSede, canFilterSede]);

  // Reset pending page when filters change
  useEffect(() => { setPendingPage(1); }, [pendingSearchChassis, pendingFilterSede]);

  const pendingTotalPages = Math.max(1, Math.ceil(pendingVehiclesAll.length / PENDING_PAGE_SIZE));
  const pendingVehicles = useMemo(() => {
    const start = (pendingPage - 1) * PENDING_PAGE_SIZE;
    return pendingVehiclesAll.slice(start, start + PENDING_PAGE_SIZE);
  }, [pendingVehiclesAll, pendingPage]);

  // Reset list page when filters change
  useEffect(() => { setListPage(1); }, [listFilterDate, listFilterSede]);

  // ── List tab: paginated appointments grouped by sede ──────────────────────
  const listTotalPages = Math.max(1, Math.ceil(listAppointments.length / LIST_PAGE_SIZE));
  const paginatedListAppointments = useMemo(() => {
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    return listAppointments.slice(start, start + LIST_PAGE_SIZE);
  }, [listAppointments, listPage]);

  const paginatedListBySede = useMemo(() => {
    const groups: Record<string, typeof paginatedListAppointments> = {};
    for (const appt of paginatedListAppointments) {
      const sede = appt.sede ?? "OTRAS";
      if (!groups[sede]) groups[sede] = [];
      groups[sede].push(appt);
    }
    const ordered: Array<{ sede: string; appts: typeof paginatedListAppointments }> = [];
    for (const sede of SEDE_ORDER) {
      if (groups[sede]?.length) ordered.push({ sede, appts: groups[sede] });
    }
    for (const sede of Object.keys(groups)) {
      if (!SEDE_ORDER.includes(sede)) ordered.push({ sede, appts: groups[sede] });
    }
    return ordered;
  }, [paginatedListAppointments]);

  return (
    <div>
      <PageHeader
        title="Agendamiento de Entregas"
        subtitle="Gestiona las fechas y asesores de entrega"
      />

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 mb-6 -mx-1 px-1">
        {[
          { key: "calendar", label: "Calendario" },
          { key: "pending", label: "Pendientes de agendar" },
          { key: "list", label: "Listado" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              tab === t.key
                ? "border-b-2 border-gray-900 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && vehiclesPagesFetched > 0 && (
        <p className="text-xs text-gray-500 -mt-2 mb-4">
          Cargando vehiculos pendientes: {vehiclesLoadedCount} ({vehiclesPagesFetched} pagina{vehiclesPagesFetched !== 1 ? "s" : ""})
        </p>
      )}

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
          <div className="flex flex-col lg:flex-row gap-5">
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
                                onClick={(e) => { e.stopPropagation(); if (!isReadOnly) openEdit(appt); }}
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-white text-[10px] font-medium hover:opacity-80 transition-opacity",
                                  isReadOnly ? "cursor-default" : "cursor-pointer",
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
            <div className="w-full lg:w-80 shrink-0">
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
                            isReadOnly={isReadOnly}
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
        <div className="space-y-4">
          {/* ── Toolbar: búsqueda + filtro sede ── */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Búsqueda por chasis */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar chasis…"
                value={pendingSearchChassis}
                onChange={(e) => setPendingSearchChassis(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 w-52"
              />
            </div>
            {/* Filtro por sede — solo para JEFE_TALLER / SOPORTE */}
            {canFilterSede && (
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-gray-400 shrink-0" />
                <select
                  value={pendingFilterSede}
                  onChange={(e) => setPendingFilterSede(e.target.value)}
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
            )}
            {/* Conteo de resultados */}
            <span className="text-sm text-gray-500">
              {pendingVehiclesAll.length} vehículo{pendingVehiclesAll.length !== 1 ? "s" : ""} pendiente{pendingVehiclesAll.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* ── Grid de tarjetas ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingVehicles.map((v) => (
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
                  {!isReadOnly && (
                    <Button size="sm" icon={<Plus size={12} />} onClick={() => openCreate(v)}>
                      Agendar
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {pendingVehiclesAll.length === 0 && (
              <div className="col-span-3 py-14 text-center">
                <Search size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  {readyVehicles.filter((v) => v.status === VehicleStatus.LISTO_PARA_ENTREGA).length === 0
                    ? "No hay vehículos pendientes de agendar."
                    : "Sin resultados para los filtros aplicados."}
                </p>
              </div>
            )}
          </div>

          {/* ── Paginación Pendientes ── */}
          {pendingTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                disabled={pendingPage <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: pendingTotalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pendingTotalPages || Math.abs(p - pendingPage) <= 2)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] ?? 0) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`dot-${i}`} className="text-xs text-gray-400 px-1">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPendingPage(p as number)}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors cursor-pointer",
                        pendingPage === p
                          ? "bg-gray-900 text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPendingPage((p) => Math.min(pendingTotalPages, p + 1))}
                disabled={pendingPage >= pendingTotalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight size={14} />
              </button>
              <span className="text-xs text-gray-400 ml-2">
                Pág. {pendingPage} de {pendingTotalPages}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* ── List tab ─────────────────────────────────────────────────── */
        <div className="space-y-5">
          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-52">
              <DateInput
                label=""
                value={listFilterDate}
                onChange={(v) => setListFilterDate(v)}
              />
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-gray-400 shrink-0" />
              <select
                value={listFilterSede}
                onChange={(e) => setListFilterSede(e.target.value)}
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
            <span className="text-sm text-gray-500">
              {listAppointments.length} agendado{listAppointments.length !== 1 ? "s" : ""}
              {listFilterDate
                ? ` · ${new Date(listFilterDate + "T00:00:00").toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}`
                : ""}
              {listFilterSede ? ` · ${listFilterSede}` : ""}
            </span>
          </div>

          {/* ── Dashboard de contadores ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total */}
            <div className="bg-gray-900 rounded-2xl px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <TrendingUp size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total</p>
                <p className="text-2xl font-black text-white leading-none mt-0.5">{sedeCounters["TOTAL"]}</p>
              </div>
            </div>
            {/* Por sede */}
            {SEDE_ORDER.map((sede) => {
              const cfg = SEDE_CONFIG[sede];
              return (
                <div
                  key={sede}
                  className={cn("rounded-2xl px-5 py-4 flex items-center gap-4 border", cfg.bg, cfg.border)}
                >
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white/60")}>
                    <Building2 size={18} className={cfg.color} />
                  </div>
                  <div>
                    <p className={cn("text-[11px] font-semibold uppercase tracking-wider", cfg.color)}>{cfg.label}</p>
                    <p className={cn("text-2xl font-black leading-none mt-0.5", cfg.color)}>{sedeCounters[sede] ?? 0}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Tabla agrupada por sede ── */}
          {listAppointments.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl py-14 text-center">
              <CalendarDays size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No hay agendamientos para este día.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedListBySede.map(({ sede, appts }) => {
                const cfg = SEDE_CONFIG[sede];
                return (
                  <div key={sede} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    {/* Encabezado de sede */}
                    <div className={cn("flex items-center gap-3 px-5 py-3 border-b", cfg ? cfg.bg : "bg-gray-50", cfg ? cfg.border : "border-gray-200")}>
                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg ? cfg.dot : "bg-gray-400")} />
                      <Building2 size={14} className={cn("shrink-0", cfg ? cfg.color : "text-gray-500")} />
                      <span className={cn("text-sm font-semibold", cfg ? cfg.color : "text-gray-700")}>
                        {cfg?.label ?? sede}
                      </span>
                      <span className={cn(
                        "ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full",
                        cfg ? `${cfg.bg} ${cfg.color} border ${cfg.border}` : "bg-gray-100 text-gray-600"
                      )}>
                        {appts.length} {appts.length === 1 ? "entrega" : "entregas"}
                      </span>
                    </div>

                    {/* Tabla de esa sede */}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/60">
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5">VIN / Chasis</th>
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5">Modelo / Color</th>
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5">Cliente</th>
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5">Cédula</th>
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5">Asesor / T. Líder</th>
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5">Fecha</th>
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5">Hora</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {appts.map((appt) => {
                            const isDelivered = ([VehicleStatus.ENTREGADO, VehicleStatus.CEDIDO] as string[]).includes(
                              appt.status ?? ""
                            );
                            return (
                              <tr
                                key={appt.id}
                                className={cn(
                                  "transition-colors",
                                  isDelivered ? "bg-gray-50 opacity-60" : "hover:bg-gray-50"
                                )}
                              >
                                <td className={cn("px-4 py-3 font-chassis text-xs", isDelivered ? "text-gray-400" : "text-gray-500")}>
                                  {appt.chassis ?? "—"}
                                </td>
                                <td className={cn("px-4 py-3", isDelivered ? "text-gray-400" : "text-gray-700")}>
                                  <p className={cn("text-sm font-medium leading-snug", isDelivered ? "text-gray-400" : "text-gray-900")}>
                                    {appt.model ?? "—"}
                                  </p>
                                  {appt.color && (
                                    <p className={cn("text-xs leading-snug", isDelivered ? "text-gray-400" : "text-gray-500")}>
                                      {appt.color}
                                    </p>
                                  )}
                                </td>
                                <td className={cn("px-4 py-3 font-medium", isDelivered ? "text-gray-400 line-through" : "text-gray-900")}>
                                  {appt.clientName ?? "—"}
                                </td>
                                <td className={cn("px-4 py-3", isDelivered ? "text-gray-400" : "text-gray-500")}>
                                  {appt.clientId ?? "—"}
                                </td>
                                <td className={cn("px-4 py-3", isDelivered ? "text-gray-400" : "text-gray-700")}>
                                  {appt.assignedAdvisorName ?? "—"}
                                </td>
                                <td className={cn("px-4 py-3", isDelivered ? "text-gray-400" : "text-gray-500")}>
                                  {appt.scheduledDate}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Clock size={12} className={isDelivered ? "text-gray-300" : "text-gray-400"} />
                                    <span className={cn("text-sm", isDelivered ? "text-gray-400" : "text-gray-500")}>
                                      {appt.scheduledTime}
                                    </span>
                                    {isDelivered && (
                                      <StatusBadge status={appt.status as import("@/lib/constants").VehicleStatusType} />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* ── Paginación Listado ── */}
              {listTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                    disabled={listPage <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: listTotalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === listTotalPages || Math.abs(p - listPage) <= 2)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] ?? 0) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "..." ? (
                        <span key={`dot-${i}`} className="text-xs text-gray-400 px-1">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setListPage(p as number)}
                          className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors cursor-pointer",
                            listPage === p
                              ? "bg-gray-900 text-white"
                              : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                          )}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))}
                    disabled={listPage >= listTotalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <span className="text-xs text-gray-400 ml-2">
                    Pág. {listPage} de {listTotalPages}
                  </span>
                </div>
              )}
            </div>
          )}
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
  isReadOnly = false,
}: {
  appt: Appointment;
  onEdit: () => void;
  isReadOnly?: boolean;
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

        {!isReadOnly && (
          <button
            onClick={onEdit}
            className="text-[10px] text-blue-600 hover:text-blue-800 font-medium shrink-0 cursor-pointer mt-0.5"
          >
            Editar
          </button>
        )}
      </div>
    </div>
  );
}
