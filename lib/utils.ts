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
