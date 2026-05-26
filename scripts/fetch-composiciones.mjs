#!/usr/bin/env node
/**
 * scripts/fetch-composiciones.mjs
 *
 * Descarga la composición real de cartera de todos los fondos CAFCI.
 *
 * Fuente: https://estadisticas.cafci.org.ar/fondos/{fondoId}?clase={claseId}
 *   - El HTML incluye data-pie-chart-items-value="[{nombre, porcentaje}, ...]"
 *   - La fecha de la composición está en <div class="valores">Valores al DD/MM/YYYY</div>
 *
 * Mapa fondoId/claseId: https://estadisticas.cafci.org.ar/consulta-de-fondos.json
 *   { fondos: [{ id, nombre, clases: [{ id, nombre }] }] }
 *   → clase.nombre == nombre del fondo tal como aparece en ArgentinaDatos
 *
 * Salida: src/data/composiciones-reales.json
 *   { [fondoSlug]: { fecha, items: [{ nombre, porcentaje }] } }
 *
 * Uso:
 *   npm run fetch:composiciones
 *
 * Opciones de entorno:
 *   CONCURRENCY   Paralelos simultáneos (default: 5)
 *   MAX_RETRIES   Reintentos por fondo (default: 2)
 *   DELAY_MS      Delay entre batches en ms (default: 200)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUTPUT = resolve(ROOT, "src/data/composiciones-reales.json");

const CATALOG_URL = "https://estadisticas.cafci.org.ar/consulta-de-fondos.json";
const FICHA_BASE  = "https://estadisticas.cafci.org.ar/fondos";

const CONCURRENCY  = parseInt(process.env.CONCURRENCY  ?? "5");
const MAX_RETRIES  = parseInt(process.env.MAX_RETRIES  ?? "0");
const DELAY_MS     = parseInt(process.env.DELAY_MS     ?? "100");
// Skip fondos already in the output file with data newer than STALE_DAYS.
// Set FORCE_FULL=1 to bypass and re-fetch everything.
const STALE_DAYS   = parseInt(process.env.STALE_DAYS   ?? "35");
const FORCE_FULL   = process.env.FORCE_FULL === "1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugificar(nombre) {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFechaComposicion(html) {
  // <div class="valores">Valores al DD/MM/YYYY</div>
  const m = html.match(/class="valores"[^>]*>Valores al (\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`; // YYYY-MM-DD
}

function parseItems(html) {
  const m = html.match(/data-pie-chart-items-value="([^"]+)"/);
  if (!m) return null;
  const decoded = m[1].replace(/&quot;/g, '"');
  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "fondos-cnv-ingest/1.0",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(500 * (attempt + 1));
    }
  }
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

async function runPool(tasks, concurrency) {
  const results = new Array(tasks.length);
  let i = 0;

  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Descargar catálogo con fondoId / claseId
  console.log("[fetch-composiciones] Descargando catálogo...");
  let catalog;
  try {
    const res = await fetch(CATALOG_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    catalog = await res.json();
  } catch (err) {
    console.error("[fetch-composiciones] ❌ No se pudo descargar el catálogo:", err.message);
    process.exit(1);
  }

  // 2. Construir lista de fondos: { slug, nombre, fondoId, claseId }
  const items = [];
  for (const fondo of catalog.fondos ?? []) {
    for (const clase of fondo.clases ?? []) {
      items.push({
        slug:    slugificar(clase.nombre),
        nombre:  clase.nombre,
        fondoId: fondo.id,
        claseId: clase.id,
      });
    }
  }
  console.log(`[fetch-composiciones] Catálogo: ${items.length} clases en ${catalog.total_fondos} fondos`);

  // 3. Cargar composiciones existentes para modo incremental
  let existentes = {};
  try {
    existentes = JSON.parse(readFileSync(OUTPUT, "utf8")).composiciones ?? {};
  } catch { /* archivo no existe aún */ }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let carried = 0;
  const toFetch = [];
  for (const item of items) {
    const ex = existentes[item.slug];
    if (!FORCE_FULL && ex?.fecha && ex.fecha >= cutoffStr) {
      carried++;
    } else {
      toFetch.push(item);
    }
  }
  console.log(`[fetch-composiciones] Incremental: ${carried} actualizados recientemente, ${toFetch.length} a procesar`);
  if (FORCE_FULL) console.log("[fetch-composiciones] FORCE_FULL=1: re-fetching todo");

  // 4. Fetch solo los fondos que lo necesitan
  const composiciones = { ...existentes };
  let ok = 0, skipped = 0, failed = 0;

  const tasks = toFetch.map((item) => async () => {
    const url = `${FICHA_BASE}/${item.fondoId}?clase=${item.claseId}`;
    try {
      const html = await fetchWithRetry(url);
      const items_comp = parseItems(html);
      const fecha = parseFechaComposicion(html);

      if (!items_comp || items_comp.length === 0) {
        skipped++;
        return;
      }

      composiciones[item.slug] = {
        nombre:  item.nombre,
        fondoId: item.fondoId,
        claseId: item.claseId,
        fecha:   fecha,
        items:   items_comp.map(i => ({
          nombre:     i.nombre,
          porcentaje: i.porcentaje,
        })),
      };
      ok++;
    } catch (err) {
      failed++;
      if (process.env.VERBOSE) {
        console.warn(`  ⚠ ${item.nombre}: ${err.message}`);
      }
    }

    // Delay entre batches para no saturar el servidor
    if ((ok + skipped + failed) % CONCURRENCY === 0) {
      await sleep(DELAY_MS);
    }
  });

  console.log(`[fetch-composiciones] Descargando composiciones (${CONCURRENCY} paralelos)...`);
  const total = toFetch.length;
  let logged = 0;
  // Log de progreso cada 100 fondos
  const logInterval = setInterval(() => {
    const done = ok + skipped + failed;
    if (done > logged) {
      console.log(`  → ${done}/${total} procesados (✅ ${ok} | ⏭ ${skipped} sin datos | ❌ ${failed} errores)`);
      logged = done;
    }
  }, 3000);

  await runPool(tasks, CONCURRENCY);
  clearInterval(logInterval);

  const totalConDatos = Object.keys(composiciones).length;
  console.log(`[fetch-composiciones] Listo: ✅ ${ok} nuevos | ⏭ ${skipped} sin datos | ❌ ${failed} errores | 📦 ${totalConDatos} total en archivo`);

  // 5. Escribir JSON
  const output = {
    generado_en: new Date().toISOString(),
    total_con_datos: totalConDatos,
    total_sin_datos: skipped,
    total_errores: failed,
    composiciones,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2), "utf8");
  console.log(`[fetch-composiciones] ✅ Guardado en ${OUTPUT}`);
}

main().catch(err => {
  console.error("[fetch-composiciones] Error fatal:", err);
  process.exit(1);
});
