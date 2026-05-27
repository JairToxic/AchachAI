"""Demo pedagogica: muestra paso a paso como el sistema procesa
1 siniestro real, explicando cada numero y decision.

Como una clase: 'asi piensa el modelo cuando ve este caso'.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
PROC = ROOT / "data" / "processed"

BLUE = "\033[34m"; GREEN = "\033[32m"; RED = "\033[31m"; YELLOW = "\033[33m"
BOLD = "\033[1m"; END = "\033[0m"
def b(t): return f"{BOLD}{t}{END}"
def banner(t):
    print(f"\n{BLUE}{'='*72}{END}")
    print(f"{BLUE}{b(' ' + t)}{END}")
    print(f"{BLUE}{'='*72}{END}")


def cargar_tablas():
    return {
        "s": pd.read_parquet(PROC / "siniestros.parquet"),
        "p": pd.read_parquet(PROC / "polizas.parquet"),
        "a": pd.read_parquet(PROC / "asegurados.parquet"),
        "v": pd.read_parquet(PROC / "vehiculos.parquet"),
        "pr": pd.read_parquet(PROC / "proveedores.parquet"),
        "c": pd.read_parquet(PROC / "conductores.parquet"),
        "d": pd.read_parquet(PROC / "documentos.parquet"),
        "feat": pd.read_parquet(PROC / "features.parquet"),
    }


def mostrar_caso(t, id_sin):
    """Imprime los datos crudos del caso, como los ve el analista."""
    s = t["s"][t["s"]["id_siniestro"] == id_sin].iloc[0]
    pol = t["p"][t["p"]["id_poliza"] == s["id_poliza"]].iloc[0]
    ase = t["a"][t["a"]["id_asegurado"] == s["id_asegurado"]].iloc[0]
    veh = t["v"][t["v"]["id_vehiculo"] == s["id_vehiculo"]].iloc[0]
    prov = t["pr"][t["pr"]["id_proveedor"] == s["id_proveedor"]].iloc[0]
    docs = t["d"][t["d"]["id_siniestro"] == id_sin]

    banner(f"PASO 1: DATOS CRUDOS DEL CASO {id_sin}")
    print(f"{b('Siniestro:')}")
    print(f"  fecha ocurrencia : {s['fecha_ocurrencia']}")
    print(f"  fecha reporte    : {s['fecha_reporte']}   ({s['dias_entre_ocurrencia_reporte']} dias despues)")
    print(f"  cobertura        : {s['cobertura']}")
    print(f"  estado           : {s['estado']}")
    print(f"  monto reclamado  : ${s['monto_reclamado_usd']:,.0f}")
    print(f"  monto pagado     : ${s['monto_pagado_usd']:,.0f}")
    print(f"  ciudad evento    : {s['ciudad_evento']}")
    print(f"  documentos OK    : {s['documentos_completos']}")
    print(f"  fault            : {s['fault_responsable']}")
    print(f"  dias desde inicio poliza : {s['dias_desde_inicio_poliza']}")
    print(f"  parte policial   : {s['tuvo_parte_policial']}")
    print(f"\n{b('Descripcion:')}")
    print(f'  "{s["descripcion"][:150]}..."')

    print(f"\n{b('Poliza:')}")
    print(f"  suma asegurada   : ${pol['suma_asegurada_usd']:,.0f}")
    print(f"  prima            : ${pol['prima_usd']:,.0f}")
    print(f"  canal venta      : {pol['canal_venta']}")

    print(f"\n{b('Asegurado:')}")
    print(f"  segmento         : {ase['segmento']}")
    print(f"  antiguedad       : {ase['antiguedad_anios']} años")
    print(f"  score cliente    : {ase['score_cliente_simulado']}")
    print(f"  reclamos 12m     : {ase['reclamos_ultimos_12_meses']}")

    print(f"\n{b('Vehiculo:')}")
    print(f"  {veh['marca']} {veh['modelo']} {veh['anio_vehiculo']} ({veh['categoria']})")
    print(f"  valor comercial  : ${veh['valor_comercial_usd']:,.0f}")

    print(f"\n{b('Proveedor:')}")
    print(f"  {prov['nombre']} ({prov['tipo']}) - {prov['ciudad']}")
    if prov["lista_restrictiva"]:
        print(f"  {RED}⚠️  EN LISTA RESTRICTIVA{END}")

    print(f"\n{b('Documentos:')} ({len(docs)})")
    for _, doc in docs.iterrows():
        flag = " ⚠️ INCONSISTENTE" if doc["inconsistencia_detectada"] else ""
        miss = " ✗ NO ENTREGADO" if not doc["entregado"] else ""
        print(f"  {doc['tipo_documento']}: emitido {doc['fecha_emision']}{flag}{miss}")

    return s, pol, ase, veh, prov, docs


def evaluar_modelo(t, id_sin):
    banner("PASO 2: MODELO XGBOOST (Azure ML registry v4)")
    feat_cols = json.load(open(ROOT / "runs" / "local" / "feature_columns.json"))
    model = joblib.load(ROOT / "runs" / "local" / "model_xgb.pkl")

    row = t["feat"][t["feat"]["id_siniestro"] == id_sin]
    if row.empty:
        print("Caso no esta en features.parquet")
        return None

    X = row[feat_cols]
    prob = model.predict_proba(X)[0, 1]
    nivel = "ROJO" if prob >= 0.7 else "AMARILLO" if prob >= 0.4 else "VERDE"
    color = RED if nivel == "ROJO" else YELLOW if nivel == "AMARILLO" else GREEN

    print(f"  El modelo recibe {len(feat_cols)} features numericas")
    print(f"  Pasa por 400 arboles de decision")
    print(f"  Cada arbol vota; se promedia")
    print(f"\n  {b('PROBABILIDAD DE FRAUDE:')} {color}{b(f'{prob*100:.1f}%')}{END}")
    print(f"  {b('NIVEL DEL MODELO:')}      {color}{b(nivel)}{END}")

    # Top 5 features que más contribuyeron (interpretabilidad)
    print(f"\n  {b('Top 5 features mas importantes globalmente:')} (no las shap del caso)")
    importances = pd.Series(model.feature_importances_, index=feat_cols).sort_values(ascending=False)
    for i, (feat, imp) in enumerate(importances.head(5).items(), 1):
        valor = X[feat].iloc[0]
        print(f"    {i}. {feat:<35} importancia {imp*100:>5.1f}%   valor en este caso: {valor}")

    return prob


def evaluar_reglas(t, id_sin):
    banner("PASO 3: MOTOR DE REGLAS (Python, deterministico)")
    from src.rules import build_contexto, evaluate_siniestro

    s = t["s"][t["s"]["id_siniestro"] == id_sin].iloc[0].to_dict()
    pol = t["p"][t["p"]["id_poliza"] == s["id_poliza"]].iloc[0].to_dict()
    ase = t["a"][t["a"]["id_asegurado"] == s["id_asegurado"]].iloc[0].to_dict()
    veh = t["v"][t["v"]["id_vehiculo"] == s["id_vehiculo"]].iloc[0].to_dict()
    prov = t["pr"][t["pr"]["id_proveedor"] == s["id_proveedor"]].iloc[0].to_dict()
    cond = t["c"][t["c"]["id_conductor"] == s["id_conductor"]].iloc[0].to_dict()
    docs = t["d"][t["d"]["id_siniestro"] == id_sin].to_dict("records")

    sim_path = PROC / "similitudes.parquet"
    sim_df = None
    if sim_path.exists():
        _tmp = pd.read_parquet(sim_path)
        if "sim_topk" in _tmp.columns:
            sim_df = _tmp

    ctx = build_contexto(t["s"], t["pr"], similitudes_df=sim_df)
    r = evaluate_siniestro(siniestro=s, poliza=pol, asegurado=ase, vehiculo=veh,
                            proveedor=prov, conductor=cond, documentos=docs, ctx=ctx)

    color = RED if r["nivel"] == "ROJO" else YELLOW if r["nivel"] == "AMARILLO" else GREEN
    print(f"  {b('SCORE FINAL:')} {color}{b(str(r['score']) + '/100')}{END}")
    print(f"  {b('NIVEL:')}       {color}{b(r['nivel'])}{END}")

    print(f"\n  {b('Reglas criticas activadas:')} ({len(r['reglas_criticas'])})")
    if not r["reglas_criticas"]:
        print(f"    {GREEN}(ninguna - no se cumplio condicion para RF-01..07){END}")
    for reg in r["reglas_criticas"]:
        print(f"    {RED}• {reg['codigo']}: {reg['nombre']}{END}")
        print(f"      evidencia: {reg['evidencia']}")

    print(f"\n  {b('Senales puntuadas activadas:')} ({len(r['senales_activadas'])})")
    if not r["senales_activadas"]:
        print(f"    {GREEN}(ninguna){END}")
    for sn in sorted(r["senales_activadas"], key=lambda x: -x["puntos"]):
        print(f"    {YELLOW}[{sn['puntos']}pts]{END} {sn['nombre']}")
        print(f"      evidencia: {sn['evidencia']}")

    print(f"\n  {b('Explicacion auto-generada:')}")
    print(f"    {r['explicacion_corta']}")
    return r


def main():
    args = sys.argv[1:]
    if args:
        id_sin = args[0]
    else:
        # Por default mostramos 3 casos: 1 verde claro, 1 rojo inyectado, 1 sospechoso real
        ids = ["SIN-0900000",  # PTxRB inyectado
               "SIN-100024",   # Robo de los nuevos (puede ser fraude o no)
               "SIN-000001"]   # Primero del dataset original (RC normal)
        for idx in ids:
            t = cargar_tablas()
            mostrar_caso(t, idx)
            evaluar_modelo(t, idx)
            evaluar_reglas(t, idx)
            print(f"\n{BLUE}{'#'*72}{END}\n")
        return

    t = cargar_tablas()
    mostrar_caso(t, id_sin)
    evaluar_modelo(t, id_sin)
    evaluar_reglas(t, id_sin)


if __name__ == "__main__":
    main()
