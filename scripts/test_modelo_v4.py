"""Smoke test del modelo v4 desde 3 angulos:
1. Carga LOCAL (runs/local/) - el modelo entrenado en la laptop.
2. Carga desde AZURE ML registry - bajar v4 y predecir.
3. Pasar el caso por el SISTEMA HIBRIDO (reglas + modelo + agente).

Usa el caso SIN-0900000 (PTxRB inyectado) como ejemplo.
Es el caso mas claro de fraude posible.

Uso: python scripts/test_modelo_v4.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import joblib
import pandas as pd
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

PROC = ROOT / "data" / "processed"


def banner(t: str):
    print("\n" + "=" * 70)
    print(f"  {t}")
    print("=" * 70)


def cargar_caso_demo() -> tuple[dict, dict, dict, dict, dict, dict, list[dict]]:
    """Carga el caso SIN-0900000 (PTxRB inyectado, deberia salir ROJO)."""
    s = pd.read_parquet(PROC / "siniestros.parquet")
    p = pd.read_parquet(PROC / "polizas.parquet")
    a = pd.read_parquet(PROC / "asegurados.parquet")
    v = pd.read_parquet(PROC / "vehiculos.parquet")
    pr = pd.read_parquet(PROC / "proveedores.parquet")
    c = pd.read_parquet(PROC / "conductores.parquet")
    d = pd.read_parquet(PROC / "documentos.parquet")

    sin_id = "SIN-0900000"  # PTxRB inyectado
    sin = s[s["id_siniestro"] == sin_id].iloc[0].to_dict()
    pol = p[p["id_poliza"] == sin["id_poliza"]].iloc[0].to_dict()
    ase = a[a["id_asegurado"] == sin["id_asegurado"]].iloc[0].to_dict()
    veh = v[v["id_vehiculo"] == sin["id_vehiculo"]].iloc[0].to_dict()
    prov = pr[pr["id_proveedor"] == sin["id_proveedor"]].iloc[0].to_dict()
    cond = c[c["id_conductor"] == sin["id_conductor"]].iloc[0].to_dict()
    docs = d[d["id_siniestro"] == sin_id].to_dict("records")
    return sin, pol, ase, veh, prov, cond, docs


def test_modelo_local():
    """Carga modelo .pkl local y predice."""
    banner("1. MODELO LOCAL (runs/local/model_xgb.pkl)")

    model = joblib.load(ROOT / "runs" / "local" / "model_xgb.pkl")
    feat_cols = json.load(open(ROOT / "runs" / "local" / "feature_columns.json"))
    metrics = json.load(open(ROOT / "runs" / "local" / "metrics.json"))

    print(f"  Modelo cargado: XGBoost con {len(feat_cols)} features")
    print(f"  Metricas reportadas: AUC={metrics['auc_roc']:.3f}, "
          f"PR-AUC={metrics['pr_auc']:.3f}, "
          f"Recall(0.5)={metrics['recall']:.3f}")
    # Tomar features.parquet y predecir sobre el caso SIN-0900000
    feats = pd.read_parquet(PROC / "features.parquet")
    target_row = feats[feats["id_siniestro"] == "SIN-0900000"]
    if target_row.empty:
        print("  WARN: SIN-0900000 no esta en features.parquet")
        return
    X = target_row[feat_cols]
    prob = model.predict_proba(X)[0, 1]
    print(f"\n  Caso de prueba: SIN-0900000 (PTxRB inyectado)")
    print(f"  PROB FRAUDE: {prob:.4f}  ({prob*100:.1f}%)")
    nivel = "ROJO" if prob > 0.7 else "AMARILLO" if prob > 0.4 else "VERDE"
    print(f"  NIVEL MODELO: {nivel}")


def test_modelo_azure():
    """Baja el modelo v4 desde Azure ML registry y predice."""
    banner("2. MODELO DESDE AZURE ML REGISTRY (achachai-fraude-xgb v4)")

    try:
        import pip_system_certs.wrapt_requests  # noqa
        from azure.ai.ml import MLClient
        from azure.identity import AzureCliCredential
    except ImportError as e:
        print(f"  Falta Azure SDK: {e}")
        return

    cred = AzureCliCredential()
    ml = MLClient(cred,
                  os.environ["AZURE_SUBSCRIPTION_ID"],
                  os.environ["AZURE_RESOURCE_GROUP"],
                  os.environ["AZURE_ML_WORKSPACE"])

    # Buscar la ultima version
    latest = max(ml.models.list(name="achachai-fraude-xgb"),
                 key=lambda m: int(m.version))
    print(f"  Modelo registrado: {latest.name} v{latest.version}")
    print(f"  Tags: {dict(latest.tags or {})}")
    print(f"  Path en Azure: {latest.path}")

    # Bajar y cargar (cache local)
    cache_dir = ROOT / "tmp" / "azure_model_v4"
    cache_dir.parent.mkdir(exist_ok=True)
    print(f"\n  Bajando modelo a {cache_dir}...")
    ml.models.download(name=latest.name, version=latest.version,
                       download_path=str(cache_dir.parent))

    # Localizar pkl
    model_pkl = None
    for p in cache_dir.parent.rglob("model_xgb.pkl"):
        model_pkl = p
        break
    if not model_pkl:
        print("  ERROR: no encontre model_xgb.pkl en el download")
        return

    print(f"  pkl en: {model_pkl}")
    model = joblib.load(model_pkl)
    print(f"  OK: modelo cargado desde Azure ({type(model).__name__})")
    # Predecir el mismo caso
    feat_cols = json.load(open(model_pkl.parent / "feature_columns.json"))
    feats = pd.read_parquet(PROC / "features.parquet")
    X = feats[feats["id_siniestro"] == "SIN-0900000"][feat_cols]
    prob = model.predict_proba(X)[0, 1]
    print(f"\n  Caso de prueba: SIN-0900000")
    print(f"  PROB FRAUDE (modelo Azure): {prob:.4f}  ({prob*100:.1f}%)")


def test_sistema_hibrido():
    """Pasa el caso por el sistema completo (reglas + modelo + explicacion)."""
    banner("3. SISTEMA HIBRIDO (reglas + modelo + agente)")

    from src.rules import build_contexto, evaluate_siniestro

    sin, pol, ase, veh, prov, cond, docs = cargar_caso_demo()

    s_all = pd.read_parquet(PROC / "siniestros.parquet")
    p_all = pd.read_parquet(PROC / "proveedores.parquet")
    sim_path = PROC / "similitudes.parquet"
    sim_df = None
    if sim_path.exists():
        _tmp = pd.read_parquet(sim_path)
        if "sim_topk" in _tmp.columns and "en_top_k" in _tmp.columns:
            sim_df = _tmp
        else:
            print(f"  (similitudes.parquet en formato viejo, ignorado)")
    ctx = build_contexto(s_all, p_all, similitudes_df=sim_df)

    r = evaluate_siniestro(
        siniestro=sin, poliza=pol, asegurado=ase, vehiculo=veh,
        proveedor=prov, conductor=cond, documentos=docs, ctx=ctx,
    )

    print(f"  Caso: {r['id_siniestro']}")
    print(f"  SCORE: {r['score']}/100   NIVEL: {r['nivel']}")
    print(f"\n  Reglas criticas activadas ({len(r['reglas_criticas'])}):")
    for reg in r["reglas_criticas"]:
        print(f"    - {reg['codigo']}: {reg['nombre']}")
        print(f"      evidencia: {reg['evidencia']}")
    print(f"\n  Senales puntuadas ({len(r['senales_activadas'])}):")
    for sn in sorted(r["senales_activadas"], key=lambda x: -x["puntos"])[:5]:
        print(f"    - [{sn['puntos']}pts] {sn['nombre']}")
        print(f"      {sn['evidencia']}")
    print(f"\n  EXPLICACION: {r['explicacion_corta']}")


def test_agente_natural_language():
    """Pregunta al agente GPT-5-mini sobre el caso."""
    banner("4. AGENTE GPT-5-MINI (Azure AI Foundry)")
    try:
        from src.ai_agent import ClaimsAgent
    except ImportError as e:
        print(f"  Falta openai: {e}")
        return
    agent = ClaimsAgent()
    print("  Pregunta al agente: '¿Por que el siniestro SIN-0900000 es de alto riesgo?'")
    print("  (calling tool 'detalle_siniestro' automaticamente...)")
    r = agent.chat("¿Por que el siniestro SIN-0900000 es de alto riesgo?")
    print(f"\n  Tools usados: {[t['tool'] for t in r['tools_used']]}")
    print(f"  Tokens consumidos: {r['tokens']}")
    print(f"\n  RESPUESTA DEL AGENTE:")
    print("  " + "-" * 65)
    for line in r["response"].split("\n"):
        print(f"  {line}")


if __name__ == "__main__":
    test_modelo_local()
    test_modelo_azure()
    test_sistema_hibrido()
    test_agente_natural_language()
    print()
