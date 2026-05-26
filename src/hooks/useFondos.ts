import { useState, useMemo } from "react";
import type { Fondo, FiltrosFondos, Ordenamiento } from "../types/fondo";

const FILTROS_INICIALES: FiltrosFondos = {
  busqueda: "",
  tipo_fondo: "",
  moneda: "",
  sociedad_gerente: "",
  estado: "",
  fuente_dato: "",
};

const ORDENAMIENTO_INICIAL: Ordenamiento = {
  campo: "nombre",
  direccion: "asc",
};

export function useFondos(fondos: Fondo[]) {
  const [filtros, setFiltros] = useState<FiltrosFondos>(FILTROS_INICIALES);
  const [fondoSeleccionado, setFondoSeleccionado] = useState<Fondo | null>(null);
  const [ordenamiento, setOrdenamiento] = useState<Ordenamiento>(ORDENAMIENTO_INICIAL);
  const [fondosComparar, setFondosComparar] = useState<Fondo[]>([]);

  const fondosFiltrados = useMemo(() => {
    const busqueda = filtros.busqueda.toLowerCase().trim();
    const filtrados = fondos.filter((f) => {
      if (busqueda) {
        const match =
          f.nombre.toLowerCase().includes(busqueda) ||
          f.sociedad_gerente.toLowerCase().includes(busqueda) ||
          f.sociedad_depositaria.toLowerCase().includes(busqueda);
        if (!match) return false;
      }
      if (filtros.tipo_fondo && f.tipo_fondo !== filtros.tipo_fondo) return false;
      if (filtros.moneda && f.moneda !== filtros.moneda) return false;
      if (filtros.sociedad_gerente && f.sociedad_gerente !== filtros.sociedad_gerente) return false;
      if (filtros.estado && f.estado !== filtros.estado) return false;
      if (filtros.fuente_dato && f.fuente_dato !== filtros.fuente_dato) return false;
      return true;
    });

    return [...filtrados].sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

      if (ordenamiento.campo === "nombre") {
        valA = a.nombre.toLowerCase();
        valB = b.nombre.toLowerCase();
      } else {
        const tnaA = a.rendimientos?.diario != null ? a.rendimientos.diario * 365 : null;
        const tnaB = b.rendimientos?.diario != null ? b.rendimientos.diario * 365 : null;
        valA = tnaA ?? -Infinity;
        valB = tnaB ?? -Infinity;
      }

      if (valA < valB) return ordenamiento.direccion === "asc" ? -1 : 1;
      if (valA > valB) return ordenamiento.direccion === "asc" ? 1 : -1;
      return 0;
    });
  }, [fondos, filtros, ordenamiento]);

  const opcionesFiltros = useMemo(() => ({
    tipos_fondo: [...new Set(fondos.map((f) => f.tipo_fondo))].sort(),
    monedas: [...new Set(fondos.map((f) => f.moneda))].sort(),
    sociedades_gerentes: [...new Set(fondos.map((f) => f.sociedad_gerente))].sort(),
    estados: [...new Set(fondos.map((f) => f.estado))].sort(),
    fuentes: [...new Set(fondos.map((f) => f.fuente_dato))].sort(),
  }), [fondos]);

  const resetFiltros = () => setFiltros(FILTROS_INICIALES);

  const filtrosActivos = Object.values(filtros).filter(Boolean).length;

  const toggleOrdenamiento = (campo: Ordenamiento["campo"]) => {
    setOrdenamiento((prev) =>
      prev.campo === campo
        ? { campo, direccion: prev.direccion === "asc" ? "desc" : "asc" }
        : { campo, direccion: "desc" }
    );
  };

  const toggleComparar = (fondo: Fondo) => {
    setFondosComparar((prev) => {
      const existe = prev.some((f) => f.id === fondo.id);
      if (existe) return prev.filter((f) => f.id !== fondo.id);
      if (prev.length >= 3) return prev;
      return [...prev, fondo];
    });
  };

  const limpiarComparacion = () => setFondosComparar([]);

  return {
    filtros,
    setFiltros,
    fondosFiltrados,
    opcionesFiltros,
    fondoSeleccionado,
    setFondoSeleccionado,
    resetFiltros,
    filtrosActivos,
    ordenamiento,
    toggleOrdenamiento,
    fondosComparar,
    toggleComparar,
    limpiarComparacion,
  };
}
