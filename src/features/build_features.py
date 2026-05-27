"""Construccion de la matriz de features para el modelo XGBoost.

Lee:   data/processed/*.parquet (las 7 tablas)
Escribe: data/processed/features.parquet (matriz numerica + etiqueta)

Features:
- 12 numericas crudas (montos, dias, scores)
- 4 ratios derivados (reclamado/suma, reclamado/prima, pagado/reclamado, reclamado/valor)
- 9 categoricas one-hot (cobertura, estado, segmento, canal, tipo_cobertura,
   tipo_beneficiario, fault_responsable, marca, categoria)
- 5 booleanas (documentos_completos, parte_policial, testigo, mora, lista_restrictiva)
- 3 agregaciones documentales (n_docs, n_no_entregados, n_inconsistentes)
- 3 conteos del Contexto (siniestros_18m por asegurado/vehiculo/conductor)

Total: ~40 features.

Uso:
    python src/features/build_features.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"
OUT = PROC / "features.parquet"

CAT_COLS = [
    "cobertura", "estado", "segmento", "canal_venta", "tipo_cobertura",
    "tipo_beneficiario", "fault_responsable", "marca", "categoria",
]


def log(msg: str) -> None:
    print(f"[features] {msg}")


def build() -> pd.DataFrame:
    log("Cargando tablas...")
    s = pd.read_parquet(PROC / "siniestros.parquet")
    pol = pd.read_parquet(PROC / "polizas.parquet")
    ase = pd.read_parquet(PROC / "asegurados.parquet")
    veh = pd.read_parquet(PROC / "vehiculos.parquet")
    prov = pd.read_parquet(PROC / "proveedores.parquet")
    docs = pd.read_parquet(PROC / "documentos.parquet")

    # Joins
    log("Haciendo joins...")
    df = s.copy()
    df = df.merge(pol[["id_poliza", "prima_usd", "suma_asegurada_usd",
                       "deducible_usd", "canal_venta", "tipo_cobertura"]],
                  on="id_poliza", how="left")
    df = df.merge(ase[["id_asegurado", "segmento", "antiguedad_anios",
                       "num_polizas", "reclamos_ultimos_12_meses",
                       "mora_actual", "score_cliente_simulado"]],
                  on="id_asegurado", how="left")
    df = df.merge(veh[["id_vehiculo", "marca", "categoria",
                       "valor_comercial_usd", "anio_vehiculo"]],
                  on="id_vehiculo", how="left")
    df = df.merge(prov[["id_proveedor", "lista_restrictiva",
                        "monto_promedio_reclamado_usd"]],
                  on="id_proveedor", how="left")

    # Agregaciones de documentos
    log("Agregando documentos...")
    doc_agg = docs.groupby("id_siniestro").agg(
        n_docs=("id_documento", "count"),
        n_no_entregados=("entregado", lambda x: (~x).sum()),
        n_inconsistentes=("inconsistencia_detectada", "sum"),
    ).reset_index()
    df = df.merge(doc_agg, on="id_siniestro", how="left")
    for c in ["n_docs", "n_no_entregados", "n_inconsistentes"]:
        df[c] = df[c].fillna(0).astype(int)

    # Conteo siniestros 18m por entidad (precomputado para todo el dataset)
    log("Conteo de siniestros recientes por entidad...")
    df["fecha_oc_dt"] = pd.to_datetime(df["fecha_ocurrencia"])
    fecha_max = df["fecha_oc_dt"].max()
    limite = fecha_max - pd.DateOffset(months=18)
    recent = df[df["fecha_oc_dt"] >= limite]
    for col_key, col_out in [("id_asegurado", "n_siniestros_18m_asegurado"),
                              ("id_vehiculo",  "n_siniestros_18m_vehiculo"),
                              ("id_conductor", "n_siniestros_18m_conductor")]:
        counts = recent.groupby(col_key).size().rename(col_out)
        df = df.merge(counts, on=col_key, how="left")
        df[col_out] = df[col_out].fillna(0).astype(int)

    # Ratios derivados
    log("Calculando ratios derivados...")
    df["ratio_reclamado_suma"] = df["monto_reclamado_usd"] / df["suma_asegurada_usd"].replace(0, np.nan)
    df["ratio_reclamado_prima"] = df["monto_reclamado_usd"] / df["prima_usd"].replace(0, np.nan)
    df["ratio_pagado_reclamado"] = df["monto_pagado_usd"] / df["monto_reclamado_usd"].replace(0, np.nan)
    df["ratio_reclamado_valor"] = df["monto_reclamado_usd"] / df["valor_comercial_usd"].replace(0, np.nan)
    df[["ratio_reclamado_suma", "ratio_reclamado_prima",
        "ratio_pagado_reclamado", "ratio_reclamado_valor"]] = (
        df[["ratio_reclamado_suma", "ratio_reclamado_prima",
            "ratio_pagado_reclamado", "ratio_reclamado_valor"]].fillna(0)
    )

    # One-hot de categoricas (pandas >=2.0 devuelve bool por defecto)
    log("One-hot encoding...")
    df = pd.get_dummies(df, columns=CAT_COLS, drop_first=True, dummy_na=False, dtype=int)

    # Convertir booleanos a int
    log("Convirtiendo booleanos a int...")
    for c in ["documentos_completos", "tuvo_parte_policial", "tuvo_testigo",
              "mora_actual", "lista_restrictiva"]:
        if c in df.columns:
            df[c] = df[c].astype(bool).astype(int)
    # Tambien convertir cualquier bool residual
    for c in df.columns:
        if df[c].dtype == bool:
            df[c] = df[c].astype(int)

    # Quitar columnas no-feature
    drop_cols = [
        "id_siniestro", "id_poliza", "id_asegurado", "id_vehiculo",
        "id_proveedor", "id_conductor", "fecha_ocurrencia", "fecha_reporte",
        "sucursal", "ciudad_evento", "descripcion", "ramo",
        "fecha_oc_dt", "caso_inyectado",
    ]
    keep_ids = df[["id_siniestro", "caso_inyectado"]].copy() if "caso_inyectado" in df.columns else df[["id_siniestro"]].copy()
    feat_df = df.drop(columns=[c for c in drop_cols if c in df.columns])

    # Sanity: solo columnas numericas
    non_num = [c for c in feat_df.columns if not np.issubdtype(feat_df[c].dtype, np.number)]
    if non_num:
        log(f"WARN: dropping columnas no-numericas residuales: {non_num}")
        feat_df = feat_df.drop(columns=non_num)

    # Rellenar nulos residuales con 0 (despues de los joins puede haber)
    feat_df = feat_df.fillna(0)

    # Volver a incluir id para auditoria
    feat_df = pd.concat([keep_ids.reset_index(drop=True), feat_df.reset_index(drop=True)], axis=1)

    return feat_df


def main() -> int:
    df = build()
    log(f"Matriz final: {df.shape[0]:,} filas x {df.shape[1]} columnas")
    log(f"Distribucion etiqueta: {df['etiqueta_fraude_simulada'].value_counts().to_dict()}")
    log(f"Guardando {OUT.name}...")
    df.to_parquet(OUT, index=False)
    log(f"OK -> {OUT}  ({OUT.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
