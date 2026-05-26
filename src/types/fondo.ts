export type EstadoFondo = "Activo" | "Suspendido" | "Liquidado" | "En formación";
export type MonedaFondo = "ARS" | "USD" | "EUR";
export type TipoFondo =
  | "Renta Fija"
  | "Renta Variable"
  | "Renta Mixta"
  | "Money Market"
  | "Infraestructura"
  | "Cerrado"
  | "Hedging";

export type FuenteDato = "CAFCI" | "CNV" | "Manual" | "No disponible";

/**
 * Tracking por campo de qué fuente provee cada dato.
 * Permite saber con precisión si el cuotaparte viene de CAFCI
 * pero la composición todavía no está disponible, etc.
 */
export type OrigenDato =
  | "CNV"         // Comisión Nacional de Valores
  | "CAFCI"       // Cámara Argentina de FCI
  | "snapshot"    // Snapshot propio (historial/)
  | "manual"      // Ingresado manualmente
  | "no_disponible"; // Sin dato

export interface FuentesDatoCampo {
  cuotaparte: OrigenDato;
  composicion: OrigenDato;
  patrimonio: OrigenDato;
  rendimientos: OrigenDato;
}

export type EstadoDato = "Actualizado" | "Desactualizado" | "Sin dato reciente";

export interface ComposicionItem {
  instrumento: string;
  porcentaje: number;
}

export interface HistorialCuotaparte {
  fecha: string; // ISO date string
  valor: number;
}

export interface Rendimientos {
  diario: number | null;
  semanal: number | null;
  mensual: number | null;
  trimestral: number | null;
  anual: number | null;
  ytd: number | null;
}

export interface Fondo {
  id: string;
  nombre: string;
  sociedad_gerente: string;
  sociedad_depositaria: string;
  tipo_fondo: TipoFondo;
  moneda: MonedaFondo;
  objeto_inversion: string;
  estado: EstadoFondo;
  valor_cuotaparte: number | null;
  fecha_valor: string | null; // ISO date string
  fuente_dato: FuenteDato;
  link_cnv: string | null;
  link_reglamento: string | null;
  link_composicion: string | null;
  composicion_mock: ComposicionItem[];
  /** "real" si la composición viene de CAFCI estadisticas, "estimada" si es referencia por tipo */
  composicion_fuente?: "real" | "estimada";
  /** Fecha de la composición real (YYYY-MM-DD), null si es estimada */
  composicion_fecha?: string | null;
  historial_cuotapartes?: HistorialCuotaparte[];
  rendimientos?: Rendimientos;
  aum_millones?: number | null;
  rescate_plazo?: string | null;
  comision_administracion?: number | null;
  horizonte_inversion?: string | null;
  inversion_minima?: number | null;
  /** Origen de cada dato. Permite detectar qué viene de CNV, CAFCI o snapshots propios. */
  fuente?: FuentesDatoCampo;
}

export interface FondosMeta {
  ultima_actualizacion: string; // ISO date string
  fuente: string;
  total_registros: number;
}

export interface FondosData {
  meta: FondosMeta;
  fondos: Fondo[];
}

export interface FiltrosFondos {
  busqueda: string;
  tipo_fondo: string;
  moneda: string;
  sociedad_gerente: string;
  estado: string;
  fuente_dato: string;
}

export type OrdenamientoCampo = "nombre" | "tna";
export type OrdenamientoDireccion = "asc" | "desc";

export interface Ordenamiento {
  campo: OrdenamientoCampo;
  direccion: OrdenamientoDireccion;
}
