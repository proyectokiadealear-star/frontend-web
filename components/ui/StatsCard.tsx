import { cn } from "@/lib/utils";
import React from "react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: "default" | "blue" | "green" | "amber" | "red";
  trend?: string;
  className?: string;
}

const colorMap = {
  default: "bg-gray-50 text-gray-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
};

const iconColorMap = {
  default: "bg-gray-100 text-gray-500",
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-600",
  amber: "bg-amber-100 text-amber-600",
  red: "bg-red-100 text-red-600",
};

export function StatsCard({
  label,
  value,
  icon,
  color = "default",
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-5 flex items-start gap-4",
        className
      )}
    >
      {icon && (
        <div className={cn("p-2.5 rounded-lg flex-shrink-0", iconColorMap[color])}>
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {trend && <span className="text-xs text-gray-400">{trend}</span>}
      </div>
    </div>
  );
}
