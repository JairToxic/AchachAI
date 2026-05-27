"""Script de scoring que se ejecuta en el endpoint Azure ML.

Recibe JSON con features y devuelve probabilidad de posible fraude + nivel + top features.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

LOG = logging.getLogger("achachai-scoring")
MODEL = None
FEATURE_COLS: list[str] = []


def init():
    """Cargado una vez al iniciar el container."""
    global MODEL, FEATURE_COLS
    model_dir = Path(os.environ.get("AZUREML_MODEL_DIR", "."))
    # El modelo se monta en AZUREML_MODEL_DIR/local/ (porque registramos runs/local)
    candidates = [
        model_dir / "model_xgb.pkl",
        model_dir / "local" / "model_xgb.pkl",
    ]
    for p in candidates:
        if p.exists():
            MODEL = joblib.load(p)
            LOG.info(f"Modelo cargado desde {p}")
            break
    else:
        raise FileNotFoundError(f"No encontre model_xgb.pkl en {candidates}")

    for p in [model_dir / "feature_columns.json",
              model_dir / "local" / "feature_columns.json"]:
        if p.exists():
            FEATURE_COLS = json.loads(p.read_text())
            LOG.info(f"Columnas cargadas: {len(FEATURE_COLS)}")
            break


def run(raw_data: str) -> str:
    """Entrada esperada:
    {
      "instances": [ { "feature1": valor, "feature2": valor, ... }, ... ]
    }
    Salida:
    {
      "predictions": [
        { "prob_fraude": 0.83, "nivel_ml": "ALTO", "top_features": [...] }, ...
      ]
    }
    """
    try:
        body = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
        instances = body.get("instances") or body.get("data") or []
        if not instances:
            return json.dumps({"error": "input vacio, se esperaba 'instances'"})

        # Asegurar todas las columnas esperadas (rellenar con 0 si falta)
        df = pd.DataFrame(instances)
        for col in FEATURE_COLS:
            if col not in df.columns:
                df[col] = 0
        df = df[FEATURE_COLS]

        proba = MODEL.predict_proba(df)[:, 1]
        importancias = MODEL.feature_importances_

        results = []
        for i, p in enumerate(proba):
            # Top features que contribuyen segun importancia global (proxy de SHAP)
            top_idx = np.argsort(importancias)[::-1][:5]
            top_feat = [{"feature": FEATURE_COLS[j],
                         "importancia": float(importancias[j])} for j in top_idx]
            nivel = "ALTO" if p >= 0.7 else ("MEDIO" if p >= 0.4 else "BAJO")
            results.append({
                "prob_fraude": float(p),
                "nivel_ml": nivel,
                "top_features_modelo": top_feat,
            })
        return json.dumps({"predictions": results})

    except Exception as exc:
        LOG.exception("Error en scoring")
        return json.dumps({"error": str(exc), "type": type(exc).__name__})
