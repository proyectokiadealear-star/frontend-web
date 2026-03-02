"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Search } from "lucide-react";

interface FilterOption {
  label: string;
  value: string;
}

interface Filter {
  label: string;
  key: string;
  options: FilterOption[];
  value?: string;
  onChange: (value: string) => void;
}

interface SearchFilterBarProps {
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: Filter[];
}

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filters = [],
}: SearchFilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      {onSearchChange && (
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Input
            placeholder={searchPlaceholder}
            value={searchValue || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            leftIcon={<Search size={14} />}
          />
        </div>
      )}
      {filters.map((f) => (
        <div key={f.key} className="min-w-[150px]">
          <Select
            options={f.options}
            placeholder={f.label}
            value={f.value || ""}
            onChange={(e) => f.onChange(e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
