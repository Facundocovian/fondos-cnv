/**
 * src/services/cafciPlanillaService.ts
 *
 * Acceso a los datos estructurales de la Planilla Diaria de CAFCI.
 *
 * Fuente: https://api.pub.cafci.org.ar/pb_get
 * Generado por: scripts/ingest-cafci.py
 * Actualizar: `python3 scripts/ingest-cafci.py`
 *
 * Provee:
 *   - sociedad_gerente, sociedad_depositaria
 *   - codigo_cnv, codigo_cafci
 *   - tipo_fondo, moneda, horizonte
 *   - comision_ingreso, honorarios_adm_sg, comision_rescate
 *   - plazo_liquidacion, minimo_inversion
 *   - composicionEstimada: allocación típica por tipo de fondo
 *
 * Nota sobre composición real:
 *   La composición de cartera por fondo está en la API privada de CAFCI
 *   (/fondo/{id}/clase/{id}/ficha) y en los Excel mensuales de CNV.
 *   Ambas fuentes están bloqueadas o inaccesibles desde el browser.
 *   Se usa composición estimada por tipo como referencia orientativa.
 */

import planillaRaw from "../data/cafci-planilla.json";
import composicionesRaw from "../data/composiciones-reales.json";
import type { ComposicionItem } from "../types/fondo";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PlanillaFondo {
  nombre: string;
  tipo_fondo: string | null;
  moneda: string;
  sociedad_gerente: string;
  sociedad_depositaria: string;
  codigo_cnv: string | null;
  codigo_cafci: string | null;
  calificacion: string | null;
  horizonte: string | null;
  vcp_planilla: number | null;
  comision_ingreso: number | null;
  honorarios_adm_sg: number | null;
  honorarios_adm_sd: number | null;
  comision_rescate: number | null;
  plazo_liquidacion: string | null;
  minimo_inversion: number | null;
}

interface PlanillaJson {
  fecha: string;
  total: number;
  fondos: Record<string, PlanillaFondo>;
}

// ─── Datos ────────────────────────────────────────────────────────────────────

const planilla = planillaRaw as PlanillaJson;

/** Fecha de la planilla descargada (YYYY-MM-DD). */
export const fechaPlanilla: string = planilla.fecha;

/** Mapa nombre_fondo → PlanillaFondo para lookups O(1). */
const lookupMap: Map<string, PlanillaFondo> = new Map(
  Object.entries(planilla.fondos)
);

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Busca un fondo en la planilla por nombre exacto.
 * Los nombres en ArgentinaDatos y en la planilla CAFCI son idénticos
 * (ambos provienen de CAFCI).
 */
export function getPlanillaFondo(nombre: string): PlanillaFondo | null {
  return lookupMap.get(nombre) ?? null;
}

/**
 * Convierte el código de plazo de liquidación al formato legible.
 *
 * Valores conocidos:
 *   -1    → inmediato (Money Market con liquidez T+0)
 *    0    → mismo día hábil
 *    1    → 24hs hábiles (T+1)
 *    2    → 48hs hábiles (T+2)
 *    3    → 72hs hábiles (T+3)
 *    5    → 5 días hábiles
 *   10    → 10 días hábiles
 *  999+   → rescate en especie / fondo cerrado
 */
export function formatearPlazo(plazo: string | null): string | null {
  if (plazo === null) return null;
  switch (plazo) {
    case "-1": return "Inmediato";
    case "0":  return "T+0";
    case "1":  return "24hs";
    case "2":  return "48hs";
    case "3":  return "72hs";
    case "5":  return "5 días";
    case "10": return "10 días";
    default:
      if (parseInt(plazo) >= 999) return "Rescate en especie";
      return `${plazo} días`;
  }
}

// ─── Composiciones reales (fetch-composiciones.mjs) ──────────────────────────

interface ComposicionRealItem {
  nombre: string;
  porcentaje: number;
}

interface ComposicionReal {
  nombre: string;
  fondoId: number;
  claseId: number;
  fecha: string | null;
  items: ComposicionRealItem[];
}

interface ComposicionesJson {
  generado_en: string | null;
  total_con_datos: number;
  composiciones: Record<string, ComposicionReal>;
}

const composicionesData = composicionesRaw as unknown as ComposicionesJson;
const composicionesMap = composicionesData.composiciones;

export interface ComposicionResult {
  items: ComposicionItem[];
  fuente: "real" | "estimada";
  fecha: string | null;
}

/**
 * Devuelve la composición real de un fondo si está disponible en
 * composiciones-reales.json (generado por scripts/fetch-composiciones.mjs).
 * Si no, devuelve la composición estimada por tipo de fondo.
 */
export function getComposicion(
  slug: string,
  tipoFondo: string | null,
  moneda: string
): ComposicionResult {
  const real = composicionesMap[slug];
  if (real && real.items.length > 0) {
    return {
      items: real.items.map((i) => ({ instrumento: i.nombre, porcentaje: i.porcentaje })),
      fuente: "real",
      fecha: real.fecha,
    };
  }
  return {
    items: getComposicionEstimada(tipoFondo, moneda),
    fuente: "estimada",
    fecha: null,
  };
}

// ─── Composición estimada por tipo ───────────────────────────────────────────
//
// Fuente real de composición: API privada CAFCI (/fondo/{id}/clase/{id}/ficha)
// y Excel mensual CNV — ambos inaccesibles desde el browser.
//
// Estas allocaciones son tipicas del mercado argentino al 2025-2026
// y sirven como referencia orientativa. No representan el portfolio
// específico de cada fondo.

type TipoFondoKey =
  | "Money Market ARS"
  | "Money Market USD"
  | "Renta Fija ARS"
  | "Renta Fija USD"
  | "Renta Variable ARS"
  | "Renta Variable USD"
  | "Renta Mixta ARS"
  | "Renta Mixta USD"
  | "default";

const COMPOSICION_ESTIMADA: Record<TipoFondoKey, ComposicionItem[]> = {
  "Money Market ARS": [
    { instrumento: "Cuentas corrientes / vista", porcentaje: 35 },
    { instrumento: "Cauciones bursátiles", porcentaje: 30 },
    { instrumento: "Plazos fijos bancarios", porcentaje: 20 },
    { instrumento: "Letras / bonos cortos (T+1)", porcentaje: 15 },
  ],
  "Money Market USD": [
    { instrumento: "Cuentas en dólares (vista)", porcentaje: 40 },
    { instrumento: "Cauciones en dólares", porcentaje: 30 },
    { instrumento: "Letras del Tesoro USD", porcentaje: 20 },
    { instrumento: "Cash / otros", porcentaje: 10 },
  ],
  "Renta Fija ARS": [
    { instrumento: "Bonos soberanos CER / DLK", porcentaje: 30 },
    { instrumento: "LECAPs / BONCAP (tasa fija)", porcentaje: 25 },
    { instrumento: "ON corporativas ARS", porcentaje: 25 },
    { instrumento: "Cauciones / cash", porcentaje: 20 },
  ],
  "Renta Fija USD": [
    { instrumento: "Bonos soberanos USD (hard dollar)", porcentaje: 45 },
    { instrumento: "ON corporativas USD", porcentaje: 35 },
    { instrumento: "Obligaciones negociables", porcentaje: 15 },
    { instrumento: "Cash USD", porcentaje: 5 },
  ],
  "Renta Variable ARS": [
    { instrumento: "Acciones argentinas (BYMA)", porcentaje: 55 },
    { instrumento: "CEDEARs / ADRs", porcentaje: 25 },
    { instrumento: "Bonos / Cauciones", porcentaje: 15 },
    { instrumento: "Cash", porcentaje: 5 },
  ],
  "Renta Variable USD": [
    { instrumento: "CEDEARs / ADRs", porcentaje: 50 },
    { instrumento: "Acciones argentinas (BYMA)", porcentaje: 30 },
    { instrumento: "Cauciones en dólares", porcentaje: 15 },
    { instrumento: "Cash USD", porcentaje: 5 },
  ],
  "Renta Mixta ARS": [
    { instrumento: "Bonos soberanos / ON", porcentaje: 40 },
    { instrumento: "Acciones argentinas", porcentaje: 25 },
    { instrumento: "CEDEARs", porcentaje: 20 },
    { instrumento: "Cauciones / cash", porcentaje: 15 },
  ],
  "Renta Mixta USD": [
    { instrumento: "Bonos soberanos USD", porcentaje: 35 },
    { instrumento: "ON corporativas USD", porcentaje: 30 },
    { instrumento: "CEDEARs / ADRs", porcentaje: 25 },
    { instrumento: "Cash USD", porcentaje: 10 },
  ],
  default: [
    { instrumento: "Renta fija / bonos", porcentaje: 50 },
    { instrumento: "Instrumentos de corto plazo", porcentaje: 30 },
    { instrumento: "Cash / disponible", porcentaje: 20 },
  ],
};

/**
 * Devuelve la composición estimada para un tipo de fondo y moneda dados.
 * Basada en allocaciones típicas del mercado argentino (2025-2026).
 * Etiquetada como orientativa, no refleja el portfolio específico del fondo.
 */
export function getComposicionEstimada(
  tipoFondo: string | null,
  moneda: string
): ComposicionItem[] {
  if (!tipoFondo) return COMPOSICION_ESTIMADA["default"];
  const isUSD = moneda === "USD";
  const key = `${tipoFondo} ${isUSD ? "USD" : "ARS"}` as TipoFondoKey;
  return COMPOSICION_ESTIMADA[key] ?? COMPOSICION_ESTIMADA["default"];
}
