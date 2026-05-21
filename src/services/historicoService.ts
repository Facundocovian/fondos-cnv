/**
 * src/services/historicoService.ts
 *
 * Servicio para el histórico de cuotapartes construido con snapshots propios.
 *
 * El histórico NO depende de que CNV o CAFCI ofrezcan series temporales.
 * En cambio, guardamos snapshots diarios propios en:
 *   public/historial/YYYY-MM-DD.json
 *
 * Un script de ingestión (scripts/snapshot.ts) corre cada día hábil,
 * consulta CAFCI, y persiste el snapshot del día.
 *
 * ─── ESTRUCTURA DE ARCHIVOS ──────────────────────────────────────────────────
 *
 *   public/
 *   └── historial/
 *       ├── index.json              ← índice de fechas disponibles
 *       ├── schema.example.json     ← contrato del formato (referencia)
 *       ├── 2026-05-19.json         ← snapshot del día (generado por script)
 *       ├── 2026-05-16.json
 *       └── ...
 *
 * ─── CÓMO IMPLEMENTAR EL SCRIPT DE INGESTIÓN ─────────────────────────────────
 *
 * TODO: Crear scripts/snapshot.ts que:
 *   1. Llame a getCuotapartesCafci() de cafciService.ts
 *   2. Normalice al formato SnapshotFondo[]
 *   3. Escriba public/historial/YYYY-MM-DD.json
 *   4. Actualice public/historial/index.json con la nueva fecha
 *
 * TODO: Configurar cron job o GitHub Action para correr el script:
 *   - Lunes a viernes a las 20hs Argentina (CAFCI publica ~ 18-19hs)
 *   - Con reintentos automáticos si CAFCI no responde
 *
 * ─── ACCESO EN RUNTIME ───────────────────────────────────────────────────────
 *
 * Los archivos en public/ se sirven estáticamente por Vite en dev
 * y por el hosting (Vercel, Netlify, etc.) en producción.
 * Se acceden con fetch('/historial/YYYY-MM-DD.json').
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { SnapshotDiario, HistorialIndex } from "./types";
import type { HistorialCuotaparte, Rendimientos } from "../types/fondo";

const HISTORIAL_BASE_URL = "/historial";

// ─── Índice de snapshots disponibles ──────────────────────────────────────────

/**
 * Carga el índice de fechas de snapshots disponibles.
 * El índice vive en public/historial/index.json.
 *
 * Estado actual: retorna índice vacío (aún no hay snapshots).
 */
export async function getIndiceSnapshots(): Promise<HistorialIndex> {
  try {
    const res = await fetch(`${HISTORIAL_BASE_URL}/index.json`);
    if (!res.ok) return { ultima_fecha: null, fechas: [] };
    return res.json() as Promise<HistorialIndex>;
  } catch {
    // Sin snapshots disponibles todavía
    return { ultima_fecha: null, fechas: [] };
  }
}

// ─── Lectura de snapshots ──────────────────────────────────────────────────────

/**
 * Carga el snapshot de una fecha específica.
 *
 * @param fecha - Formato "YYYY-MM-DD"
 * @returns SnapshotDiario o null si no existe snapshot para esa fecha
 */
export async function getSnapshot(
  fecha: string
): Promise<SnapshotDiario | null> {
  try {
    const res = await fetch(`${HISTORIAL_BASE_URL}/${fecha}.json`);
    if (!res.ok) return null;
    return res.json() as Promise<SnapshotDiario>;
  } catch {
    return null;
  }
}

/**
 * Carga múltiples snapshots en paralelo para un rango de fechas.
 * Las fechas que no tengan snapshot son ignoradas silenciosamente.
 *
 * @param fechas - Array de fechas en formato "YYYY-MM-DD"
 */
export async function getSnapshots(
  fechas: string[]
): Promise<SnapshotDiario[]> {
  const resultados = await Promise.allSettled(
    fechas.map((f) => getSnapshot(f))
  );
  return resultados
    .filter(
      (r): r is PromiseFulfilledResult<SnapshotDiario> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}

// ─── Historial de cuotaparte por fondo ────────────────────────────────────────

/**
 * Construye el historial de cuotaparte de un fondo específico
 * a partir de los snapshots disponibles.
 *
 * Estado actual: retorna array vacío (sin snapshots disponibles).
 *
 * En producción:
 *   1. Lee index.json para saber qué fechas hay
 *   2. Carga todos los snapshots del período pedido
 *   3. Extrae el valor del fondo en cada snapshot
 *   4. Retorna serie temporal ordenada cronológicamente
 *
 * @param fondoId - ID del fondo (nro_registro CNV)
 * @param diasAtras - Cuántos días de historial recuperar (default: 90)
 */
export async function getHistorico(
  fondoId: string,
  diasAtras = 90
): Promise<HistorialCuotaparte[]> {
  const indice = await getIndiceSnapshots();
  if (indice.fechas.length === 0) {
    // Sin snapshots todavía. El historial vendrá de fondos.json (seed)
    // hasta que el script de ingestión empiece a correr.
    return [];
  }

  // Calcular rango de fechas a cargar
  const fechasEnRango = indice.fechas
    .slice(-diasAtras)
    .filter((f) => f <= new Date().toISOString().split("T")[0]);

  const snapshots = await getSnapshots(fechasEnRango);

  // Extraer valores del fondo específico en cada snapshot
  const historial: HistorialCuotaparte[] = [];
  for (const snapshot of snapshots) {
    const entry = snapshot.fondos.find((f) => f.id === fondoId);
    if (entry?.valor_cuotaparte != null) {
      historial.push({
        fecha: snapshot.fecha,
        valor: entry.valor_cuotaparte,
      });
    }
  }

  return historial.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ─── Cálculo de rendimientos desde snapshots ──────────────────────────────────

/**
 * Calcula rendimientos a partir del historial propio de snapshots.
 *
 * La fórmula es: rendimiento_Nd = (valor_hoy / valor_hace_N_dias - 1) * 100
 *
 * Estado actual: retorna null si no hay historial propio.
 * En producción: usa los snapshots para calcular rendimientos verificables.
 *
 * @param fondoId - ID del fondo
 * @param historial - Serie temporal de cuotapartes (ordenada cronológicamente)
 */
export function calcularRendimientosDesdeHistorico(
  fondoId: string,
  historial: HistorialCuotaparte[]
): Rendimientos | null {
  void fondoId;

  if (historial.length < 2) return null;

  const valorHoy = historial[historial.length - 1].valor;

  function rendN(diasAtras: number): number | null {
    if (historial.length <= diasAtras) return null;
    const valorBase = historial[historial.length - 1 - diasAtras].valor;
    if (!valorBase || valorBase <= 0) return null;
    return +((valorHoy / valorBase - 1) * 100).toFixed(2);
  }

  // YTD: desde el 1 de enero del año actual
  const hoy = historial[historial.length - 1].fecha;
  const anoActual = hoy.substring(0, 4);
  const entradaYTD = historial.find((h) => h.fecha >= `${anoActual}-01-01`);
  const ytd =
    entradaYTD && entradaYTD.valor > 0
      ? +((valorHoy / entradaYTD.valor - 1) * 100).toFixed(2)
      : null;

  return {
    diario: rendN(1),
    semanal: rendN(7),
    mensual: rendN(30),
    trimestral: rendN(90),
    anual: rendN(365),
    ytd,
  };
}

/**
 * Verifica si hay snapshots disponibles para una fecha dada.
 *
 * @param fecha - Formato "YYYY-MM-DD"
 */
export async function existeSnapshot(fecha: string): Promise<boolean> {
  const indice = await getIndiceSnapshots();
  return indice.fechas.includes(fecha);
}
