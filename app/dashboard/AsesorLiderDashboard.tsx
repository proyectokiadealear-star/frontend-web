"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAppointments } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Appointment } from "@/types";
import { CalendarDays, Clock, User, MapPin, Car } from "lucide-react";
import toast from "react-hot-toast";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isCurrentOrPast(time: string): boolean {
  const now = new Date();
  const [h, m] = time.split(":").map(Number);
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
}

function isNext(appts: Appointment[], appt: Appointment): boolean {
  const future = appts.filter((a) => !isCurrentOrPast(a.scheduledTime));
  if (future.length === 0) return false;
  return (
    future.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))[0].id === appt.id
  );
}

export function AsesorLiderDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAppointments();
      setAppointments(res.data);
    } catch {
      toast.error("Error al cargar agendamientos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = todayStr();
  const todayAppts = appointments
    .filter((a) => a.scheduledDate === today)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  const todayLabel = new Date().toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle={`Hola, ${user?.displayName || user?.email}`}
      />

      <div className="max-w-xl">
        {/* Header de la sección */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 capitalize">{todayLabel}</span>
          </div>
          {!loading && (
            <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2.5 py-0.5 rounded-full">
              {todayAppts.length} {todayAppts.length === 1 ? "cita" : "citas"}
            </span>
          )}
        </div>

        {loading ? (
          <TimelineSkeleton />
        ) : todayAppts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <CalendarDays size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No hay citas programadas para hoy.</p>
          </div>
        ) : (
          <ol className="relative">
            {todayAppts.map((appt, idx) => {
              const past = isCurrentOrPast(appt.scheduledTime);
              const next = isNext(todayAppts, appt);
              const isLast = idx === todayAppts.length - 1;

              return (
                <li key={appt.id} className="flex gap-4">
                  {/* Timeline track */}
                  <div className="flex flex-col items-center">
                    {/* Dot */}
                    <div
                      className={`
                        w-3 h-3 mt-0.5 rounded-full shrink-0 border-2 transition-colors
                        ${past
                          ? "bg-gray-300 border-gray-300"
                          : next
                          ? "bg-gray-900 border-gray-900 ring-4 ring-gray-900/10"
                          : "bg-white border-gray-300"
                        }
                      `}
                    />
                    {/* Line */}
                    {!isLast && (
                      <div className="w-px flex-1 bg-gray-200 my-1" />
                    )}
                  </div>

                  {/* Card */}
                  <div
                    className={`
                      mb-4 flex-1 rounded-xl border px-4 py-3 transition-colors
                      ${past
                        ? "bg-gray-50 border-gray-200 opacity-60"
                        : next
                        ? "bg-white border-gray-900 shadow-sm"
                        : "bg-white border-gray-200"
                      }
                    `}
                  >
                    {/* Time + model */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          next ? "text-gray-900" : past ? "text-gray-400" : "text-gray-700"
                        }`}
                      >
                        {appt.scheduledTime}
                      </span>
                      {next && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-gray-900 text-white px-2 py-0.5 rounded-full">
                          Siguiente
                        </span>
                      )}
                      {past && (
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Completada
                        </span>
                      )}
                    </div>

                    {/* Model */}
                    {appt.model && (
                      <p className={`text-sm font-semibold flex items-center gap-1.5 mb-1 ${past ? "text-gray-400" : "text-gray-800"}`}>
                        <Car size={12} className="shrink-0 text-gray-400" />
                        {appt.model}
                      </p>
                    )}

                    {/* Client */}
                    {appt.clientName && (
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-0.5">
                        <User size={10} className="shrink-0 text-gray-400" />
                        {appt.clientName}
                        {appt.clientId && (
                          <span className="text-gray-400">· C.I. {appt.clientId}</span>
                        )}
                      </p>
                    )}

                    {/* Sede / Advisor */}
                    <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1">
                      {appt.sede && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} />
                          {appt.sede}
                        </span>
                      )}
                      {appt.assignedAdvisorName && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {appt.assignedAdvisorName}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <ol className="relative space-y-4">
      {[1, 2, 3].map((i) => (
        <li key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 mt-0.5 rounded-full bg-gray-200 shrink-0" />
            {i < 3 && <div className="w-px flex-1 bg-gray-100 my-1 h-14" />}
          </div>
          <div className="flex-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-4 animate-pulse">
            <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-32 bg-gray-200 rounded mb-1.5" />
            <div className="h-2.5 w-24 bg-gray-100 rounded" />
          </div>
        </li>
      ))}
    </ol>
  );
}
