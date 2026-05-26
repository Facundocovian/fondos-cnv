import { Search, X, SlidersHorizontal } from "lucide-react";
import type { FiltrosFondos } from "../types/fondo";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { SearchableSelect } from "./ui/searchable-select";
import { Button } from "./ui/button";

interface SearchAndFiltersProps {
  filtros: FiltrosFondos;
  setFiltros: React.Dispatch<React.SetStateAction<FiltrosFondos>>;
  opciones: {
    tipos_fondo: string[];
    monedas: string[];
    sociedades_gerentes: string[];
    estados: string[];
    fuentes: string[];
  };
  filtrosActivos: number;
  resetFiltros: () => void;
  totalResultados: number;
}

export function SearchAndFilters({
  filtros,
  setFiltros,
  opciones,
  filtrosActivos,
  resetFiltros,
  totalResultados,
}: SearchAndFiltersProps) {
  const set = (key: keyof FiltrosFondos) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setFiltros((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filtros</span>
          {filtrosActivos > 0 && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary font-medium">
              {filtrosActivos} activos
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {totalResultados} resultado{totalResultados !== 1 ? "s" : ""}
          </span>
          {filtrosActivos > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFiltros} className="h-7 px-2 text-xs gap-1">
              <X className="h-3 w-3" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre, sociedad gerente o depositaria..."
          value={filtros.busqueda}
          onChange={set("busqueda")}
        />
        {filtros.busqueda && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setFiltros((p) => ({ ...p, busqueda: "" }))}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Select
          label="Tipo de fondo"
          value={filtros.tipo_fondo}
          onChange={set("tipo_fondo")}
        >
          <option value="">Todos</option>
          {opciones.tipos_fondo.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>

        <Select
          label="Moneda"
          value={filtros.moneda}
          onChange={set("moneda")}
        >
          <option value="">Todas</option>
          {opciones.monedas.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>

        <SearchableSelect
          label="Sociedad gerente"
          value={filtros.sociedad_gerente}
          onChange={(v) => setFiltros((p) => ({ ...p, sociedad_gerente: v }))}
          options={opciones.sociedades_gerentes}
          placeholder="Buscar sociedad..."
          allLabel="Todas"
        />

        <Select
          label="Estado"
          value={filtros.estado}
          onChange={set("estado")}
        >
          <option value="">Todos</option>
          {opciones.estados.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </Select>

        <Select
          label="Fuente del dato"
          value={filtros.fuente_dato}
          onChange={set("fuente_dato")}
        >
          <option value="">Todas</option>
          {opciones.fuentes.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}
