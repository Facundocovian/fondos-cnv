/**
 * src/services/argentinaDatosService.ts
 *
 * Cliente para la API pública de ArgentinaDatos.
 * ArgentinaDatos agrega datos de CAFCI y los expone como una API REST documentada,
 * sin autenticación, con CORS abierto (accesible desde el browser).
 *
 * Documentación oficial: https://argentinadatos.com/docs/
 * GitHub: https://github.com/enzonotario/esjs-argentina-datos
 *
 * ─── ENDPOINTS USADOS ────────────────────────────────────────────────────────
 *
 *   GET /v1/finanzas/fci/{categoria}/ultimo
 *
 *   Categorías disponibles:
 *     - mercadoDinero   → Money Market
 *     - rentaFija       → Renta Fija
 *     - rentaMixta      → Renta Mixta
 *     - rentaVariable   → Renta Variable
 *
 *   Respuesta (array): [{
 *     fondo: string,            // nombre del fondo incluyendo clase ("- Clase A")
 *     horizonte: string | null, // "corto" | "medio" | "largo" | "PLA"
 *     fecha: string | null,     // "YYYY-MM-DD" — fecha del valor publicado
 *     vcp: number | null,       // Valor Cuota Parte
 *     ccp: number | null,       // Cantidad Cuota Parte (shares outstanding)
 *     patrimonio: number | null // Patrimonio neto total (en ARS)
 *   }]
 *
 * ─── NOTA SOBRE FUENTE ───────────────────────────────────────────────────────
 *
 *   Los datos provienen de CAFCI, no de CNV.
 *   CNV no tiene REST API accesible desde el browser (ver cnvService.ts).
 *   ArgentinaDatos es la alternativa pública más estable disponible.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Fondo, TipoFondo } from "../types/fondo";
import { getPlanillaFondo, formatearPlazo, getComposicion } from "./cafciPlanillaService";

const BASE_URL = "https://api.argentinadatos.com/v1/finanzas/fci";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Categoria = "mercadoDinero" | "rentaFija" | "rentaMixta" | "rentaVariable";

/** Item crudo tal como devuelve la API, más la categoría del endpoint de origen. */
export interface ArgentinaDatosItem {
  fondo: string;
  horizonte: string | null;
  fecha: string | null;
  /** Valor Cuota Parte */
  vcp: number | null;
  /** Cantidad Cuota Parte (unidades en circulación) */
  ccp: number | null;
  /** Patrimonio neto total en ARS */
  patrimonio: number | null;
  /** Categoría del endpoint que devolvió este item */
  categoria: Categoria;
}

const CATEGORIAS: Categoria[] = [
  "mercadoDinero",
  "rentaFija",
  "rentaMixta",
  "rentaVariable",
];

const CATEGORIA_A_TIPO: Record<Categoria, TipoFondo> = {
  mercadoDinero: "Money Market",
  rentaFija:     "Renta Fija",
  rentaMixta:    "Renta Mixta",
  rentaVariable: "Renta Variable",
};

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchCategoria(categoria: Categoria): Promise<ArgentinaDatosItem[]> {
  const res = await fetch(`${BASE_URL}/${categoria}/ultimo`, {
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    throw new Error(`ArgentinaDatos [${categoria}]: HTTP ${res.status}`);
  }
  const raw = await res.json() as Omit<ArgentinaDatosItem, "categoria">[];
  return raw.map((item) => ({ ...item, categoria }));
}

/**
 * Obtiene el listado completo de fondos desde ArgentinaDatos.
 * Carga las cuatro categorías en paralelo; incluye las que responden,
 * descarta silenciosamente las que fallan.
 *
 * @throws Error si TODAS las categorías fallan (servicio caído)
 */
export async function getFondosArgentinaDatos(): Promise<ArgentinaDatosItem[]> {
  const resultados = await Promise.allSettled(CATEGORIAS.map(fetchCategoria));

  const fondos: ArgentinaDatosItem[] = [];
  let errores = 0;

  for (const r of resultados) {
    if (r.status === "fulfilled") {
      fondos.push(...r.value);
    } else {
      errores++;
      console.warn("[argentinaDatosService] Categoría falló:", r.reason);
    }
  }

  if (errores === CATEGORIAS.length) {
    throw new Error("ArgentinaDatos: todas las categorías fallaron");
  }

  return fondos;
}

// ─── Normalización → Fondo ────────────────────────────────────────────────────

/**
 * Convierte un item crudo de ArgentinaDatos al tipo interno `Fondo`.
 *
 * Campos disponibles desde ArgentinaDatos:
 *   ✅ nombre, tipo_fondo, valor_cuotaparte, fecha_valor, patrimonio, horizonte
 *
 * Campos NO disponibles (requieren CNV o fuente adicional):
 *   ❌ sociedad_gerente, sociedad_depositaria, objeto_inversion, composicion
 *   ❌ rendimientos, historial (requieren snapshots propios)
 */
export function mapArgentinaDatosToFondo(item: ArgentinaDatosItem): Fondo {
  // Enriquecer con datos estructurales de la planilla CAFCI
  const planilla = getPlanillaFondo(item.fondo);
  const slug = slugificar(item.fondo);
  const moneda = (planilla?.moneda as Fondo["moneda"]) ?? "ARS";
  const tipoFondo = CATEGORIA_A_TIPO[item.categoria];
  const composicion = getComposicion(slug, planilla?.tipo_fondo ?? tipoFondo, moneda);

  return {
    id: slug,
    nombre: item.fondo,
    sociedad_gerente: planilla?.sociedad_gerente ?? "",
    sociedad_depositaria: planilla?.sociedad_depositaria ?? "",
    tipo_fondo: tipoFondo,
    moneda,
    objeto_inversion: "",
    estado: "Activo",
    valor_cuotaparte: item.vcp,
    fecha_valor: item.fecha,
    fuente_dato: "CAFCI",
    link_cnv: planilla?.codigo_cnv
      ? `https://www.cnv.gov.ar/sitioweb/#!/FondosComunes/${planilla.codigo_cnv}`
      : null,
    link_reglamento: null,
    link_composicion: null,
    composicion_mock: composicion.items,
    composicion_fuente: composicion.fuente,
    composicion_fecha: composicion.fecha,
    aum_millones:
      item.patrimonio != null
        ? +(item.patrimonio / 1_000_000).toFixed(2)
        : null,
    horizonte_inversion: item.horizonte,
    // Datos operativos de la planilla
    rescate_plazo: planilla ? formatearPlazo(planilla.plazo_liquidacion) : null,
    comision_administracion: planilla?.honorarios_adm_sg ?? null,
    inversion_minima: planilla?.minimo_inversion ?? null,
    fuente: {
      cuotaparte: "CAFCI",
      composicion: "no_disponible",
      patrimonio: item.patrimonio != null ? "CAFCI" : "no_disponible",
      rendimientos: "no_disponible",
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Genera un ID estable a partir del nombre del fondo.
 *
 * @example
 * slugificar("Balanz Capital Money Market - Clase A")
 * // → "balanz-capital-money-market-clase-a"
 */
function slugificar(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[^a-z0-9]+/g, "-")    // no-alfanumérico → guión
    .replace(/^-+|-+$/g, "");        // quitar guiones extremos
}

/**
 * Normaliza el nombre de un fondo para matching fuzzy.
 * Elimina sufijos de clase ("- Clase A", "- Clase B", etc.),
 * convierte a minúsculas y colapsa espacios.
 *
 * @example
 * normalizarNombreFondo("Schroder Renta Fija Argentina - Clase A")
 * // → "schroder renta fija argentina"
 */
export function normalizarNombreFondo(nombre: string): string {
  return nombre
    .toLowerCase()
    .replace(/[-–]\s*clase\s+[a-z0-9]+\s*$/i, "") // quitar "- Clase A"
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Construye un mapa de búsqueda: nombre_normalizado → ArgentinaDatosItem.
 * Cuando un mismo fondo tiene múltiples clases, conserva la de mayor patrimonio.
 * Útil si en el futuro se quiere volver a enriquecer por nombre.
 */
export function buildLookupMap(
  items: ArgentinaDatosItem[]
): Map<string, ArgentinaDatosItem> {
  const mapa = new Map<string, ArgentinaDatosItem>();

  for (const item of items) {
    if (item.vcp == null) continue;
    const clave = normalizarNombreFondo(item.fondo);
    const existente = mapa.get(clave);
    if (!existente || (item.patrimonio ?? 0) > (existente.patrimonio ?? 0)) {
      mapa.set(clave, item);
    }
  }

  return mapa;
}
