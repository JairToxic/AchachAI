"""Entrenamiento FINAL con los best hyperparams de Optuna + threshold tuning.

Carga: data/processed/features.parquet
       runs/local/best_hyperparams.json
Output: runs/local/model_xgb.* + metricas finales + threshold optimo
"""
from __future__ import annotations

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
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
FEATURES = ROOT / "data" / "processed" / "features.parquet"
BEST = ROOT / "runs" / "local" / "best_hyperparams.json"
OUT_DIR = ROOT / "runs" / "local"


def log(msg: str) -> None:
    print(f"[final] {msg}", flush=True)


def main() -> int:
    df = pd.read_parquet(FEATURES)
    drop = [c for c in ["id_siniestro", "caso_inyectado"] if c in df.columns]
    ids_df = df[drop].copy() if drop else None
    if drop:
        df = df.drop(columns=drop)

    y = df["etiqueta_fraude_simulada"]
    X = df.drop(columns=["etiqueta_fraude_simulada"])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=42
    )

    # Cargar best params de Optuna
    if not BEST.exists():
        log(f"WARN: {BEST} no existe, usando defaults")
        params = {"n_estimators": 400, "max_depth": 6, "learning_rate": 0.05}
    else:
        cfg = json.load(open(BEST))
        params = cfg["params"]
        log(f"Cargados best params (PR-AUC busqueda: {cfg['best_pr_auc']:.4f})")
        for k, v in params.items():
            print(f"  {k}: {v}")

    scale_pos_weight = (y_train == 0).sum() / max(1, (y_train == 1).sum())
    params.update({
        "scale_pos_weight": scale_pos_weight,
        "objective": "binary:logistic",
        "eval_metric": "aucpr",
        "random_state": 42,
        "n_jobs": -1,
        "tree_method": "hist",
    })

    log("\nEntrenando modelo final...")
    model = xgb.XGBClassifier(**params)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_proba = model.predict_proba(X_test)[:, 1]

    # ===== THRESHOLD TUNING =====
    log("\nBuscando threshold optimo (maximiza F1)...")
    prec, rec, thresholds = precision_recall_curve(y_test, y_proba)
    f1_scores = 2 * (prec * rec) / (prec + rec + 1e-10)
    best_idx = np.argmax(f1_scores[:-1])  # ultimo no tiene threshold
    best_thr = float(thresholds[best_idx])
    log(f"  threshold optimo: {best_thr:.3f}")
    log(f"  con F1 maximo: {f1_scores[best_idx]:.4f}")

    # Reportar tres thresholds: 0.5 (default), best_f1, 0.3 (recall-priority)
    log("\n=== METRICAS POR THRESHOLD ===")
    metricas_por_thr = {}
    for thr_name, thr in [("default_0.5", 0.5), ("best_f1", best_thr), ("recall_0.3", 0.3)]:
        y_pred = (y_proba >= thr).astype(int)
        m = {
            "threshold": float(thr),
            "precision": float(precision_score(y_test, y_pred, zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, zero_division=0)),
            "f1": float(f1_score(y_test, y_pred, zero_division=0)),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        }
        metricas_por_thr[thr_name] = m
        print(f"\n[{thr_name} = {thr:.2f}]")
        print(f"  precision: {m['precision']:.4f}")
        print(f"  recall:    {m['recall']:.4f}")
        print(f"  f1:        {m['f1']:.4f}")
        print(f"  confusion: {m['confusion_matrix']}")

    # Globales (no dependen de threshold)
    auc_roc = float(roc_auc_score(y_test, y_proba))
    pr_auc = float(average_precision_score(y_test, y_proba))
    log(f"\n=== METRICAS GLOBALES ===")
    log(f"  AUC-ROC: {auc_roc:.4f}")
    log(f"  PR-AUC:  {pr_auc:.4f}")
    log(f"  n_features: {X.shape[1]}")

    # Feature importance
    importances = pd.Series(model.feature_importances_, index=X.columns).sort_values(ascending=False)
    log("\n--- top 15 features ---")
    print(importances.head(15).to_string())

    # Validacion sobre casos inyectados
    if ids_df is not None and "caso_inyectado" in ids_df.columns:
        idx_inj = ids_df["caso_inyectado"].astype(bool)
        X_inj = X.loc[idx_inj.values]
        proba_inj = model.predict_proba(X_inj)[:, 1]
        log(f"\nCasos inyectados: prob media = {proba_inj.mean():.3f}")
        log(f"  % con prob >= 0.5: {(proba_inj >= 0.5).mean()*100:.1f}%")

    # Guardar
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    model.save_model(OUT_DIR / "model_xgb.json")
    joblib.dump(model, OUT_DIR / "model_xgb.pkl")
    json.dump(list(X.columns), open(OUT_DIR / "feature_columns.json", "w"), indent=2)

    metricas = {
        "auc_roc": auc_roc,
        "pr_auc": pr_auc,
        "n_features": int(X.shape[1]),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "scale_pos_weight": float(scale_pos_weight),
        "best_threshold": best_thr,
        "metricas_por_threshold": metricas_por_thr,
        "top_15_features": importances.head(15).to_dict(),
        "prob_media_inyectados": float(proba_inj.mean()) if ids_df is not None else None,
        "hyperparams": params,
    }
    # Para compatibilidad con codigo viejo, exponer al top level las metricas del threshold default
    default_m = metricas_por_thr["default_0.5"]
    metricas["precision"] = default_m["precision"]
    metricas["recall"] = default_m["recall"]
    metricas["f1"] = default_m["f1"]
    metricas["confusion_matrix"] = default_m["confusion_matrix"]

    json.dump(metricas, open(OUT_DIR / "metrics.json", "w"), indent=2, default=str)
    log(f"\nGuardado modelo + metricas en {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
