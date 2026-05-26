#!/usr/bin/env python3
"""
scripts/ingest-cafci.py

Descarga la Planilla Diaria de CAFCI (XLSX público) y genera
src/data/cafci-planilla.json con los datos estructurales y de rendimientos
de cada fondo.

Uso:
    python3 scripts/ingest-cafci.py

Fuente:
    https://api.pub.cafci.org.ar/pb_get
    Actualizado diariamente. CORS abierto. Sin autenticación.

Qué datos provee:
    Estructurales:
      - sociedad_gerente, sociedad_depositaria
      - codigo_cnv, codigo_cafci
      - tipo_fondo, moneda, horizonte
      - comision_ingreso, honorarios_adm_sg, comision_rescate
      - plazo_liquidacion, minimo_inversion

    Rendimientos (pre-calculados por CAFCI):
      - rendimiento_diario:  variación % vs el día hábil anterior (col H)
      - rendimiento_mensual: rend. desde el último fin de mes (col J)
                             ⚠ NO son 30 días exactos — es desde el 31/mes_anterior
      - rendimiento_ytd:     rend. desde el 31/12 del año anterior (col K)
      - rendimiento_anual:   rend. desde ~12 meses calendario atrás (col L)
                             ⚠ No son 365 días exactos — es desde fin del mismo mes del año anterior

    Fechas de referencia (del encabezado del XLSX):
      - rend_ref_mensual, rend_ref_ytd, rend_ref_anual (YYYY-MM-DD)

    Períodos NO disponibles en la planilla:
      - semanal (7 días): requiere snapshots propios de ≥7 días (public/historial/)
      - trimestral (90 días): requiere snapshots propios de ≥90 días
"""

import io
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

# ─── Config ──────────────────────────────────────────────────────────────────

CAFCI_URL = "https://api.pub.cafci.org.ar/pb_get"
OUTPUT_PATH = Path(__file__).parent.parent / "src" / "data" / "cafci-planilla.json"

# ─── Mapeos de sección → tipo_fondo y moneda ─────────────────────────────────

SECCION_TIPO = {
    "renta variable": "Renta Variable",
    "renta fija": "Renta Fija",
    "renta mixta": "Renta Mixta",
    "mercado de dinero": "Money Market",
    "infraestructura": "Infraestructura",
    "fondos cerrados": "Cerrado",
    "retorno total": "Renta Mixta",
    "asg": "Renta Variable",
    "pymes": "Renta Fija",
    "rg900": "Renta Fija",
}

SECCION_MONEDA = {
    "peso argentina": "ARS",
    "dolar estadounidense billete": "USD",
    "dolar estadounidense": "USD",
}

HORIZONTE_MAP = {
    "cor": "corto",
    "med": "medio",
    "lar": "largo",
    "flex": "flexible",
    "pla": "PLA",
}

# ─── Índices de columnas en la planilla (fila de datos, base 0) ──────────────
# Las letras corresponden a las columnas del XLSX (A=0, B=1, ...).
# Row 8 contiene los headers de grupo; row 9 los sub-headers con fechas.
# Los datos de fondo empiezan en row 12 (después de secciones de tipo).

COL_NOMBRE         = 0   # A — Nombre del fondo
COL_MONEDA_DATO    = 1   # B — "ARS" / "USD" tal como aparece en cada fila
COL_HORIZONTE_DATO = 3   # D — "Cor", "Med", "Lar", "Flex", etc.
COL_FECHA          = 4   # E — Fecha del VCP actual
COL_VCP_ACTUAL     = 5   # F — Valor cuotaparte actual

# Rendimientos pre-calculados por CAFCI (col H, J, K, L)
COL_VARIACION_DIARIA = 7   # H — Variac. % vs día hábil anterior
COL_REND_MENSUAL     = 9   # J — Rend. desde último fin de mes (fecha en row 9)
COL_REND_YTD         = 10  # K — Rend. YTD desde 31/12 año anterior (fecha en row 9)
COL_REND_ANUAL       = 11  # L — Rend. ~12 meses calendario (fecha en row 9)

COL_DEPOSITARIA    = 17  # R
COL_CODIGO_CNV     = 18  # S
COL_CALIFICACION   = 19  # T
COL_CODIGO_CAFCI   = 20  # U
COL_GERENTE        = 23  # X
COL_COM_INGRESO    = 29  # AD
COL_HON_ADM_SG     = 30  # AE
COL_HON_ADM_SD     = 31  # AF
COL_COM_RESCATE    = 33  # AH
COL_MONEDA_FONDO   = 36  # AK
COL_PLAZO_LIQ      = 37  # AL
COL_MIN_INVERSION  = 43  # AR


# ─── Helpers ─────────────────────────────────────────────────────────────────

def parse_section(titulo: str):
    """
    Extrae tipo_fondo y moneda de un título de sección.
    Ej: "Renta Fija Dolar Estadounidense" → ("Renta Fija", "USD")
    """
    t = titulo.lower().strip()
    tipo = None
    moneda = None

    for key, val in SECCION_TIPO.items():
        if t.startswith(key):
            tipo = val
            resto = t[len(key):].strip()
            for mkey, mval in SECCION_MONEDA.items():
                if mkey in resto:
                    moneda = mval
                    break
            if moneda is None:
                moneda = "ARS"  # default si no aparece moneda en la sección
            break

    return tipo, moneda


def to_float(val: str):
    """Convierte string a float, None si vacío o inválido."""
    if not val or val.strip() == "":
        return None
    try:
        return float(val.replace(",", "."))
    except ValueError:
        return None


def get_cell_value(cell, ns: dict) -> str:
    """Extrae el valor de texto de una celda XLSX (inline str o numérica)."""
    is_node = cell.find("ns:is/ns:t", ns)
    if is_node is not None:
        return is_node.text or ""
    v_node = cell.find("ns:v", ns)
    if v_node is not None:
        return v_node.text or ""
    return ""


def parse_row(row, ns: dict) -> list[str]:
    """Devuelve lista de valores de celda para una fila."""
    return [get_cell_value(c, ns) for c in row.findall("ns:c", ns)]


def parse_date_dmy(s: str):
    """
    Convierte 'DD/MM/YY' o 'DD/MM/YYYY' a 'YYYY-MM-DD'.
    Retorna None si el formato no es reconocible.
    """
    if not s:
        return None
    parts = s.replace("-", "/").split("/")
    if len(parts) != 3:
        return None
    d, m, y = parts
    if len(y) == 2:
        y = "20" + y
    try:
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    except ValueError:
        return None


def is_rendimientos_subheader(cells: list[str]) -> bool:
    """
    Row 9 del XLSX: sub-header con "Moneda" en col B y las fechas de referencia
    de rendimientos en cols J, K, L. Usamos esta fila para capturar las fechas base.
    """
    return (
        len(cells) > 9
        and cells[COL_MONEDA_DATO].strip() == "Moneda"
        and cells[COL_VCP_ACTUAL].strip() == "Actual"
    )


def is_section_header(cells: list[str]) -> bool:
    """
    Una fila es cabecera de sección si tiene contenido sólo en la columna 0
    y las primeras 4 columnas de datos (moneda, región, horizonte, fecha) están vacías.
    """
    if not cells or not cells[0].strip():
        return False
    # Celdas 1..4 deben estar vacías
    data_cols = cells[1:5] if len(cells) >= 5 else cells[1:]
    return all(c.strip() == "" for c in data_cols)


def is_data_row(cells: list[str]) -> bool:
    """Una fila de datos tiene nombre en col 0 y moneda en col 1 ("ARS" / "USD")."""
    if len(cells) < 2:
        return False
    nombre = cells[0].strip()
    moneda = cells[1].strip() if len(cells) > 1 else ""
    return bool(nombre) and moneda in ("ARS", "USD")


# ─── Descarga ─────────────────────────────────────────────────────────────────

def download_xlsx(url: str) -> bytes:
    print(f"[ingest-cafci] Descargando planilla desde {url} ...")
    req = urllib.request.Request(url, headers={"User-Agent": "fondos-cnv-ingest/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    print(f"[ingest-cafci] Descargado: {len(data):,} bytes")
    return data


# ─── Parsing ─────────────────────────────────────────────────────────────────

def parse_planilla(xlsx_bytes: bytes) -> dict:
    ns = {"ns": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    fondos: dict[str, dict] = {}
    fecha_planilla: str | None = None

    with zipfile.ZipFile(io.BytesIO(xlsx_bytes)) as z:
        ws = ET.parse(z.open("xl/worksheets/sheet1.xml"))
        rows = ws.findall(".//ns:row", ns)

    tipo_actual = None
    rend_ref_mensual: str | None = None
    rend_ref_ytd:     str | None = None
    rend_ref_anual:   str | None = None

    for row in rows:
        cells = parse_row(row, ns)
        if not cells:
            continue

        # Sub-header de rendimientos (row 9): captura las fechas de referencia
        if is_rendimientos_subheader(cells):
            while len(cells) <= COL_REND_ANUAL:
                cells.append("")
            rend_ref_mensual = parse_date_dmy(cells[COL_REND_MENSUAL].strip())
            rend_ref_ytd     = parse_date_dmy(cells[COL_REND_YTD].strip())
            rend_ref_anual   = parse_date_dmy(cells[COL_REND_ANUAL].strip())
            continue

        # Cabecera de sección
        if is_section_header(cells):
            titulo = cells[0].strip()
            tipo, _ = parse_section(titulo)
            if tipo:
                tipo_actual = tipo
            continue

        # Fila de datos de fondo
        if not is_data_row(cells):
            continue

        # Padding por si hay pocas columnas
        while len(cells) <= max(COL_MIN_INVERSION, COL_PLAZO_LIQ, COL_GERENTE):
            cells.append("")

        nombre = cells[COL_NOMBRE].strip()
        moneda_fila = cells[COL_MONEDA_DATO].strip()  # "ARS" / "USD"
        horizonte_raw = cells[COL_HORIZONTE_DATO].strip().lower()
        fecha_fila = cells[COL_FECHA].strip()
        codigo_cnv = cells[COL_CODIGO_CNV].strip()
        codigo_cafci = cells[COL_CODIGO_CAFCI].strip()
        gerente = cells[COL_GERENTE].strip()
        depositaria = cells[COL_DEPOSITARIA].strip()
        calificacion = cells[COL_CALIFICACION].strip()
        moneda_fondo = cells[COL_MONEDA_FONDO].strip() or moneda_fila

        # Fecha del VCP: primera fecha real encontrada → fecha de la planilla
        if fecha_planilla is None and fecha_fila:
            fecha_planilla = parse_date_dmy(fecha_fila)

        # VCP de la planilla (para referencia, no para reemplazar ArgentinaDatos)
        vcp_raw = to_float(cells[COL_VCP_ACTUAL])

        # Rendimientos pre-calculados por CAFCI
        # ⚠ mensual = desde fin de mes anterior (no 30 días exactos)
        # ⚠ anual   = desde ~12 meses calendario (no 365 días exactos)
        # ⚠ semanal y trimestral NO están en la planilla
        rend_diario  = to_float(cells[COL_VARIACION_DIARIA])
        rend_mensual = to_float(cells[COL_REND_MENSUAL])
        rend_ytd     = to_float(cells[COL_REND_YTD])
        rend_anual   = to_float(cells[COL_REND_ANUAL])

        # Comisiones
        com_ingreso = to_float(cells[COL_COM_INGRESO])
        hon_adm_sg = to_float(cells[COL_HON_ADM_SG])
        hon_adm_sd = to_float(cells[COL_HON_ADM_SD])
        com_rescate = to_float(cells[COL_COM_RESCATE])
        plazo_liq = cells[COL_PLAZO_LIQ].strip() or None
        min_inversion = to_float(cells[COL_MIN_INVERSION])

        fondos[nombre] = {
            "nombre": nombre,
            "tipo_fondo": tipo_actual,
            "moneda": moneda_fondo,
            "sociedad_gerente": gerente,
            "sociedad_depositaria": depositaria,
            "codigo_cnv": codigo_cnv or None,
            "codigo_cafci": codigo_cafci or None,
            "calificacion": calificacion or None,
            "horizonte": HORIZONTE_MAP.get(horizonte_raw, horizonte_raw) if horizonte_raw else None,
            "vcp_planilla": vcp_raw,
            "rendimiento_diario":  rend_diario,
            "rendimiento_mensual": rend_mensual,
            "rendimiento_ytd":     rend_ytd,
            "rendimiento_anual":   rend_anual,
            "comision_ingreso": com_ingreso,
            "honorarios_adm_sg": hon_adm_sg,
            "honorarios_adm_sd": hon_adm_sd,
            "comision_rescate": com_rescate,
            "plazo_liquidacion": plazo_liq,
            "minimo_inversion": min_inversion,
        }

    return {
        "fecha": fecha_planilla,
        # Fechas de referencia para interpretar los rendimientos
        # Varían cada día: mensual cambia al inicio de cada mes,
        # ytd cambia el 1/1, anual se desplaza mes a mes.
        "rend_ref_mensual": rend_ref_mensual,
        "rend_ref_ytd":     rend_ref_ytd,
        "rend_ref_anual":   rend_ref_anual,
        "total": len(fondos),
        "fondos": fondos,
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    try:
        xlsx_bytes = download_xlsx(CAFCI_URL)
    except Exception as e:
        print(f"[ingest-cafci] ❌ Error al descargar: {e}", file=sys.stderr)
        sys.exit(1)

    print("[ingest-cafci] Parseando planilla ...")
    data = parse_planilla(xlsx_bytes)

    print(f"[ingest-cafci] ✅ {data['total']} fondos extraídos (fecha: {data['fecha']})")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[ingest-cafci] Guardado en {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
