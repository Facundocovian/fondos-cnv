import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { Fondo, Ordenamiento } from "../types/fondo";
import { Badge } from "./ui/badge";
import {
  calcularEstadoDato,
  estadoDatoBadgeClass,
  estadoFondoBadgeClass,
  monedaBadgeClass,
  formatearMoneda,
  formatearFecha,
  formatearRendimiento,
  rendimientoColorClass,
  cn,
} from "../lib/utils";

interface FondosTableProps {
  fondos: Fondo[];
  fondoSeleccionado: Fondo | null;
  onSeleccionar: (fondo: Fondo) => void;
  ordenamiento: Ordenamiento;
  onToggleOrdenamiento: (campo: Ordenamiento["campo"]) => void;
  fondosComparar: Fondo[];
  onToggleComparar: (fondo: Fondo) => void;
}

function SortIcon({ campo, ordenamiento }: { campo: Ordenamiento["campo"]; ordenamiento: Ordenamiento }) {
  if (ordenamiento.campo !== campo) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return ordenamiento.direccion === "asc"
    ? <ArrowUp className="h-3 w-3 text-primary" />
    : <ArrowDown className="h-3 w-3 text-primary" />;
}

export function FondosTable({
  fondos,
  fondoSeleccionado,
  onSeleccionar,
  ordenamiento,
  onToggleOrdenamiento,
  fondosComparar,
  onToggleComparar,
}: FondosTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: fondos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 57,
    overscan: 5,
  });

  if (fondos.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">No se encontraron fondos con los filtros seleccionados.</p>
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div ref={parentRef} className="overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/40">
              <th className="w-10 px-3 py-3" />

              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <button
                  onClick={() => onToggleOrdenamiento("nombre")}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Fondo <SortIcon campo="nombre" ordenamiento={ordenamiento} />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                Moneda
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                Cuotaparte
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                <button
                  onClick={() => onToggleOrdenamiento("tna")}
                  className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                >
                  TNA <SortIcon campo="tna" ordenamiento={ordenamiento} />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                Fecha valor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                Dato
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr><td colSpan={10} style={{ height: paddingTop }} /></tr>
            )}
            {virtualItems.map((virtualRow) => {
              const fondo = fondos[virtualRow.index];
              const estadoDato = calcularEstadoDato(fondo.fecha_valor);
              const isSelected = fondoSeleccionado?.id === fondo.id;
              const isComparando = fondosComparar.some((f) => f.id === fondo.id);
              const tna = fondo.rendimientos?.diario != null
                ? +(fondo.rendimientos.diario * 365).toFixed(2)
                : null;

              return (
                <tr
                  key={fondo.id}
                  onClick={() => onSeleccionar(fondo)}
                  className={cn(
                    "cursor-pointer hover:bg-accent/50 group border-b border-border",
                    isSelected && "bg-primary/10 hover:bg-primary/15"
                  )}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isComparando}
                      onChange={() => onToggleComparar(fondo)}
                      disabled={!isComparando && fondosComparar.length >= 3}
                      className={cn(
                        "h-4 w-4 rounded border border-border bg-background accent-primary cursor-pointer transition-opacity",
                        !isComparando && "opacity-0 group-hover:opacity-100",
                        isComparando && "opacity-100",
                        !isComparando && fondosComparar.length >= 3 && "cursor-not-allowed"
                      )}
                    />
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground leading-tight max-w-xs truncate">
                      {fondo.nombre}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-xs">
                      {fondo.sociedad_gerente}
                    </div>
                  </td>

                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">{fondo.tipo_fondo}</span>
                  </td>

                  <td className="px-4 py-3 hidden lg:table-cell">
                    <Badge className={monedaBadgeClass(fondo.moneda)}>{fondo.moneda}</Badge>
                  </td>

                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className="font-mono text-xs text-foreground">
                      {formatearMoneda(fondo.valor_cuotaparte, fondo.moneda)}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className={cn("font-mono text-xs font-medium", rendimientoColorClass(tna))}>
                      {formatearRendimiento(tna)}
                    </span>
                  </td>

                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className="text-xs text-muted-foreground">{formatearFecha(fondo.fecha_valor)}</span>
                  </td>

                  <td className="px-4 py-3">
                    <Badge className={estadoFondoBadgeClass(fondo.estado)}>{fondo.estado}</Badge>
                  </td>

                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge className={estadoDatoBadgeClass(estadoDato)}>{estadoDato}</Badge>
                  </td>

                  <td className="px-2 py-3">
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-colors",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )} />
                  </td>
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr><td colSpan={10} style={{ height: paddingBottom }} /></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-4 py-2.5 bg-muted/20">
        <span className="text-xs text-muted-foreground">
          {fondos.length} fondo{fondos.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
