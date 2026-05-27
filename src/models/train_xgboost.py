"""Entrenamiento XGBoost para deteccion de fraude.

Disenado para correr local (modo dev) o como Azure ML job:
- Local: lee data/processed/features.parquet, guarda modelo en data/processed/model_xgb.json
- Azure ML: usa MLflow autolog para registrar metricas, params y el artefacto.

Metricas reportadas: F1, Precision, Recall, AUC-ROC, PR-AUC, matriz confusion.
SHAP top-features se calcula al final.

Uso:
    python src/models/train_xgboost.py
    python src/models/train_xgboost.py --data data/processed/features.parquet --out runs/local
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

# MLflow autolog si esta disponible (en Azure ML lo usa automaticamente)
try:
    import mlflow
    mlflow.xgboost.autolog()
    MLFLOW = True
except ImportError:
    MLFLOW = False

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = ROOT / "data" / "processed" / "features.parquet"


def log(msg: str) -> None:
    print(f"[train] {msg}")


def train(data_path: Path, out_dir: Path) -> dict:
    log(f"Cargando {data_path}...")
    df = pd.read_parquet(data_path)

    # Quitar columnas que no son features (id_siniestro, caso_inyectado)
    drop_cols = [c for c in ["id_siniestro", "caso_inyectado"] if c in df.columns]
    if drop_cols:
        ids_df = df[drop_cols].copy()
        df = df.drop(columns=drop_cols)
    else:
        ids_df = None

    y = df["etiqueta_fraude_simulada"]
    X = df.drop(columns=["etiqueta_fraude_simulada"])
    log(f"X: {X.shape}, y: {y.shape}, positivos: {y.sum()} ({y.mean()*100:.2f}%)")

    # Split estratificado 80/20
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=42
    )

    # scale_pos_weight para compensar desbalanceo
    pos = (y_train == 1).sum()
    neg = (y_train == 0).sum()
    scale_pos_weight = neg / pos if pos else 1.0
    log(f"scale_pos_weight = {scale_pos_weight:.2f} (neg={neg}, pos={pos})")

    log("Entrenando XGBoost...")
    model = xgb.XGBClassifier(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=scale_pos_weight,
        objective="binary:logistic",
        eval_metric="aucpr",
        random_state=42,
        n_jobs=-1,
        tree_method="hist",
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    # Predicciones y metricas
    y_proba = model.predict_proba(X_test)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)

    metricas = {
        "n_train": int(len(y_train)),
        "n_test": int(len(y_test)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc_roc": float(roc_auc_score(y_test, y_proba)),
        "pr_auc": float(average_precision_score(y_test, y_proba)),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "scale_pos_weight": float(scale_pos_weight),
        "n_features": int(X.shape[1]),
    }

    log("\n=== METRICAS EN TEST ===")
    for k, v in metricas.items():
        if isinstance(v, (int, float)):
            print(f"  {k:<20} {v:.4f}" if isinstance(v, float) else f"  {k:<20} {v}")
        else:
            print(f"  {k:<20} {v}")

    print("\n--- classification_report ---")
    print(classification_report(y_test, y_pred, digits=4, zero_division=0))

    # Top 15 features por importancia
    importancias = pd.Series(model.feature_importances_, index=X.columns).sort_values(ascending=False)
    metricas["top_15_features"] = importancias.head(15).to_dict()
    print("\n--- top 15 features (importance) ---")
    print(importancias.head(15).to_string())

    # Validacion sobre casos inyectados (deben dar prob > 0.5)
    if ids_df is not None and "caso_inyectado" in ids_df.columns:
        idx_inj = ids_df["caso_inyectado"].astype(bool)
        if idx_inj.any():
            X_inj = X.loc[idx_inj.values]
            proba_inj = model.predict_proba(X_inj)[:, 1]
            log(f"\nProb media sobre casos inyectados (deberia ser alta): {proba_inj.mean():.3f}")
            log(f"  min={proba_inj.min():.3f}, max={proba_inj.max():.3f}")
            log(f"  % >=0.5: {(proba_inj >= 0.5).mean() * 100:.1f}%")
            metricas["prob_media_inyectados"] = float(proba_inj.mean())

    # Guardar artefactos
    out_dir.mkdir(parents=True, exist_ok=True)
    model_path = out_dir / "model_xgb.json"
    log(f"\nGuardando modelo en {model_path}...")
    model.save_model(str(model_path))

    feat_cols_path = out_dir / "feature_columns.json"
    json.dump(list(X.columns), open(feat_cols_path, "w"), indent=2)
    log(f"Columnas guardadas en {feat_cols_path}")

    metrics_path = out_dir / "metrics.json"
    json.dump(metricas, open(metrics_path, "w"), indent=2)
    log(f"Metricas guardadas en {metrics_path}")

    # joblib del modelo (mas portable para endpoint)
    joblib.dump(model, out_dir / "model_xgb.pkl")

    # Log a MLflow (Azure ML)
    if MLFLOW:
        for k, v in metricas.items():
            if isinstance(v, (int, float)):
                mlflow.log_metric(k, v)
        mlflow.log_artifact(str(model_path))

    return metricas


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--data", type=Path, default=DEFAULT_DATA)
    p.add_argument("--out", type=Path, default=ROOT / "runs" / "local")
    args = p.parse_args()
    train(args.data, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
