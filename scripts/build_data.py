#!/usr/bin/env python3
"""
build_data.py — CARDIOMET-LATAM data builder.

Reads two CSVs published from Google Sheets and produces the JSON
files that power the website's dashboards and articles page.

Usage
-----
  python scripts/build_data.py

The script is intentionally defensive:
  * If a download fails, it leaves the existing JSON files untouched.
  * If a required column is missing, it logs the issue and aborts.
  * If parsing succeeds, it writes JSON atomically (.tmp -> rename).

Run locally with `pip install pandas requests`.
In GitHub Actions the deps are installed via the workflow file.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
import requests


# ----------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------
SOCIO_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vSdmChoUQ-5uI2W3a1fSe-9Fec9XV0KLsky77NEfypD22iBPr9OAT2Bado2pCyNFg/pub?output=csv"
)
ARTS_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vQiwSrQA2e8My9qF_dZUNHSJAZ-etIP4IK1pNcY9mAmv5joLe_84rKpDvS_DMWUgg/pub?output=csv"
)

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Subregion definitions — kept in code, not in the Sheet, so editors
# don't need to maintain them by hand.
REGIONS = {
    "Cono Sur":        ["Argentina", "Chile", "Paraguay", "Uruguay"],
    "Andina":          ["Bolivia", "Colombia", "Ecuador", "Perú", "Venezuela"],
    "Brasil":          ["Brasil"],
    "Centroamérica":   ["Belice", "Costa Rica", "El Salvador", "Guatemala",
                        "Honduras", "Nicaragua", "Panamá"],
    "Caribe":          ["Cuba", "Jamaica", "Puerto Rico", "Republica Dominicana"],
    "México":          ["México"],
    "Guayanas":        ["Guyana", "Guayana Francesa", "Suriname"],
}


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def log(msg: str, *, level: str = "info") -> None:
    """Simple logger that GitHub Actions renders nicely."""
    prefix = {"info": "📘", "ok": "✅", "warn": "⚠️ ", "err": "❌"}.get(level, "")
    print(f"{prefix} {msg}", flush=True)


def fetch_csv(url: str, label: str) -> pd.DataFrame:
    """Download a CSV from a URL and return a DataFrame.

    Raises on any failure so the caller can decide what to do.
    """
    log(f"Descargando {label}…")
    r = requests.get(url, timeout=30, allow_redirects=True)
    r.raise_for_status()
    content_type = r.headers.get("content-type", "")
    if "csv" not in content_type and "text/plain" not in content_type:
        # Google sometimes returns text/csv, sometimes text/plain.
        # If we get text/html, the publication is broken.
        if "html" in content_type:
            raise RuntimeError(
                f"{label}: el URL devolvió HTML, no CSV. "
                f"Verifica que el Sheet esté publicado como 'Valores separados por comas'."
            )
    df = pd.read_csv(io.StringIO(r.content.decode("utf-8")))
    if df.empty:
        raise RuntimeError(f"{label}: el CSV descargado está vacío.")
    log(f"  → {len(df):,} filas, {len(df.columns)} columnas", level="ok")
    return df


def write_json(path: Path, payload: Any) -> None:
    """Write JSON atomically: write to .tmp then rename.

    This means a half-written file never replaces the live JSON.
    """
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    tmp.replace(path)
    size_kb = path.stat().st_size / 1024
    log(f"  → {path.relative_to(ROOT)} ({size_kb:,.1f} KB)", level="ok")


def clean_text(x: Any) -> str | None:
    """Trim, strip Excel artifacts, normalize newlines."""
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return None
    s = str(x).strip()
    s = s.replace("_x000D_", "").replace("\\n", "\n")
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"\n\s*\n", "\n\n", s).strip()
    return s or None


# ----------------------------------------------------------------------
# Sociodemográficos
# ----------------------------------------------------------------------
def build_sociodemograficos(df: pd.DataFrame) -> dict:
    """Convert the long-format socio dataframe into the JSON the site uses."""
    log("Procesando sociodemográficos…")

    # Normalize column names (lowercase, no accents, strip)
    df = df.rename(columns=lambda c: str(c).strip())

    # Find the right columns in a robust way
    col_map = {}
    for col in df.columns:
        low = col.lower().strip()
        if low == "pais":
            col_map["pais"] = col
        elif low == "variable":
            col_map["variable"] = col
        elif low == "valor":
            col_map["valor"] = col
        elif low == "valor2":
            col_map["valor2"] = col
        elif low in ("año", "anio", "año "):
            col_map["anio"] = col
        elif low == "fuente":
            col_map["fuente"] = col

    required = ["pais", "variable", "valor"]
    missing = [c for c in required if c not in col_map]
    if missing:
        raise RuntimeError(
            f"Faltan columnas requeridas en Sociodemográficos: {missing}. "
            f"Columnas presentes: {list(df.columns)}"
        )

    df = df.dropna(subset=[col_map["pais"], col_map["variable"]]).reset_index(drop=True)

    def coerce_value(v: Any, v2: Any) -> tuple[float | None, str | None]:
        """Return (numeric_value, text_value)."""
        if pd.notna(v):
            try:
                if isinstance(v, (pd.Timestamp, datetime)):
                    return None, None
                return float(v), None
            except (ValueError, TypeError):
                return None, str(v).strip()
        if v2 is not None and pd.notna(v2):
            s = str(v2).strip()
            if re.match(r"^\d{4}-\d{2}-\d{2}", s):
                return None, None  # accidental date string
            return None, s if s else None
        return None, None

    socio: dict[str, dict] = {}
    for _, row in df.iterrows():
        pais = str(row[col_map["pais"]]).strip()
        var = str(row[col_map["variable"]]).strip().upper()
        v_num, v_txt = coerce_value(
            row[col_map["valor"]],
            row[col_map["valor2"]] if "valor2" in col_map else None,
        )
        anio = None
        if "anio" in col_map:
            try:
                a = row[col_map["anio"]]
                anio = int(a) if pd.notna(a) else None
            except (ValueError, TypeError):
                anio = None
        fuente = clean_text(row[col_map["fuente"]]) if "fuente" in col_map else None

        socio.setdefault(pais, {})[var] = {
            "valor": v_num,
            "texto": v_txt,
            "anio": anio,
            "fuente": fuente,
        }

    socio_long = [
        {"pais": p, "variable": v, **rec}
        for p, vars_ in socio.items()
        for v, rec in vars_.items()
    ]

    payload = {
        "paises": sorted(socio.keys()),
        "variables": sorted({v for c in socio.values() for v in c.keys()}),
        "datos": socio,
        "datos_largos": socio_long,
        "_generado": datetime.utcnow().isoformat() + "Z",
    }
    log(
        f"  → {len(socio)} países, "
        f"{len(payload['variables'])} variables, "
        f"{len(socio_long):,} valores",
        level="ok",
    )
    return payload


# ----------------------------------------------------------------------
# Artículos
# ----------------------------------------------------------------------
def normalize_country(c: Any) -> str | None:
    if c is None or (isinstance(c, float) and pd.isna(c)):
        return None
    s = str(c).strip()
    if not s:
        return None
    if s.lower().startswith("varios"):
        return "Varios países"
    return s


def normalize_outcome(o: Any) -> str | None:
    if o is None or (isinstance(o, float) and pd.isna(o)):
        return None
    s = str(o).strip()
    mapping = {
        "hipertension": "Hipertensión",
        "hipertensión": "Hipertensión",
        "riesgo cardiovascular": "Riesgo cardiovascular",
        "infarto agudo de miorcardio": "Infarto agudo de miocardio",
        "infarto agudo al miocardio": "Infarto agudo de miocardio",
        "enfermedad cardiovascular": "Enfermedad cardiovascular",
    }
    return mapping.get(s.lower(), s)


def normalize_design(d: Any) -> str | None:
    if d is None or (isinstance(d, float) and pd.isna(d)):
        return None
    s = str(d).strip()
    mapping = {
        "revisión sistemática": "Revisión sistemática / metaanálisis",
        "metaanálisis": "Revisión sistemática / metaanálisis",
        "revisión sistemática / metaanálisis": "Revisión sistemática / metaanálisis",
        "revisión literaria": "Revisión literaria",
    }
    return mapping.get(s.lower(), s)


def parse_keywords(kw: Any) -> list[str]:
    if kw is None or (isinstance(kw, float) and pd.isna(kw)):
        return []
    s = str(kw).strip()
    parts = re.split(r"[;,]", s)
    return [p.strip().rstrip(".").strip() for p in parts if p.strip() and len(p.strip()) > 1]


def build_articulos(df: pd.DataFrame) -> tuple[list, list]:
    """Convert articles dataframe into (full_list, compact_list)."""
    log("Procesando artículos…")

    df = df.rename(columns=lambda c: str(c).strip())

    # Build a lowercase->actual column map for flexible matching
    cmap = {c.lower().strip(): c for c in df.columns}

    def get(row, *names):
        for n in names:
            if n.lower() in cmap:
                return row.get(cmap[n.lower()])
        return None

    # Filter: not excluded
    if "excluído" in cmap or "excluido" in cmap:
        col = cmap.get("excluído") or cmap.get("excluido")
        df = df[df[col] == 0]
    df = df.dropna(subset=[cmap.get("país", cmap.get("pais", "PAÍS")),
                            cmap.get("título", cmap.get("titulo", "TÍTULO"))]).reset_index(drop=True)

    articles = []
    for idx, row in df.iterrows():
        rec = {
            "id": int(idx) + 1,
            "libre_acceso": (str(get(row, "libre acceso", "LIBRE ACCESO ", "LIBRE ACCESO") or "NO")
                             .strip().upper() == "SI"),
            "pais": normalize_country(get(row, "país", "pais", "PAÍS")),
            "titulo": clean_text(get(row, "título", "titulo", "TÍTULO")),
            "autores": clean_text(get(row, "autores", "AUTORES")),
            "cita": clean_text(get(row, "cita", "CITA")),
            "doi": clean_text(get(row, "doi", "DOI")),
            "url": clean_text(get(row, "url", "URL")),
            "resumen": clean_text(get(row, "resumen", "RESUMEN")),
            "palabras_clave": parse_keywords(get(row, "palabras clave", "PALABRAS CLAVE")),
            "disenio": normalize_design(get(row, "diseño de estudio", "DISEÑO DE ESTUDIO")),
            "desenlace": normalize_outcome(get(row, "desenlace", "DESENLACE")),
            "factor_riesgo": clean_text(get(row, "factor de riesgo", "FACTOR DE RIESGO")),
            "factor_protector": clean_text(get(row, "factor protector", "FACTOR PROTECTOR ", "FACTOR PROTECTOR")),
        }
        articles.append(rec)

    compact = [{k: v for k, v in a.items() if k != "resumen"} for a in articles]
    log(f"  → {len(articles)} artículos", level="ok")
    return articles, compact


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------
def main() -> int:
    failures = []

    # --- Sociodemográficos ---
    try:
        df_socio = fetch_csv(SOCIO_CSV_URL, "Sociodemográficos")
        socio_payload = build_sociodemograficos(df_socio)
        write_json(DATA_DIR / "sociodemograficos.json", socio_payload)
    except Exception as e:
        log(f"Sociodemográficos: FALLÓ — {e}", level="err")
        log("   El JSON existente NO se modificó.", level="warn")
        failures.append("sociodemograficos")

    # --- Artículos ---
    try:
        df_arts = fetch_csv(ARTS_CSV_URL, "Artículos")
        full, compact = build_articulos(df_arts)
        write_json(DATA_DIR / "articulos.json", full)
        write_json(DATA_DIR / "articulos_compact.json", compact)
    except Exception as e:
        log(f"Artículos: FALLÓ — {e}", level="err")
        log("   El JSON existente NO se modificó.", level="warn")
        failures.append("articulos")

    # --- Regiones (always rebuild from code constant) ---
    try:
        write_json(DATA_DIR / "regiones.json", REGIONS)
    except Exception as e:
        log(f"Regiones: FALLÓ — {e}", level="err")
        failures.append("regiones")

    # --- Summary ---
    if failures:
        log(f"Hubo errores en: {', '.join(failures)}.", level="warn")
        return 1
    log("Build completo. Todos los archivos JSON fueron actualizados.", level="ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
