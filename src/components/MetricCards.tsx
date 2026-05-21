import { TrendingUp, DollarSign, Activity, Clock } from "lucide-react";
import type { Fondo, FondosMeta } from "../types/fondo";
import { formatearFecha } from "../lib/utils";

interface MetricCardsProps {
  fondos: Fondo[];
  fondosFiltrados: Fondo[];
  meta: FondosMeta;
}

export function MetricCards({ fondos, fondosFiltrados, meta }: MetricCardsProps) {
  const activos = fondos.filter((f) => f.estado === "Activo").length;

  const porMoneda = fondos.reduce<Record<string, number>>((acc, f) => {
    acc[f.moneda] = (acc[f.moneda] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Total fondos */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total Fondos
          </span>
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-2">
          <span className="text-3xl font-bold text-foreground">{fondosFiltrados.length}</span>
          {fondosFiltrados.length !== fondos.length && (
            <span className="ml-2 text-xs text-muted-foreground">de {fondos.length}</span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">fondos registrados</p>
      </div>

      {/* Por moneda */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Por Moneda
          </span>
          <DollarSign className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(porMoneda).map(([moneda, cant]) => (
            <div key={moneda} className="flex items-center gap-1">
              <span className="text-lg font-bold text-foreground">{cant}</span>
              <span className="text-xs text-muted-foreground">{moneda}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">distribución por moneda</p>
      </div>

      {/* Activos */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Fondos Activos
          </span>
          <Activity className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-3xl font-bold text-foreground">{activos}</span>
          <span className="mb-0.5 text-sm text-emerald-600">
            {Math.round((activos / fondos.length) * 100)}%
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">del total de fondos</p>
      </div>

      {/* Última actualización */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Última actualización
          </span>
          <Clock className="h-4 w-4 text-amber-600" />
        </div>
        <div className="mt-2">
          <span className="text-xl font-bold text-foreground">
            {formatearFecha(meta.ultima_actualizacion)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{meta.fuente}</p>
      </div>
    </div>
  );
}
