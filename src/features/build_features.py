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
    df["fecha_oc_dt"] = pd.to_datetime(df["fecha_ocurrencia"], errors="coerce")
    fecha_max = df["fecha_oc_dt"].max()
    limite = fecha_max - pd.DateOffset(months=18)
    recent = df[df["fecha_oc_dt"] >= limite]
    for col_key, col_out in [("id_asegurado", "n_siniestros_18m_asegurado"),
                              ("id_vehiculo",  "n_siniestros_18m_vehiculo"),
                              ("id_conductor", "n_siniestros_18m_conductor")]:
        # Filtrar None/NaN antes del groupby para no inflar conteos en Hogar/Salud
        recent_valid = recent[recent[col_key].notna()]
        counts = recent_valid.groupby(col_key).size().rename(col_out)
        df = df.merge(counts, on=col_key, how="left")
        df[col_out] = df[col_out].fillna(0).astype(int)

    # Ratios derivados (básicos)
    log("Calculando ratios derivados...")
    df["ratio_reclamado_suma"] = df["monto_reclamado_usd"] / df["suma_asegurada_usd"].replace(0, np.nan)
    df["ratio_reclamado_prima"] = df["monto_reclamado_usd"] / df["prima_usd"].replace(0, np.nan)
    df["ratio_pagado_reclamado"] = df["monto_pagado_usd"] / df["monto_reclamado_usd"].replace(0, np.nan)
    df["ratio_reclamado_valor"] = df["monto_reclamado_usd"] / df["valor_comercial_usd"].replace(0, np.nan)

    # ===== FEATURES AVANZADAS =====
    log("Calculando features avanzadas (interacciones + agregaciones por entidad)...")

    # 1. Velocidad del reclamo: ratio reclamado / dias_vigencia_usados
    df["dias_vigencia_usados"] = df["dias_desde_inicio_poliza"].clip(lower=1)
    df["velocidad_reclamo"] = df["monto_reclamado_usd"] / df["dias_vigencia_usados"]

    # 2. Edad del vehiculo al momento del siniestro
    fecha_oc = pd.to_datetime(df["fecha_ocurrencia"], errors="coerce")
    df["edad_vehiculo"] = (fecha_oc.dt.year - df["anio_vehiculo"]).fillna(0).clip(lower=0)

    # 3. Es robo: bandera explicita (RF-01 relacionada). Multi-ramo: cubre Vehiculos y Hogar
    df["es_robo"] = df["cobertura"].isin(["Robo", "Robo en domicilio", "Robo de Accesorios"]).astype(int) if "cobertura" in df.columns else 0

    # 4. Es borde de vigencia (señal 1)
    df["es_borde_vigencia"] = (
        (df["dias_desde_inicio_poliza"].clip(lower=0) < 30) |
        (df["dias_desde_fin_poliza"].clip(lower=0) < 30)
    ).astype(int)

    # 5. Es reporte tardio (señal 12)
    df["es_reporte_tardio"] = (df["dias_entre_ocurrencia_reporte"] > 7).astype(int)

    # 6. Documentos faltantes ratio
    df["ratio_docs_no_entregados"] = df["n_no_entregados"] / df["n_docs"].replace(0, np.nan)

    # 7. Has any inconsistencia
    df["tiene_inconsistencia"] = (df["n_inconsistentes"] > 0).astype(int)

    # 8. Tasa historica de fraude por proveedor (LEAVE-ONE-OUT para evitar leakage)
    # Para cada fila: calcula tasa EXCLUYENDO la propia fila
    global_mean = df["etiqueta_fraude_simulada"].mean()
    smoothing = 20

    prov_sum = df.groupby("id_proveedor")["etiqueta_fraude_simulada"].transform("sum")
    prov_count = df.groupby("id_proveedor")["etiqueta_fraude_simulada"].transform("count")
    # Leave-one-out: restar la fila actual
    prov_sum_loo = prov_sum - df["etiqueta_fraude_simulada"]
    prov_count_loo = prov_count - 1
    df["tasa_fraude_prov"] = (
        (prov_sum_loo + global_mean * smoothing) /
        (prov_count_loo + smoothing).clip(lower=1)
    )

    # 9. Tasa historica de fraude por asegurado (LEAVE-ONE-OUT)
    ase_sum = df.groupby("id_asegurado")["etiqueta_fraude_simulada"].transform("sum")
    ase_count = df.groupby("id_asegurado")["etiqueta_fraude_simulada"].transform("count")
    ase_sum_loo = ase_sum - df["etiqueta_fraude_simulada"]
    ase_count_loo = ase_count - 1
    df["tasa_fraude_ase"] = (
        (ase_sum_loo + global_mean * smoothing) /
        (ase_count_loo + smoothing).clip(lower=1)
    )

    # 10. Velocidad acumulacion reclamos: siniestros 18m / antiguedad asegurado
    df["velocidad_siniestros_asegurado"] = (
        df["n_siniestros_18m_asegurado"] / (df["antiguedad_anios"] + 1).clip(lower=1)
    )

    # 11. Monto vs promedio del proveedor
    df["ratio_monto_vs_prov_promedio"] = (
        df["monto_reclamado_usd"] / df["monto_promedio_reclamado_usd"].replace(0, np.nan)
    )

    # 12. Es PTxRB candidate (cobertura Robo o Robo domicilio + monto>95% suma)
    df["es_ptxrb_candidato"] = (
        df["cobertura"].isin(["Robo", "Robo en domicilio"]) &
        (df["ratio_reclamado_suma"] > 0.95)
    ).astype(int) if "cobertura" in df.columns else 0

    # Rellenar NaN de todas las nuevas
    new_features = [
        "ratio_reclamado_suma", "ratio_reclamado_prima", "ratio_pagado_reclamado",
        "ratio_reclamado_valor", "velocidad_reclamo", "edad_vehiculo",
        "es_robo", "es_borde_vigencia", "es_reporte_tardio",
        "ratio_docs_no_entregados", "tiene_inconsistencia",
        "tasa_fraude_prov", "tasa_fraude_ase",
        "velocidad_siniestros_asegurado", "ratio_monto_vs_prov_promedio",
        "es_ptxrb_candidato",
    ]
    df[new_features] = df[new_features].fillna(0).replace([np.inf, -np.inf], 0)

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
