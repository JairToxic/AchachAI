"""Entrena IsolationForest sobre el dataset y guarda artefactos a runs/local/.

Salidas:
  runs/local/iforest.pkl              -> modelo sklearn
  runs/local/iforest_scaler.pkl       -> StandardScaler ajustado
  runs/local/iforest_columns.json     -> columnas de X (orden importa)
  runs/local/iforest_meta.json        -> contamination, n_estimators, fecha, n_filas

Uso:
  python scripts/train_iforest.py
  python scripts/train_iforest.py --contamination 0.01 --n-estimators 300
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
OUT = ROOT / "runs" / "local"
OUT.mkdir(parents=True, exist_ok=True)


def build_X(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Construye la matriz X (misma logica que el notebook 04)."""
    num_vars = [
        "monto_reclamado_usd", "monto_pagado_usd",
        "dias_desde_inicio_poliza", "dias_desde_fin_poliza",
        "dias_entre_ocurrencia_reporte", "historial_siniestros_asegurado",
    ]
    bool_cols = ["documentos_completos", "tuvo_parte_policial", "tuvo_testigo"]
    str_cols = ["fault_responsable"]

    Xnum = df[num_vars].fillna(df[num_vars].median())
    Xbool = pd.DataFrame({f"b_{b}": df[b].astype(int) for b in bool_cols})
    Xstr_parts = [pd.get_dummies(df[c], prefix=c).astype(int) for c in str_cols]
    Xstr = pd.concat(Xstr_parts, axis=1) if Xstr_parts else pd.DataFrame()
    Xcob = pd.get_dummies(df["cobertura"], prefix="cob").astype(int)

    X = pd.concat([Xnum, Xbool, Xstr, Xcob], axis=1)
    meta = {
        "num_vars": num_vars,
        "bool_cols": bool_cols,
        "str_cols": str_cols,
        "cobertura_values": sorted(df["cobertura"].dropna().unique().tolist()),
        "fault_values": sorted(df["fault_responsable"].dropna().unique().tolist()),
    }
    return X, meta


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--contamination", type=float, default=0.02)
    ap.add_argument("--n-estimators", type=int, default=200)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    print(f"[1/4] Cargando dataset desde {PROC / 'siniestros.parquet'}…")
    df = pd.read_parquet(PROC / "siniestros.parquet")
    print(f"      {len(df):,} filas")

    print("[2/4] Construyendo features…")
    X, meta = build_X(df)
    print(f"      X shape: {X.shape}")
    print(f"      columnas: {list(X.columns)}")

    print("[3/4] Ajustando StandardScaler + IsolationForest…")
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    iforest = IsolationForest(
        n_estimators=args.n_estimators,
        contamination=args.contamination,
        random_state=args.seed,
        n_jobs=-1,
    ).fit(Xs)
    n_out = int((iforest.predict(Xs) == -1).sum())
    print(f"      outliers detectados: {n_out} ({n_out/len(df)*100:.2f}%)")

    print(f"[4/4] Guardando artefactos en {OUT}…")
    joblib.dump(iforest, OUT / "iforest.pkl")
    joblib.dump(scaler, OUT / "iforest_scaler.pkl")
    (OUT / "iforest_columns.json").write_text(
        json.dumps(list(X.columns), indent=2), encoding="utf-8"
    )
    (OUT / "iforest_meta.json").write_text(
        json.dumps({
            **meta,
            "contamination": args.contamination,
            "n_estimators": args.n_estimators,
            "seed": args.seed,
            "n_filas_train": int(len(df)),
            "n_outliers": n_out,
            "trained_at": datetime.utcnow().isoformat() + "Z",
        }, indent=2),
        encoding="utf-8",
    )
    print("[OK] Listo. El endpoint /anomalias-novedosas usara el modelo cacheado.")


if __name__ == "__main__":
    main()
