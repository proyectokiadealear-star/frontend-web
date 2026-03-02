import { cn, formatDate } from "@/lib/utils";
import type { Vehicle } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Car } from "lucide-react";
import React from "react";

interface VehicleCardProps {
  vehicle: Vehicle;
  onClick?: () => void;
  footer?: React.ReactNode;
  className?: string;
}

export function VehicleCard({ vehicle, onClick, footer, className }: VehicleCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "border border-gray-200 rounded-xl overflow-hidden bg-white",
        "transition-shadow hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Vehicle image */}
      <div className="h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
        {vehicle.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vehicle.photoUrl}
            alt={`${vehicle.model} ${vehicle.chassis}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <Car size={40} className="text-gray-300" />
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
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

        <p className="text-xs text-gray-400">
          Recep. {formatDate(vehicle.receptionDate)}
        </p>

        {footer && <div className="pt-2 border-t border-gray-100">{footer}</div>}
      </div>
    </div>
  );
}
