import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type { Vehicle } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Car, Clock } from "lucide-react";
import React from "react";

interface VehicleCardProps {
  vehicle: Vehicle;
  onClick?: () => void;
  footer?: React.ReactNode;
  className?: string;
  /** Si se pasa, activa el modo BODEGUERO con indicador visual de visto/no visto */
  seen?: boolean;
  /** Muestra la fecha de última modificación prominentemente */
  showLastModified?: boolean;
}

export function VehicleCard({
  vehicle,
  onClick,
  footer,
  className,
  seen,
  showLastModified,
}: VehicleCardProps) {
  const isBodegueroMode = seen !== undefined;
  const isNew = isBodegueroMode && !seen;

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl overflow-hidden bg-white transition-all duration-300",
        // Borde dinámico según estado bodeguero
        isBodegueroMode
          ? isNew
            ? "border-2 border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.3)] hover:shadow-[0_0_0_3px_rgba(239,68,68,0.2),0_4px_12px_rgba(0,0,0,0.08)]"
            : "border-2 border-gray-200 opacity-70 hover:opacity-100 hover:shadow-md"
          : "border border-gray-200 hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Vehicle image */}
      <div className={cn(
        "h-36 flex items-center justify-center overflow-hidden relative",
        isBodegueroMode && !seen ? "bg-red-50" : "bg-gray-100"
      )}>
        {vehicle.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vehicle.photoUrl}
            alt={`${vehicle.model} ${vehicle.chassis}`}
            className={cn("w-full h-full object-cover", isBodegueroMode && seen && "grayscale-[30%]")}
          />
        ) : (
          <Car size={40} className={cn(isBodegueroMode && !seen ? "text-red-200" : "text-gray-300")} />
        )}

        {/* Badge NUEVO */}
        {isNew && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow">
            Nuevo
          </span>
        )}
        {/* Badge VISTO */}
        {isBodegueroMode && seen && (
          <span className="absolute top-2 right-2 bg-gray-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            Visto
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("text-sm font-semibold truncate", isBodegueroMode && seen ? "text-gray-500" : "text-gray-900")}>
              {vehicle.model} — {vehicle.color}
            </p>
            <p className="text-xs font-chassis text-gray-500 truncate mt-0.5">
              {vehicle.chassis}
            </p>
          </div>
          <StatusBadge status={vehicle.status} />
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{vehicle.sede}</span>
          <span>·</span>
          <span>{vehicle.year}</span>
        </div>

        {/* Fecha última acción del pipeline (modo bodeguero o explícito) */}
        {(showLastModified || isBodegueroMode) && (vehicle.statusChangedAt || vehicle.updatedAt) && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1",
            isNew
              ? "bg-red-50 text-red-600"
              : "bg-gray-50 text-gray-500"
          )}>
            <Clock size={11} className="flex-shrink-0" />
            <span>Últ. acción {formatDateTime(vehicle.statusChangedAt ?? vehicle.updatedAt)}</span>
          </div>
        )}

        {/* Fecha estándar (cuando NO es modo bodeguero) */}
        {!showLastModified && !isBodegueroMode && (
          <p className="text-xs text-gray-400">
            {vehicle.registeredDate
              ? `Registro ${formatDate(vehicle.registeredDate)}`
              : vehicle.receptionDate
              ? `Recep. ${formatDate(vehicle.receptionDate)}`
              : `Creado ${formatDate(vehicle.createdAt)}`}
          </p>
        )}

        {footer && <div className="pt-2 border-t border-gray-100">{footer}</div>}
      </div>
    </div>
  );
}
