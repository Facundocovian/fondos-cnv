/**
 * src/services/cnvService.ts
 *
 * Servicio para datos estructurales de la CNV.
 * La CNV es la fuente canónica para: nombre, gerente, depositaria,
 * estado, objeto de inversión, reglamento y composición de cartera.
 *
 * ─── CÓMO CONECTAR LA FUENTE REAL ───────────────────────────────────────────
 *
 * La CNV no expone una API REST pública documentada.
 * Los datos están disponibles a través del portal web:
 *   https://www.cnv.gov.ar/SitioWeb/FondosComunes/FCI
 *
 * Opciones de ingestión:
 *
 * 1. SCRAPING DEL PORTAL CNV
 *    - El portal CNV publica listados en HTML con tablas paginadas.
 *    - Un script Node.js con `cheerio` o `playwright` puede extraer:
 *      nombre, nro_registro, gerente, depositaria, estado.
 *    - Frecuencia sugerida: 1 vez por día (los cambios de estado son lentos).
 *    - TODO: Implementar en scripts/ingest-cnv.ts
 *
 * 2. ARCHIVO EXCEL DEL ENTE REGULADOR
 *    - CNV periódicamente publica listados en XLSX descargables.
 *    - TODO: Verificar disponibilidad y URL de descarga actual.
 *
 * 3. SISTEMA INTEGRADO DE INFORMACIÓN (SEDI) - CNV
 *    - Algunos datos pueden estar en el sistema SEDI de la CNV.
 *    - TODO: Consultar disponibilidad de acceso institucional.
 *
 * 4. COMPOSICIÓN DE CARTERA
 *    - CNV publica composición en:
 *      https://www.cnv.gov.ar/SitioWeb/FondosComunes/ComposicionCartera
 *    - Frecuencia: mensual con rezago de ~30 días.
 *    - TODO: Scraping mensual post-publicación.
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { FondoCNVRaw, ComposicionCNVRaw } from "./types";
import type { Fondo, TipoFondo, EstadoFondo } from "../types/fondo";

// ─── Implementación actual: datos estáticos (seed) ───────────────────────────
// Los datos estáticos en fondos.json son el fallback mientras no haya ingestión real.
// Cuando se implemente el scraping, estas funciones llamarán al backend/script
// y retornarán datos frescos.

/**
 * Retorna el listado de fondos aprobados por CNV.
 *
 * Estado actual: retorna array vacío — el dashboard usa fondos.json directamente.
 * En producción: llamar al endpoint del backend que sincroniza con CNV.
 *
 * @example
 * // Futuro:
 * const response = await fetch('/api/cnv/fondos');
 * return response.json() as FondoCNVRaw[];
 */
export async function getFondosCNV(): Promise<FondoCNVRaw[]> {
  // TODO: Reemplazar con llamada al backend de sincronización CNV.
  // El backend debería correr el scraper y cachear resultados.
  // No hacer scraping desde el frontend (CORS, rate limiting).
  return [];
}

/**
 * Retorna la composición de cartera de un fondo específico según CNV.
 *
 * Estado actual: retorna null — sin datos de composición real.
 * En producción: buscar en el cache de composiciones mensuales CNV.
 *
 * @param nroRegistro - Número de registro CNV del fondo
 */
export async function getComposicionCNV(
  nroRegistro: string
): Promise<ComposicionCNVRaw | null> {
  // TODO: Fetch del endpoint de composición CNV.
  // Ejemplo de URL esperada: /api/cnv/composicion/:nro_registro
  // La composición CNV tiene rezago de ~30 días vs CAFCI.
  void nroRegistro;
  return null;
}

/**
 * Verifica si el servicio CNV está disponible.
 * Útil para mostrar estado de fuente de datos en el dashboard.
 */
export async function checkCNVDisponible(): Promise<boolean> {
  // TODO: Hacer un HEAD request al backend CNV para confirmar disponibilidad.
  return false;
}

// ─── Normalización CNV → Fondo ────────────────────────────────────────────────

/**
 * Tabla de mapeo: tipo_cnv (string del portal CNV) → TipoFondo (enum interno).
 * Agregar entradas a medida que se descubran nuevas categorías en CNV.
 */
const MAPA_TIPO_CNV: Record<string, TipoFondo> = {
  "renta fija":    "Renta Fija",
  "renta variable":"Renta Variable",
  "renta mixta":   "Renta Mixta",
  "money market":  "Money Market",
  "mercado de dinero": "Money Market",
  "infraestructura": "Infraestructura",
  "cerrado":       "Cerrado",
  "hedging":       "Hedging",
};

/**
 * Tabla de mapeo: estado CNV → EstadoFondo (enum interno).
 */
const MAPA_ESTADO_CNV: Record<string, EstadoFondo> = {
  "autorizado":    "Activo",
  "activo":        "Activo",
  "suspendido":    "Suspendido",
  "liquidado":     "Liquidado",
  "en formación":  "En formación",
  "en formacion":  "En formación",
};

/**
 * Convierte un registro crudo de CNV al tipo interno `Fondo`.
 *
 * Campos que CNV NO provee (quedan como null/vacíos hasta enriquecimiento):
 *   - valor_cuotaparte, fecha_valor  → viene de CAFCI / snapshots
 *   - aum_millones                   → viene de CAFCI
 *   - rendimientos, historial        → calculados desde snapshots
 *   - composicion_mock               → viene de CNV composición (separada)
 *   - rescate_plazo, comision, etc.  → operativos de CAFCI
 *
 * @param raw - Registro tal como devuelve el portal CNV (o el scraper)
 */
export function mapCNVToFondo(raw: FondoCNVRaw): Fondo {
  const tipoKey = raw.tipo_cnv.toLowerCase().trim();
  const estadoKey = raw.estado.toLowerCase().trim();

  return {
    id: raw.nro_registro,
    nombre: raw.nombre,
    sociedad_gerente: raw.sociedad_gerente,
    sociedad_depositaria: raw.sociedad_depositaria,
    tipo_fondo: MAPA_TIPO_CNV[tipoKey] ?? "Renta Fija", // fallback razonable
    moneda: "ARS", // CNV no lo expone en el listado; default ARS
    objeto_inversion: raw.objeto_inversion,
    estado: MAPA_ESTADO_CNV[estadoKey] ?? "Activo",
    valor_cuotaparte: null,  // pendiente de CAFCI / snapshot
    fecha_valor: raw.fecha_actualizacion_cnv,
    fuente_dato: "CNV",
    link_cnv: raw.url_cnv,
    link_reglamento: raw.url_reglamento,
    link_composicion: null,  // pendiente de composición CNV
    composicion_mock: [],    // pendiente de enriquecimiento
    fuente: {
      cuotaparte: "no_disponible",
      composicion: "CNV",
      patrimonio: "no_disponible",
      rendimientos: "no_disponible",
    },
  };
}
