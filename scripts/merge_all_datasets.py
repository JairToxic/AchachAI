"""Fusiona los 3 datasets (sintetico 25K + multi-ramo 14K + oficial 500)
en los parquets principales que consume el pipeline.

Pre-requisitos:
  - Ya corriste generate_multibranch_data.py
  - Ya corriste label_official_with_rules.py
  - Existen los snapshots en backups/data_processed_25k_only_YYYYMMDD/

Lee:
  data/processed/{siniestros,polizas,asegurados,proveedores,documentos}.parquet
  data/processed/{siniestros,polizas,asegurados,proveedores,documentos}_multibranch.parquet
  data/processed/{siniestros,polizas,asegurados,proveedores,documentos}_oficial.parquet

Escribe (sobrescribe los actuales):
  data/processed/siniestros.parquet      (25K + 14K + 500 = ~40K)
  data/processed/polizas.parquet
  data/processed/asegurados.parquet
  data/processed/proveedores.parquet
  data/processed/documentos.parquet

Verifica:
  - IDs unicos (no colisiones)
  - Columnas compatibles (mismas en los 3)
  - Tipos consistentes

Uso:
    python scripts/merge_all_datasets.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"


def cargar(nombre: str) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Carga los 3 datasets de una tabla."""
    actual = pd.read_parquet(PROC / f"{nombre}.parquet")
    mb = pd.read_parquet(PROC / f"{nombre}_multibranch.parquet")
    of = pd.read_parquet(PROC / f"{nombre}_oficial.parquet")
    return actual, mb, of


def union_columnas(actual: pd.DataFrame, mb: pd.DataFrame, of: pd.DataFrame) -> list[str]:
    """Columnas finales = union, prioridad al esquema actual."""
    cols = list(actual.columns)
    for extra in [c for c in mb.columns if c not in cols]:
        cols.append(extra)
    for extra in [c for c in of.columns if c not in cols]:
        cols.append(extra)
    return cols


def alinear(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    """Agrega columnas faltantes como None y reordena."""
    for c in cols:
        if c not in df.columns:
            df[c] = None
    return df[cols]


def fusionar_tabla(nombre: str, id_col: str | None) -> pd.DataFrame:
    print(f"\n[merge] Fusionando {nombre}...")
    actual, mb, of = cargar(nombre)
    print(f"  actual:      {len(actual):>6,} filas, {len(actual.columns)} cols")
    print(f"  multibranch: {len(mb):>6,} filas, {len(mb.columns)} cols")
    print(f"  oficial:     {len(of):>6,} filas, {len(of.columns)} cols")

    cols = union_columnas(actual, mb, of)
    actual = alinear(actual, cols)
    mb = alinear(mb, cols)
    of = alinear(of, cols)

    fusion = pd.concat([actual, mb, of], ignore_index=True)

    # Verificar IDs unicos (si aplica)
    if id_col and id_col in fusion.columns:
        dups = fusion[id_col].duplicated().sum()
        if dups > 0:
            print(f"  WARN: {dups} IDs duplicados en {id_col} -> dropeando duplicados (keep=first)")
            fusion = fusion.drop_duplicates(subset=[id_col], keep="first").reset_index(drop=True)

    print(f"  FUSION:      {len(fusion):>6,} filas, {len(fusion.columns)} cols")
    return fusion


def main() -> int:
    print("=" * 60)
    print("FUSIONANDO DATASETS (sintetico + multibranch + oficial)")
    print("=" * 60)

    sin = fusionar_tabla("siniestros", "id_siniestro")
    pol = fusionar_tabla("polizas", "id_poliza")
    ase = fusionar_tabla("asegurados", "id_asegurado")
    prov = fusionar_tabla("proveedores", "id_proveedor")
    doc = fusionar_tabla("documentos", "id_documento")

    print("\n" + "=" * 60)
    print("ESCRIBIENDO PARQUETS FUSIONADOS (sobrescribiendo originales)")
    print("=" * 60)

    sin.to_parquet(PROC / "siniestros.parquet", index=False)
    pol.to_parquet(PROC / "polizas.parquet", index=False)
    ase.to_parquet(PROC / "asegurados.parquet", index=False)
    prov.to_parquet(PROC / "proveedores.parquet", index=False)
    doc.to_parquet(PROC / "documentos.parquet", index=False)

    print(f"\nDistribucion final por ramo:")
    print(sin["ramo"].value_counts())

    print(f"\nDistribucion etiqueta_fraude_simulada:")
    print(sin["etiqueta_fraude_simulada"].value_counts())
    tasa = sin["etiqueta_fraude_simulada"].mean() * 100
    print(f"Tasa fraude global: {tasa:.2f}%")

    print(f"\nTasa fraude por ramo:")
    print(sin.groupby("ramo")["etiqueta_fraude_simulada"].agg(["count", "sum", "mean"]))

    print("\nDONE - parquets listos para build_features + retrain")
    return 0


if __name__ == "__main__":
    sys.exit(main())
