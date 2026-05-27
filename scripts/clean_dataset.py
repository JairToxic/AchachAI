"""
clean_dataset.py — Limpieza del CSV crudo del dataset sintetico.

Lee:   data/raw/Car_Insurance_Fraud_Detection_Dataset.csv  (Latin-1, ;)
Escribe: data/processed/siniestros_clean.csv                 (UTF-8, ,)

Hace:
  1. Arregla encoding Latin-1 -> UTF-8 (resuelve "Veh�culos" -> "Vehiculos").
  2. Normaliza booleanos Si/No -> True/False.
  3. Parsea fechas D/M/YYYY -> ISO YYYY-MM-DD.
  4. Reescala 7 columnas de monto a rangos realistas para Ecuador (vehiculos).
  5. Aplica sanity checks (pagado <= reclamado, reclamado <= suma_asegurada * 1.05).
  6. Reporta stats antes y despues.

Uso:
    python scripts/clean_dataset.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
# Si existe el dataset extendido (con +10K filas diversas), usarlo. Sino, el original.
_EXTENDED = ROOT / "data" / "raw" / "Car_Insurance_Fraud_Detection_Dataset_extended.csv"
_ORIG = ROOT / "data" / "raw" / "Car_Insurance_Fraud_Detection_Dataset.csv"
RAW_PATH = _EXTENDED if _EXTENDED.exists() else _ORIG
OUT_PATH = ROOT / "data" / "processed" / "siniestros_clean.csv"

# Rangos realistas Ecuador para seguros vehiculares (USD)
# (mediana_objetivo, minimo_clipping, maximo_clipping)
TARGET_RANGES = {
    "monto_reclamado_usd":            (5_000,    300,    30_000),
    "monto_estimado_usd":             (5_500,    300,    35_000),
    "monto_pagado_usd":               (4_500,      0,    30_000),
    "prima_usd":                      (  500,    150,     3_000),
    "suma_asegurada_usd":             (15_000,  5_000,    60_000),
    "deducible_usd":                  (  400,    100,     1_500),
    "valor_comercial_usd":            (15_000,  4_000,    80_000),
    "monto_promedio_reclamado_usd":   (5_000,    500,    25_000),
}

BOOL_COLS = ["documentos_completos", "tuvo_parte_policial", "tuvo_testigo",
             "mora_actual", "lista_restrictiva"]

DATE_COLS = ["fecha_ocurrencia", "fecha_reporte", "fecha_inicio", "fecha_fin"]


def log(msg: str) -> None:
    print(f"[clean] {msg}")


def assert_utf8_safe(df: pd.DataFrame) -> None:
    """Verifica que ninguna columna de texto tenga el caracter de reemplazo U+FFFD.

    El archivo crudo es ISO-8859-1 puro: leerlo con encoding='latin-1' produce
    strings con los codepoints correctos (e.g. 0xED = 'i' con acento). Al guardar
    con encoding='utf-8' los bytes salen bien (\\xc3\\xad). No hace falta replace.
    """
    bad_cols = []
    for col in df.select_dtypes(include="object").columns:
        if df[col].astype(str).str.contains("�", regex=False).any():
            bad_cols.append(col)
    if bad_cols:
        log(f"WARN: columnas con char U+FFFD residual: {bad_cols}")


def parse_si_no(value) -> bool | None:
    if pd.isna(value):
        return None
    s = str(value).strip().lower()
    if s in {"si", "sí", "s", "true", "1", "yes"}:
        return True
    if s in {"no", "n", "false", "0"}:
        return False
    return None


def parse_date_dmy(value) -> str | None:
    """Parsea D/M/YYYY -> YYYY-MM-DD. Devuelve None si invalido."""
    if pd.isna(value) or str(value).strip() == "":
        return None
    try:
        dt = pd.to_datetime(str(value).strip(), format="%d/%m/%Y", errors="raise")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        try:
            dt = pd.to_datetime(str(value).strip(), dayfirst=True, errors="raise")
            return dt.strftime("%Y-%m-%d")
        except Exception:
            return None


def rescale_monto(series: pd.Series, target_median: float,
                  min_clip: float, max_clip: float) -> pd.Series:
    """Escala lineal por mediana + clipping a rango realista."""
    s = pd.to_numeric(series, errors="coerce")
    current_median = s.median()
    if current_median <= 0 or pd.isna(current_median):
        return s.fillna(target_median).clip(min_clip, max_clip).round(2)
    factor = target_median / current_median
    rescaled = (s * factor).round(2)
    return rescaled.clip(lower=min_clip, upper=max_clip).fillna(target_median)


def apply_sanity_checks(df: pd.DataFrame) -> pd.DataFrame:
    """Corrige inconsistencias logicas. ORDEN IMPORTA:
    primero ajustamos reclamado contra suma_asegurada, luego pagado contra reclamado.
    """
    # 1. monto_reclamado_usd no puede superar 1.1x la suma asegurada
    over_claimed = df["monto_reclamado_usd"] > df["suma_asegurada_usd"] * 1.1
    df.loc[over_claimed, "monto_reclamado_usd"] = (
        df.loc[over_claimed, "suma_asegurada_usd"] * 1.05
    ).round(2)

    # 2. monto_estimado_usd cerca de reclamado (entre 0.5x y 1.2x)
    df["monto_estimado_usd"] = df["monto_estimado_usd"].clip(
        lower=df["monto_reclamado_usd"] * 0.5,
        upper=df["monto_reclamado_usd"] * 1.2,
    ).round(2)

    # 3. monto_pagado_usd no puede ser mayor a monto_reclamado_usd (ya ajustado)
    over_paid = df["monto_pagado_usd"] > df["monto_reclamado_usd"]
    df.loc[over_paid, "monto_pagado_usd"] = df.loc[over_paid, "monto_reclamado_usd"]

    # 4. monto_pagado_usd >= 0 (negativos imposibles)
    df["monto_pagado_usd"] = df["monto_pagado_usd"].clip(lower=0).round(2)

    # 5. Si estado in {Reserva, Negativa, Cierre Sin Consecuencia} -> pagado = 0
    no_pay_states = ["Reserva", "Negativa", "Cierre Sin Consecuencia"]
    df.loc[df["estado"].isin(no_pay_states), "monto_pagado_usd"] = 0

    # 6. deducible no puede superar 10% de la suma_asegurada
    over_deduc = df["deducible_usd"] > df["suma_asegurada_usd"] * 0.1
    df.loc[over_deduc, "deducible_usd"] = (
        df.loc[over_deduc, "suma_asegurada_usd"] * 0.05
    ).round(2)

    # Asercion final: nada inconsistente
    assert (df["monto_pagado_usd"] <= df["monto_reclamado_usd"] + 0.01).all(), \
        "Hay filas donde pagado > reclamado despues del sanity check"
    assert (df["monto_reclamado_usd"] <= df["suma_asegurada_usd"] * 1.1 + 0.01).all(), \
        "Hay filas donde reclamado > 1.1x suma_asegurada"

    return df


def report_stats(df_before: pd.DataFrame, df_after: pd.DataFrame) -> None:
    print("\n" + "=" * 72)
    print("REPORTE DE LIMPIEZA")
    print("=" * 72)
    print(f"Filas: {len(df_before)} -> {len(df_after)}")
    print(f"Columnas: {len(df_before.columns)} -> {len(df_after.columns)}")
    print("\n--- Montos (antes -> despues) ---")
    for col in TARGET_RANGES.keys():
        if col not in df_before.columns:
            continue
        b = pd.to_numeric(df_before[col], errors="coerce")
        a = df_after[col]
        print(
            f"{col:<35} "
            f"min={b.min():>12,.0f} -> {a.min():>9,.0f}  "
            f"median={b.median():>12,.0f} -> {a.median():>9,.0f}  "
            f"max={b.max():>14,.0f} -> {a.max():>9,.0f}"
        )
    print("\n--- Distribucion de fraude ---")
    if "etiqueta_fraude_simulada" in df_after.columns:
        print(df_after["etiqueta_fraude_simulada"].value_counts().to_string())
    print("\n--- Booleanos convertidos ---")
    for col in BOOL_COLS:
        if col in df_after.columns:
            tipo = df_after[col].dtype
            print(f"  {col:<25} dtype={tipo}  True={df_after[col].sum()}/{df_after[col].count()}")
    print("=" * 72)


def main() -> int:
    if not RAW_PATH.exists():
        log(f"ERROR: no encontre el dataset en {RAW_PATH}")
        return 1

    log(f"Leyendo {RAW_PATH.name} (sep=';')...")
    # El dataset original esta en Latin-1, el extendido (auto-generado) en UTF-8.
    try:
        df = pd.read_csv(RAW_PATH, sep=";", encoding="utf-8", low_memory=False)
        log("  encoding: UTF-8")
    except UnicodeDecodeError:
        df = pd.read_csv(RAW_PATH, sep=";", encoding="latin-1", low_memory=False)
        log("  encoding: Latin-1 (fallback)")
    log(f"Cargadas {len(df):,} filas x {len(df.columns)} columnas.")

    df_before = df.copy()

    # 1. Encoding: verificar que no hay U+FFFD residual (caracter de reemplazo)
    log("Verificando integridad UTF-8 (no debe haber U+FFFD)...")
    assert_utf8_safe(df)

    # 2. Booleanos
    log("Convirtiendo Si/No a booleanos...")
    for col in BOOL_COLS:
        if col in df.columns:
            df[col] = df[col].apply(parse_si_no).astype("boolean")

    # 3. Fechas
    log("Parseando fechas D/M/YYYY -> ISO...")
    for col in DATE_COLS:
        if col in df.columns:
            df[col] = df[col].apply(parse_date_dmy)

    # 4. Reescalado de montos
    log("Reescalando montos a rangos realistas Ecuador...")
    for col, (target_median, min_clip, max_clip) in TARGET_RANGES.items():
        if col in df.columns:
            df[col] = rescale_monto(df[col], target_median, min_clip, max_clip)

    # 5. Sanity checks
    log("Aplicando sanity checks de coherencia (pagado<=reclamado, etc.)...")
    df = apply_sanity_checks(df)

    # 6. Reporte
    report_stats(df_before, df)

    # 7. Guardar
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    log(f"Guardando {OUT_PATH} (UTF-8, sep=',')...")
    df.to_csv(OUT_PATH, index=False, encoding="utf-8")
    log(f"OK -> {OUT_PATH}  ({OUT_PATH.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
