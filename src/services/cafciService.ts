/**
 * src/services/cafciService.ts
 *
 * Servicio para datos financieros y operativos de CAFCI.
 * CAFCI (Cámara Argentina de Fondos Comunes de Inversión) es la fuente
 * canónica para: cuotaparte diario, AUM, rendimientos, plazo de rescate,
 * comisiones e inversión mínima.
 *
 * ─── CÓMO CONECTAR LA FUENTE REAL ───────────────────────────────────────────
 *
 * CAFCI publica datos a través de su portal y una API no oficial:
 *   https://cafci.org.ar/
 *
 * Opciones de ingestión:
 *
 * 1. API PÚBLICA CAFCI (no documentada oficialmente)
 *    - CAFCI expone endpoints JSON usados por su propio frontend.
 *    - Los endpoints pueden cambiar sin aviso previo.
 *    - Requiere inspeccionar el tráfico del portal para obtener URLs actuales.
 *    - TODO: Identificar y documentar endpoints vigentes.
 *    - TODO: Implementar cliente con retry + circuit breaker.
 *
 * 2. SCRAPING DEL PORTAL CAFCI
 *    - Si no hay API estable, usar playwright/puppeteer para navegar el portal.
 *    - Útil para fondos que no aparecen en la API.
 *    - TODO: Implementar en scripts/ingest-cafci.ts
 *
 * 3. CONSIDERACIONES IMPORTANTES
 *    - CAFCI sólo publica datos de días hábiles bursátiles (Argentina).
 *    - Los cuotapartes del día T suelen publicarse después de las 18hs.
 *    - Money Market puede tener publicación en tiempo casi real.
 *    - El ID de fondo en CAFCI NO es el mismo que el nro_registro CNV.
 *      Se necesita una tabla de mapeo (ver services/types.ts: MapeoIdsFuentes).
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import type {
  CuotaparteCafciRaw,
  DatosOperativosCafciRaw,
  RendimientosCafciRaw,
  ComposicionCafciRaw,
} from "./types";

// ─── Implementación actual: sin datos reales ──────────────────────────────────
// Todas las funciones retornan vacío/null.
// El dashboard usa los datos de fondos.json como seed hasta que
// se implemente la ingestión real.

/**
 * Retorna los cuotapartes vigentes de todos los fondos.
 *
 * Estado actual: retorna array vacío.
 * En producción: llamar al endpoint CAFCI de cuotapartes del día.
 *
 * Frecuencia de actualización sugerida: cada 30 minutos después de las 17hs
 * en días hábiles.
 *
 * @example
 * // Futuro — endpoint aproximado (verificar vigencia):
 * const res = await fetch('https://cafci.org.ar/api/cuotapartes/hoy');
 * return res.json();
 */
export async function getCuotapartesCafci(): Promise<CuotaparteCafciRaw[]> {
  // TODO: Implementar fetch al endpoint CAFCI de cuotapartes.
  // Considerar:
  //   - Manejo de horario: sólo publicado en días hábiles.
  //   - Fallback: si CAFCI no responde, usar último snapshot guardado.
  //   - Rate limiting: no más de 1 llamada por minuto.
  return [];
}

/**
 * Retorna cuotaparte de un fondo específico para una fecha dada.
 *
 * @param cafciId - ID interno de CAFCI (obtener del mapeo MapeoIdsFuentes)
 * @param fecha - Fecha en formato "YYYY-MM-DD"
 */
export async function getCuotaparteFecha(
  cafciId: string,
  fecha: string
): Promise<CuotaparteCafciRaw | null> {
  // TODO: Endpoint CAFCI de cuotaparte histórico por fondo y fecha.
  // Alternativa: leer desde snapshot propio si fecha ya fue capturada.
  void cafciId;
  void fecha;
  return null;
}

/**
 * Retorna datos operativos de un fondo (rescate, comisión, inversión mínima).
 *
 * Estado actual: retorna null — sin datos operativos reales.
 * En producción: obtener de la ficha del fondo en CAFCI.
 *
 * Nota: estos datos cambian con baja frecuencia (mensual o menos).
 * Recomendado cachear por 24hs.
 *
 * @param cafciId - ID interno de CAFCI
 */
export async function getDatosOperativosCafci(
  cafciId: string
): Promise<DatosOperativosCafciRaw | null> {
  // TODO: Scraping o API de ficha de fondo en CAFCI.
  // Los datos operativos (comisión, rescate, etc.) suelen estar en
  // la página de detalle de cada fondo en el portal CAFCI.
  void cafciId;
  return null;
}

/**
 * Retorna rendimientos calculados por CAFCI para un fondo.
 *
 * Estado actual: retorna null — rendimientos sin fuente real.
 * En producción: CAFCI publica rendimientos en su portal de estadísticas.
 *
 * Nota: los rendimientos de CAFCI son los oficiales para publicidad.
 * Para rendimientos propios calculados desde snapshots, ver historicoService.
 *
 * @param cafciId - ID interno de CAFCI
 */
export async function getRendimientosCafci(
  cafciId: string
): Promise<RendimientosCafciRaw | null> {
  // TODO: Endpoint de rendimientos CAFCI.
  // CAFCI publica TNA, rendimiento mensual, trimestral, anual.
  // Verificar si hay un endpoint JSON o requiere scraping.
  void cafciId;
  return null;
}

/**
 * Retorna la composición de cartera de un fondo según CAFCI.
 *
 * Estado actual: retorna null — composición sin fuente real.
 * En producción: CAFCI publica composición mensual en su portal.
 *
 * Nota: CAFCI publica composición con formato estándar CNV.
 * Frecuencia: mensual, suele publicarse los primeros 10 días del mes siguiente.
 *
 * @param cafciId - ID interno de CAFCI
 */
export async function getComposicionCafci(
  cafciId: string
): Promise<ComposicionCafciRaw | null> {
  // TODO: Scraping o endpoint de composición CAFCI.
  // Ver también cnvService.getComposicionCNV() — CNV también publica composición.
  void cafciId;
  return null;
}

/**
 * Verifica si el servicio CAFCI está disponible.
 */
export async function checkCafciDisponible(): Promise<boolean> {
  // TODO: HEAD request al portal CAFCI para verificar disponibilidad.
  return false;
}
