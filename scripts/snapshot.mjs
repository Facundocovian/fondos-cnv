#!/usr/bin/env node
/**
 * scripts/snapshot.mjs
 *
 * Guarda un snapshot diario de cuotapartes para todos los fondos activos.
 * Fuente: ArgentinaDatos /ultimo (agrega datos de CAFCI, CORS abierto).
 *
 * Salida:
 *   public/historial/YYYY-MM-DD.json   ← snapshot del día
 *   public/historial/index.json         ← índice de fechas disponibles
 *
 * Uso:
 *   node scripts/snapshot.mjs
 *
 * Corre diariamente desde GitHub Actions después del workflow de actualización
 * de datos. Con ~2 días de snapshots empieza a funcionar el rendimiento diario;
 * con 30 días el mensual; con 365 el anual.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const HISTORIAL_DIR = resolve(ROOT, "public/historial");
const INDEX_PATH    = resolve(HISTORIAL_DIR, "index.json");
const PLANILLA_PATH = resolve(ROOT, "src/data/cafci-planilla.json");

const AD_BASE = "https://api.argentinadatos.com/v1/finanzas/fci";
const CATEGORIAS = ["mercadoDinero", "rentaFija", "rentaMixta", "rentaVariable"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugificar(nombre) {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fechaHoy() {
  return new Date().toISOString().split("T")[0];
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchCategoria(categoria) {
  const res = await fetch(`${AD_BASE}/${categoria}/ultimo`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.warn(`[snapshot] ${categoria}: HTTP ${res.status} — omitiendo`);
    return [];
  }
  return res.json();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const fecha = fechaHoy();
  const snapshotPath = resolve(HISTORIAL_DIR, `${fecha}.json`);

  // Cargar planilla para obtener moneda por fondo (best-effort)
  let planillaMoneda = {};
  if (existsSync(PLANILLA_PATH)) {
    try {
      const planilla = JSON.parse(readFileSync(PLANILLA_PATH, "utf8"));
      for (const [slug, datos] of Object.entries(planilla)) {
        planillaMoneda[slug] = datos.moneda ?? "ARS";
      }
    } catch {
      console.warn("[snapshot] No se pudo leer cafci-planilla.json, moneda será ARS por defecto");
    }
  }

  // Fetch todas las categorías en paralelo
  console.log(`[snapshot] Obteniendo datos para ${fecha}...`);
  const resultados = await Promise.allSettled(CATEGORIAS.map(fetchCategoria));

  const fondosMapa = new Map(); // slug → { id, valor_cuotaparte, moneda, patrimonio_neto }

  for (const resultado of resultados) {
    if (resultado.status !== "fulfilled") continue;
    for (const item of resultado.value) {
      if (item.vcp == null || item.fecha == null) continue;
      const slug = slugificar(item.fondo);
      // Si ya existe el slug (misma gerente, distintas clases), conservar el de mayor patrimonio
      const existente = fondosMapa.get(slug);
      if (existente && (existente.patrimonio_neto ?? 0) >= (item.patrimonio ?? 0)) continue;
      fondosMapa.set(slug, {
        id: slug,
        valor_cuotaparte: item.vcp,
        moneda: planillaMoneda[slug] ?? "ARS",
        patrimonio_neto: item.patrimonio ?? null,
      });
    }
  }

  if (fondosMapa.size === 0) {
    console.error("[snapshot] Sin datos — ArgentinaDatos no respondió. Abortando.");
    process.exit(1);
  }

  const fondos = [...fondosMapa.values()];
  console.log(`[snapshot] ${fondos.length} fondos obtenidos`);

  // Escribir snapshot del día
  const snapshot = {
    fecha,
    generado_en: new Date().toISOString(),
    "fuente_ingestión": "CAFCI",
    fondos,
  };
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`[snapshot] Escrito: public/historial/${fecha}.json`);

  // Actualizar index.json
  let index = { ultima_fecha: null, fechas: [] };
  if (existsSync(INDEX_PATH)) {
    try {
      index = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
    } catch {
      // index corrupto → resetear
    }
  }

  if (!index.fechas.includes(fecha)) {
    index.fechas.push(fecha);
    index.fechas.sort();
  }
  index.ultima_fecha = index.fechas[index.fechas.length - 1];

  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`[snapshot] index.json actualizado — ${index.fechas.length} fecha(s) disponibles`);
}

main().catch((err) => {
  console.error("[snapshot] Error fatal:", err);
  process.exit(1);
});
