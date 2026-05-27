"""Hyperparameter tuning con Optuna sobre XGBoost.

Optimiza PR-AUC (mejor metrica para clases desbalanceadas).
50 trials por defecto.

Output: data/processed/best_hyperparams.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import optuna
import pandas as pd
import xgboost as xgb
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
FEATURES = ROOT / "data" / "processed" / "features.parquet"
OUT_DIR = ROOT / "runs" / "local"


def log(msg: str) -> None:
    print(f"[optuna] {msg}", flush=True)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--n-trials", type=int, default=50)
    args = p.parse_args()

    df = pd.read_parquet(FEATURES)
    drop = [c for c in ["id_siniestro", "caso_inyectado"] if c in df.columns]
    if drop:
        df = df.drop(columns=drop)
    y = df["etiqueta_fraude_simulada"]
    X = df.drop(columns=["etiqueta_fraude_simulada"])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=42
    )
    scale_pos_weight = (y_train == 0).sum() / max(1, (y_train == 1).sum())
    log(f"Train: {len(X_train)} / Test: {len(X_test)} / SPW: {scale_pos_weight:.2f}")

    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 200, 800, step=100),
            "max_depth": trial.suggest_int("max_depth", 4, 10),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "gamma": trial.suggest_float("gamma", 0, 5),
            "reg_alpha": trial.suggest_float("reg_alpha", 0, 5),
            "reg_lambda": trial.suggest_float("reg_lambda", 0, 5),
            "scale_pos_weight": scale_pos_weight,
            "objective": "binary:logistic",
            "eval_metric": "aucpr",
            "random_state": 42,
            "n_jobs": -1,
            "tree_method": "hist",
        }
        model = xgb.XGBClassifier(**params)
        model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
        y_proba = model.predict_proba(X_test)[:, 1]
        return average_precision_score(y_test, y_proba)

    log(f"Iniciando Optuna con {args.n_trials} trials...")
    study = optuna.create_study(direction="maximize",
                                 sampler=optuna.samplers.TPESampler(seed=42))
    study.optimize(objective, n_trials=args.n_trials, show_progress_bar=True)

    log(f"\n=== MEJOR TRIAL ===")
    log(f"  PR-AUC: {study.best_value:.4f}")
    log(f"  Params:")
    for k, v in study.best_params.items():
        log(f"    {k}: {v}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "best_hyperparams.json"
    json.dump({"best_pr_auc": study.best_value,
               "params": study.best_params,
               "n_trials": args.n_trials},
              open(out, "w"), indent=2)
    log(f"\nGuardado en {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
