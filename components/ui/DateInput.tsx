"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatDisplay(value: string): string {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} de ${MONTHS_ES[m - 1]} de ${y}`;
}

interface DateInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  max?: string;
  min?: string;
}

export function DateInput({
  label,
  value,
  onChange,
  required,
  error,
  hint,
  max,
  min,
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTrigger = () => {
    inputRef.current?.showPicker?.();
    inputRef.current?.focus();
  };

  const display = formatDisplay(value);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <button
        type="button"
        onClick={handleTrigger}
        className={cn(
          "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors cursor-pointer",
          "focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-gray-900",
          error
            ? "border-red-400 bg-red-50"
            : value
            ? "border-gray-300 bg-white hover:border-gray-500"
            : "border-dashed border-gray-300 bg-gray-50 hover:border-gray-400"
        )}
      >
        {/* Calendar icon */}
        <span
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors",
            value ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-500"
          )}
        >
          <CalendarDays size={14} />
        </span>

        {/* Display */}
        <span className={cn("flex-1 text-sm", value ? "text-gray-900 font-medium" : "text-gray-400")}>
          {display || "Seleccionar fecha"}
        </span>

        {/* Clear button */}
        {value && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xs font-bold shrink-0"
            title="Limpiar"
          >
            ✕
          </span>
        )}

        {/* Hidden native input — sits invisibly but captures the picker */}
        <input
          ref={inputRef}
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          tabIndex={-1}
        />
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
