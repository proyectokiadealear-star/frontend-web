import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Handles ISO strings and Firestore Timestamp objects { _seconds, _nanoseconds }
function toDate(value?: string | null | Record<string, number>): Date | null {
  if (!value) return null;
  if (typeof value === "object" && "_seconds" in value) {
    return new Date(value._seconds * 1000);
  }
  if (typeof value === "string") {
    // Date-only strings (YYYY-MM-DD) must be parsed as local midnight.
    // new Date("2026-03-06") is UTC midnight → shows 2026-03-05 in UTC-5.
    // Appending T00:00:00 makes JavaScript treat it as local time.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value + "T00:00:00");
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDate(dateStr?: string | null | Record<string, number>): string {
  const d = toDate(dateStr as string);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return String(dateStr);
  }
}

export function formatDateTime(dateStr?: string | null | Record<string, number>): string {
  const d = toDate(dateStr as string);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(dateStr);
  }
}

export function getUserInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function truncate(str: string, max = 30): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

/** Devuelve la fecha local como YYYY-MM-DD sin conversión a UTC */
export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Convierte un Date a YYYY-MM-DD usando timezone local */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
