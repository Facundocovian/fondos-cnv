import { useState, useEffect } from "react";
import { BarChart3, GitCompare, X, Loader2 } from "lucide-react";
import { cargarFondos } from "./services/fondosRepository";
import type { ResultadoCargaFondos } from "./services/fondosRepository";
import type { FondosMeta } from "./types/fondo";
import { useFondos } from "./hooks/useFondos";
import { MetricCards } from "./components/MetricCards";
import { SearchAndFilters } from "./components/SearchAndFilters";
import { FondosTable } from "./components/FondosTable";
import { FondoDetailPage } from "./components/FondoDetailPage";
import { ComparacionModal } from "./components/ComparacionModal";

// ─── Estado de carga ──────────────────────────────────────────────────────────
// Discriminated union: garantiza que "listo" siempre tiene resultado,
// y "error" siempre tiene mensaje. Sin `null` sueltos.

type EstadoCarga =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "listo"; resultado: ResultadoCargaFondos };

// Meta vacía para el estado inicial (antes de que carguen los datos)
const META_VACIA: FondosMeta = {
  ultima_actualizacion: "—",
  fuente: "—",
  total_registros: 0,
};

// ─── Componentes de estado ────────────────────────────────────────────────────

function PantallaCargando() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Cargando fondos...</p>
    </div>
  );
}

function PantallaError({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-4 text-center max-w-md">
        <p className="text-sm font-medium text-red-600 mb-1">
          No se pudieron cargar los fondos
        </p>
        <p className="text-xs text-muted-foreground">{mensaje}</p>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [estado, setEstado] = useState<EstadoCarga>({ fase: "cargando" });
  const [modalComparacionAbierto, setModalComparacionAbierto] = useState(false);

  useEffect(() => {
    cargarFondos()
      .then((resultado) => setEstado({ fase: "listo", resultado }))
      .catch((e: unknown) =>
        setEstado({
          fase: "error",
          mensaje: e instanceof Error ? e.message : "Error desconocido",
        })
      );
  }, []);

  // useFondos se llama siempre (regla de hooks: nunca condicional).
  // Recibe array vacío mientras carga; la UI de carga se muestra antes de la tabla.
  const fondos = estado.fase === "listo" ? estado.resultado.fondos : [];
  const fondosMeta = estado.fase === "listo" ? estado.resultado.fondosMeta : META_VACIA;

  const {
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
  } = useFondos(fondos);

  const handleLimpiarComparacion = () => {
    limpiarComparacion();
    setModalComparacionAbierto(false);
  };

  // Detalle de fondo seleccionado: reemplaza toda la página
  if (fondoSeleccionado) {
    return (
      <FondoDetailPage
        fondo={fondoSeleccionado}
        onVolver={() => setFondoSeleccionado(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav — siempre visible independientemente del estado de carga */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto max-w-screen-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/20">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">Fondos CNV</span>
              <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">
                Dashboard de Fondos Comunes de Inversión
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {estado.fase === "listo" && (
              <>
                <span className="hidden sm:inline">
                  Actualizado: {fondosMeta.ultima_actualizacion}
                </span>
                <span className="rounded border border-border px-2 py-0.5 bg-muted/40">
                  {fondosMeta.fuente}
                </span>
              </>
            )}
            {estado.fase === "cargando" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin opacity-50" />
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-screen-xl px-4 py-6 space-y-4">
        {estado.fase === "cargando" && <PantallaCargando />}
        {estado.fase === "error" && <PantallaError mensaje={estado.mensaje} />}
        {estado.fase === "listo" && (
          <>
            <MetricCards
              fondos={fondos}
              fondosFiltrados={fondosFiltrados}
              meta={fondosMeta}
            />

            <SearchAndFilters
              filtros={filtros}
              setFiltros={setFiltros}
              opciones={opcionesFiltros}
              filtrosActivos={filtrosActivos}
              resetFiltros={resetFiltros}
              totalResultados={fondosFiltrados.length}
            />

            <FondosTable
              fondos={fondosFiltrados}
              fondoSeleccionado={fondoSeleccionado}
              onSeleccionar={setFondoSeleccionado}
              ordenamiento={ordenamiento}
              onToggleOrdenamiento={toggleOrdenamiento}
              fondosComparar={fondosComparar}
              onToggleComparar={toggleComparar}
            />
          </>
        )}
      </main>

      {/* Floating compare button */}
      {fondosComparar.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
          <button
            onClick={handleLimpiarComparacion}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-lg"
            title="Limpiar selección"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={() => setModalComparacionAbierto(true)}
            disabled={fondosComparar.length < 2}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GitCompare className="h-4 w-4" />
            Comparar ({fondosComparar.length})
            {fondosComparar.length < 2 && (
              <span className="text-primary-foreground/70 text-xs ml-1">— seleccioná 2+</span>
            )}
          </button>
        </div>
      )}

      {/* Comparacion modal */}
      {modalComparacionAbierto && fondosComparar.length >= 2 && (
        <ComparacionModal
          fondos={fondosComparar}
          onClose={() => setModalComparacionAbierto(false)}
          onRemove={(fondo) => {
            toggleComparar(fondo);
            if (fondosComparar.length <= 2) setModalComparacionAbierto(false);
          }}
        />
      )}
    </div>
  );
}
