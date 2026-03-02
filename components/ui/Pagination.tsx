import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>
        Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className={cn(
            "p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = i + Math.max(1, Math.min(page - 2, totalPages - 4));
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={cn(
                "w-7 h-7 rounded-md text-xs border transition-colors",
                p === page
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-200 hover:bg-gray-50"
              )}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className={cn(
            "p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
