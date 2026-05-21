/**
 * src/services/fondosRepository.ts
 *
 * Orquestador central de datos.
 * Fusiona las fuentes disponibles en el tipo interno `Fondo[]`.
 *
 * ─── ESTRATEGIA DE CARGA ─────────────────────────────────────────────────────
 *
 *   1. ArgentinaDatos (CAFCI) — fuente primaria de cuotapartes y listado
 *      ✅ API pública, CORS abierto, sin auth, actualizada diariamente
 *      Si responde → se usan los fondos reales (~1000+ entradas)
 *      Si falla    → se usa el seed (fondos.json, 20 fondos de referencia)
 *
 *   2. CNV — fuente de datos estructurales (nombre, gerente, estado)
 *      ⚠️  Sin API REST pública desde browser. Requiere backend scraper.
 *      Estado actual: siempre retorna []. Ver cnvService.ts para detalle.
 *
 *   3. Historial propio (snapshots) — serie temporal propia
 *      Solo si opciones.enriquecerConHistorico = true
 *      Aún sin snapshots → se omite silenciosamente
 *
 * ─── POR QUÉ CNV NO SE CONECTÓ ───────────────────────────────────────────────
 *
 *   CNV (cnv.gob.ar) no expone REST API accesible desde browser:
 *   - Portal HTML paginado → requiere scraping Node.js con cheerio/playwright
 *   - XLSX descargable → requiere script de ingestión
 *   - Sin CORS headers → fetch() del browser falla
 *   - datos.gob.ar: solo CSVs estáticos, sin endpoint de listado JSON
 *
 *   Próximo paso: implementar scripts/ingest-cnv.ts, cachear en backend propio,
 *   y apuntar cnvService.getFondosCNV() a ese endpoint.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Fondo, FondosMeta, FuentesDatoCampo } from "../types/fondo";
import { getFondosCNV, mapCNVToFondo } from "./cnvService";
import { getHistorico, calcularRendimientosDesdeHistorico } from "./historicoService";
import { getFondosArgentinaDatos, mapArgentinaDatosToFondo } from "./argentinaDatosService";

import seedData from "../data/fondos.json";

// ─── Tipos del repositorio ────────────────────────────────────────────────────

export interface ResultadoCargaFondos {
  fondos: Fondo[];
  fondosMeta: FondosMeta;
  stats: {
    total: number;
    con_cuotaparte: number;
    con_historial: number;
    fuentes_activas: string[];
  };
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Carga el listado de fondos desde la mejor fuente disponible.
 *
 * Orden de prioridad:
 *   1. ArgentinaDatos (CAFCI) → fondos reales con VCP del día
 *   2. fondos.json (seed)     → 20 fondos de referencia (fallback)
 *
 * Si se pide enriquecimiento histórico, aplica snapshots propios sobre el
 * resultado (sea cual sea la fuente que ganó).
 */
export async function cargarFondos(
  opciones: { enriquecerConHistorico?: boolean } = {}
): Promise<ResultadoCargaFondos> {
  const fuentesActivas: string[] = [];
  let fondos: Fondo[] = [];

  // ── Paso 1: Intentar ArgentinaDatos como fuente primaria ───────────────────
  try {
    const rawItems = await getFondosArgentinaDatos();

    // Solo fondos con VCP válido (descarta clases suspendidas/inactivas)
    const activos = rawItems.filter((item) => item.vcp != null && item.vcp > 0);
    fondos = activos.map(mapArgentinaDatosToFondo);

    fuentesActivas.push("ArgentinaDatos");
    console.info(
      `[fondosRepository] ✅ ArgentinaDatos: ${rawItems.length} entradas → ` +
        `${fondos.length} fondos activos cargados`
    );
  } catch (e) {
    console.warn(
      "[fondosRepository] ⚠️  ArgentinaDatos no disponible → fallback a seed (fondos.json).",
      e instanceof Error ? e.message : e
    );
  }

  // ── Paso 2: Fallback a seed si ArgentinaDatos falló ───────────────────────
  if (fondos.length === 0) {
    // Intentar también CNV (siempre retorna [] por ahora; listo para cuando
    // el scraper esté implementado)
    const fondosCNVRaw = await getFondosCNV();
    if (fondosCNVRaw.length > 0) {
      fondos = fondosCNVRaw.map(mapCNVToFondo);
      fuentesActivas.push("CNV");
      console.info(`[fondosRepository] ✅ CNV: ${fondos.length} fondos cargados`);
    } else {
      fondos = seedData.fondos as unknown as Fondo[];
      fuentesActivas.push("seed");
      console.info(
        `[fondosRepository] ⚠️  Usando seed local (fondos.json): ${fondos.length} fondos`
      );
    }
  }

  // ── Paso 3: Enriquecer con historial propio (snapshots) ───────────────────
  if (opciones.enriquecerConHistorico) {
    fondos = await Promise.all(fondos.map(enriquecerConHistorial));
  }

  // ── Paso 4: Resolver fuentes por campo ────────────────────────────────────
  fondos = fondos.map((fondo) => ({
    ...fondo,
    fuente: resolverFuentes(fondo),
  }));

  // ── Estadísticas ──────────────────────────────────────────────────────────
  const conCuotaparte = fondos.filter((f) => f.valor_cuotaparte != null).length;
  const conHistorial = fondos.filter(
    (f) => (f.historial_cuotapartes?.length ?? 0) > 0
  ).length;

  const fechaRef =
    fondos.find((f) => f.fecha_valor != null)?.fecha_valor ??
    seedData.meta.ultima_actualizacion;

  return {
    fondos,
    fondosMeta: {
      ultima_actualizacion: fechaRef,
      fuente: fuentesActivas.join(" + "),
      total_registros: fondos.length,
    },
    stats: {
      total: fondos.length,
      con_cuotaparte: conCuotaparte,
      con_historial: conHistorial,
      fuentes_activas: fuentesActivas,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function enriquecerConHistorial(fondo: Fondo): Promise<Fondo> {
  const historico = await getHistorico(fondo.id, 90);
  if (historico.length === 0) return fondo;
  const rendimientos = calcularRendimientosDesdeHistorico(fondo.id, historico);
  return {
    ...fondo,
    historial_cuotapartes: historico,
    rendimientos: rendimientos ?? fondo.rendimientos,
  };
}

function resolverFuentes(fondo: Fondo): FuentesDatoCampo {
  const tieneHistorialPropio =
    (fondo.historial_cuotapartes?.length ?? 0) > 0 &&
    (fondo.historial_cuotapartes?.some(
      (h) => h.fecha >= new Date().toISOString().split("T")[0]
    ) ?? false);

  const deCAFCI = fondo.fuente_dato === "CAFCI";

  return {
    cuotaparte: tieneHistorialPropio
      ? "snapshot"
      : deCAFCI
      ? "CAFCI"
      : fondo.valor_cuotaparte != null
      ? "manual"
      : "no_disponible",
    composicion: fondo.fuente_dato === "CNV" ? "CNV" : "manual",
    patrimonio:
      fondo.aum_millones != null
        ? deCAFCI
          ? "CAFCI"
          : "manual"
        : "no_disponible",
    rendimientos: tieneHistorialPropio ? "snapshot" : "manual",
  };
}

// ─── Acceso individual ────────────────────────────────────────────────────────

export async function getFondoDetalle(id: string): Promise<Fondo | null> {
  const { fondos } = await cargarFondos({ enriquecerConHistorico: true });
  return fondos.find((f) => f.id === id) ?? null;
}
