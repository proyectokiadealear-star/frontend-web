import { formatDateTime } from "@/lib/utils";
import { VehicleStatusLabel } from "@/lib/constants";
import type { StatusHistoryEntry } from "@/types";
import type { VehicleStatusType } from "@/lib/constants";

interface TraceabilityTimelineProps {
  history: StatusHistoryEntry[];
}

const STATUS_DOT: Partial<Record<VehicleStatusType, string>> = {
  POR_ARRIBAR: "bg-gray-400",
  ENVIADO_A_MATRICULAR: "bg-indigo-400",
  CERTIFICADO_STOCK: "bg-blue-400",
  DOCUMENTACION_PENDIENTE: "bg-amber-400",
  DOCUMENTADO: "bg-violet-400",
  ORDEN_GENERADA: "bg-sky-400",
  ASIGNADO: "bg-sky-600",
  EN_INSTALACION: "bg-orange-400",
  INSTALACION_COMPLETA: "bg-green-400",
  REAPERTURA_OT: "bg-red-400",
  LISTO_PARA_ENTREGA: "bg-green-600",
  AGENDADO: "bg-emerald-400",
  ENTREGADO: "bg-gray-900",
  CEDIDO: "bg-gray-300",
};

const STATUS_BORDER: Partial<Record<VehicleStatusType, string>> = {
  POR_ARRIBAR: "border-l-gray-300",
  ENVIADO_A_MATRICULAR: "border-l-indigo-400",
  CERTIFICADO_STOCK: "border-l-blue-400",
  DOCUMENTACION_PENDIENTE: "border-l-amber-400",
  DOCUMENTADO: "border-l-violet-400",
  ORDEN_GENERADA: "border-l-sky-400",
  ASIGNADO: "border-l-sky-600",
  EN_INSTALACION: "border-l-orange-400",
  INSTALACION_COMPLETA: "border-l-green-400",
  REAPERTURA_OT: "border-l-red-400",
  LISTO_PARA_ENTREGA: "border-l-green-600",
  AGENDADO: "border-l-emerald-400",
  ENTREGADO: "border-l-gray-900",
  CEDIDO: "border-l-gray-200",
};

export function TraceabilityTimeline({ history }: TraceabilityTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <span className="text-gray-300 text-xl">·</span>
        </div>
        <p className="text-sm text-gray-400">Sin historial disponible.</p>
      </div>
    );
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  );

  return (
    <div className="relative pl-6">
      {/* vertical rail */}
      <div className="absolute left-2.5 top-3 bottom-3 w-px bg-gray-200" />

      <div className="space-y-3">
        {sorted.map((entry, i) => {
          const isLast = i === sorted.length - 1;
          const dotColor = STATUS_DOT[entry.status] ?? "bg-gray-300";
          const borderColor = STATUS_BORDER[entry.status] ?? "border-l-gray-200";

          return (
            <div key={entry.id ?? i} className="relative flex gap-3">
              {/* dot */}
              <div
                className={`absolute -left-6 mt-3.5 w-3.5 h-3.5 rounded-full border-2 border-white ring-2 ring-gray-100 shrink-0 ${dotColor} ${
                  isLast ? "ring-gray-900 ring-offset-0" : ""
                }`}
              />

              {/* card */}
              <div
                className={`flex-1 bg-white border border-gray-100 border-l-4 rounded-xl px-4 py-3 shadow-sm ${borderColor}`}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${isLast ? "text-gray-900" : "text-gray-700"}`}>
                    {VehicleStatusLabel[entry.status] ?? entry.status}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatDateTime(entry.changedAt)}
                  </span>
                </div>
                {(entry.changedByName || entry.sede) && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                    {entry.changedByName && (
                      <span className="text-xs text-gray-500">{entry.changedByName}</span>
                    )}
                    {entry.sede && (
                      <span className="text-xs text-gray-400">·&nbsp;{entry.sede}</span>
                    )}
                  </div>
                )}
                {entry.notes && (
                  <p className="text-xs text-gray-400 italic mt-2 pt-2 border-t border-gray-100">
                    {entry.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
