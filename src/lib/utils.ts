import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { EstadoDato } from "../types/fondo";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function diffDiasDesde(fecha_valor: string | null): number | null {
  if (!fecha_valor) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fecha_valor + "T00:00:00");
  return Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

export function calcularEstadoDato(fecha_valor: string | null): EstadoDato {
  const diff = diffDiasDesde(fecha_valor);
  if (diff === null) return "Sin dato reciente";
  // CAFCI publica T-1; fines de semana y feriados largos pueden acumular hasta 4 días.
  if (diff <= 4) return "Actualizado";
  if (diff <= 14) return "Desactualizado";
  return "Sin dato reciente";
}

/** Siempre retorna el lag exacto en días: "Hoy", "Hace 1 día", "Hace X días", "Sin dato". */
export function etiquetaFrescura(fecha_valor: string | null): string {
  const diff = diffDiasDesde(fecha_valor);
  if (diff === null) return "Sin dato";
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Hace 1 día";
  return `Hace ${diff} días`;
}

export function formatearMoneda(valor: number | null, moneda: string): string {
  if (valor === null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : moneda === "EUR" ? "EUR" : "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(valor);
}

export function formatearFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha + "T00:00:00");
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function estadoDatoBadgeClass(estado: EstadoDato): string {
  switch (estado) {
    case "Actualizado":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Desactualizado":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Sin dato reciente":
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function estadoFondoBadgeClass(estado: string): string {
  switch (estado) {
    case "Activo":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Suspendido":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Liquidado":
      return "bg-red-50 text-red-600 border-red-200";
    case "En formación":
      return "bg-blue-50 text-blue-600 border-blue-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function formatearRendimiento(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const sign = valor >= 0 ? "+" : "";
  return `${sign}${valor.toFixed(2).replace(".", ",")}%`;
}

export function rendimientoColorClass(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "text-muted-foreground";
  return valor >= 0 ? "text-emerald-600" : "text-red-600";
}

export function formatearAUM(aum: number | null | undefined, moneda: string): string {
  if (aum === null || aum === undefined) return "—";
  const symbol = moneda === "USD" ? "US$" : moneda === "EUR" ? "€" : "$";
  return `${symbol} ${aum.toLocaleString("es-AR")} M`;
}

export function monedaBadgeClass(moneda: string): string {
  switch (moneda) {
    case "ARS":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "USD":
      return "bg-green-50 text-green-700 border-green-200";
    case "EUR":
      return "bg-violet-50 text-violet-700 border-violet-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}
