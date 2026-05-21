/**
 * src/services/types.ts
 *
 * Tipos "crudos" (raw) que modelan exactamente lo que devuelve cada fuente
 * antes de ser normalizado al tipo interno `Fondo`.
 *
 * Regla: estos tipos NUNCA se usan en componentes UI.
 * Los componentes sólo consumen el tipo `Fondo` ya normalizado.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CNV — Comisión Nacional de Valores
// Fuente de datos estructurales: nombre, gerente, depositaria, estado, objeto.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Representa un fondo tal como aparece en el listado oficial de la CNV.
 * Campos derivados de la sección "Fondos Comunes de Inversión" del portal CNV.
 */
export interface FondoCNVRaw {
  /** Número de registro en CNV. Usarlo como ID canónico. */
  nro_registro: string;
  nombre: string;
  sociedad_gerente: string;
  sociedad_depositaria: string;
  /** Tipo de fondo según categorización CNV (puede diferir de TipoFondo interno). */
  tipo_cnv: string;
  estado: string;
  objeto_inversion: string;
  /** URL de ficha en el portal CNV. Construida como: https://www.cnv.gov.ar/... */
  url_cnv: string | null;
  /** URL del reglamento de gestión en CNV. */
  url_reglamento: string | null;
  /** Fecha de la última actualización de datos en CNV. */
  fecha_actualizacion_cnv: string | null;
}

/**
 * Composición de cartera publicada por CNV (cuando disponible).
 * CNV publica composición mensual con cierto rezago.
 */
export interface ComposicionCNVRaw {
  nro_registro: string;
  fecha_composicion: string;
  activos: Array<{
    instrumento: string;
    tipo_activo: string;
    porcentaje: number;
    valor_nominal: number | null;
    moneda_activo: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAFCI — Cámara Argentina de Fondos Comunes de Inversión
// Fuente de datos operativos/financieros: cuotaparte, AUM, rescate, rendimientos.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valor de cuotaparte publicado por CAFCI.
 * CAFCI publica datos diariamente (días hábiles).
 */
export interface CuotaparteCafciRaw {
  /** ID interno de CAFCI (distinto del nro_registro CNV — requiere mapeo). */
  cafci_id: string;
  nombre_cafci: string;
  valor_cuotaparte: number;
  fecha: string; // "YYYY-MM-DD"
  moneda: string; // "ARS" | "USD" | "EUR"
  patrimonio_neto: number | null; // en la moneda del fondo
  cantidad_cuotapartes: number | null;
}

/**
 * Datos operativos del fondo en CAFCI (rescate, inversión mínima, comisión).
 * No siempre disponibles para todos los fondos.
 */
export interface DatosOperativosCafciRaw {
  cafci_id: string;
  plazo_rescate: string | null;        // "T+0", "T+1", "T+2", "T+72hs"
  inversion_minima: number | null;
  moneda_inversion: string | null;
  comision_gestion: number | null;     // % anual
  comision_performance: number | null; // % sobre rendimiento, si aplica
  horizonte_recomendado: string | null;
}

/**
 * Rendimientos publicados directamente por CAFCI.
 * CAFCI calcula TNA, rendimiento mensual, trimestral, etc.
 */
export interface RendimientosCafciRaw {
  cafci_id: string;
  fecha_calculo: string;
  tna: number | null;                  // Tasa nominal anual
  rendimiento_1d: number | null;       // % variación 1 día
  rendimiento_7d: number | null;       // % variación 7 días
  rendimiento_30d: number | null;      // % variación 30 días
  rendimiento_90d: number | null;      // % variación 90 días
  rendimiento_365d: number | null;     // % variación 365 días
  rendimiento_ytd: number | null;      // % variación YTD
}

/**
 * Composición de cartera según CAFCI.
 * CAFCI publica composición con frecuencia mensual o trimestral.
 */
export interface ComposicionCafciRaw {
  cafci_id: string;
  fecha_composicion: string;
  activos: Array<{
    instrumento: string;
    porcentaje: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshots propios — historial/YYYY-MM-DD.json
// Datos que guardamos nosotros corriendo un script diario.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formato de cada archivo historial/YYYY-MM-DD.json.
 *
 * Generado por un script de ingestión que corre diariamente,
 * consulta CAFCI/CNV y persiste los valores del día.
 *
 * Ubicación: public/historial/YYYY-MM-DD.json
 * Acceso en runtime: fetch('/historial/YYYY-MM-DD.json')
 */
export interface SnapshotDiario {
  /** Fecha del snapshot. Formato ISO "YYYY-MM-DD". */
  fecha: string;
  /** Fecha y hora de generación del snapshot (UTC). */
  generado_en: string;
  /** Fuente usada para la ingestión. */
  fuente_ingestión: "CAFCI" | "CNV" | "manual";
  fondos: SnapshotFondo[];
}

export interface SnapshotFondo {
  /** ID canónico = nro_registro CNV. */
  id: string;
  valor_cuotaparte: number | null;
  moneda: string;
  patrimonio_neto: number | null;
}

/**
 * Índice de snapshots disponibles.
 * Ubicación: public/historial/index.json
 * Permite al frontend saber qué fechas tiene disponibles sin listar el directorio.
 */
export interface HistorialIndex {
  /** Última fecha de snapshot disponible. */
  ultima_fecha: string | null;
  /** Lista de fechas disponibles en orden cronológico ascendente. */
  fechas: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de IDs entre fuentes
// CNV usa nro_registro, CAFCI usa su propio ID interno.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tabla de mapeo entre el ID interno del proyecto (nro_registro CNV)
 * y el ID en CAFCI. Necesario para cruzar datos de ambas fuentes.
 *
 * TODO: Construir este mapeo una vez que se tenga acceso a ambas APIs.
 */
export interface MapeoIdsFuentes {
  id_interno: string;     // nro_registro CNV
  nro_registro_cnv: string;
  cafci_id: string | null;
}
