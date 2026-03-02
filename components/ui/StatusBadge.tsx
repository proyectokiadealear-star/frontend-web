"use client";

import { cn } from "@/lib/utils";
import { VehicleStatusColor, VehicleStatusLabel, type VehicleStatusType } from "@/lib/constants";

interface StatusBadgeProps {
  status: VehicleStatusType;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border border-transparent",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        VehicleStatusColor[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {VehicleStatusLabel[status] ?? status}
    </span>
  );
}
