"""Smoke test: aplica el motor de reglas a los 40 casos criticos inyectados
y a 100 casos aleatorios del dataset, valida que:
- Todos los inyectados RF-01..04 quedan ROJO
- Todos los inyectados RF-05 quedan al menos AMARILLO
- La gran mayoria de no-fraude (etiqueta=0) quedan VERDE
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.rules import build_contexto, evaluate_siniestro  # noqa: E402

PROC = ROOT / "data" / "processed"


def main() -> int:
    print("Cargando tablas...")
    s = pd.read_parquet(PROC / "siniestros.parquet")
    pol = pd.read_parquet(PROC / "polizas.parquet").set_index("id_poliza")
    ase = pd.read_parquet(PROC / "asegurados.parquet").set_index("id_asegurado")
    veh = pd.read_parquet(PROC / "vehiculos.parquet").set_index("id_vehiculo")
    prov = pd.read_parquet(PROC / "proveedores.parquet").set_index("id_proveedor")
    cond = pd.read_parquet(PROC / "conductores.parquet").set_index("id_conductor")
    docs = pd.read_parquet(PROC / "documentos.parquet")

    proveedores_full = prov.reset_index()

    print("Construyendo Contexto agregado...")
    ctx = build_contexto(s, proveedores_full)

    docs_por_sin = docs.groupby("id_siniestro").apply(lambda d: d.to_dict("records"), include_groups=False).to_dict()

    print("\nEvaluando 40 casos inyectados...")
    inj = s[s["caso_inyectado"]]
    resultados_inj = []
    for _, sin in inj.iterrows():
        r = evaluate_siniestro(
            siniestro=sin.to_dict(),
            poliza=pol.loc[sin["id_poliza"]].to_dict() | {"id_poliza": sin["id_poliza"]},
            asegurado=ase.loc[sin["id_asegurado"]].to_dict() | {"id_asegurado": sin["id_asegurado"]},
            vehiculo=veh.loc[sin["id_vehiculo"]].to_dict() | {"id_vehiculo": sin["id_vehiculo"]},
            proveedor=prov.loc[sin["id_proveedor"]].to_dict() | {"id_proveedor": sin["id_proveedor"]},
            conductor=cond.loc[sin["id_conductor"]].to_dict() | {"id_conductor": sin["id_conductor"]},
            documentos=docs_por_sin.get(sin["id_siniestro"], []),
            ctx=ctx,
        )
        import re
        m = re.search(r"\[INYECTADO: (RF-\d+)", sin["descripcion"] or "")
        regla_obj = m.group(1) if m else "?"
        resultados_inj.append((sin["id_siniestro"], regla_obj, r["nivel"], r["score"],
                               [x["codigo"] for x in r["reglas_criticas"]]))

    print("\nResultados sobre casos inyectados:")
    print(f"{'id_siniestro':<14} {'regla_obj':<8} {'nivel':<9} {'score':<6} reglas_disparadas")
    print("-" * 80)
    aciertos = {"RF-01": 0, "RF-02": 0, "RF-03": 0, "RF-04": 0, "RF-05": 0}
    fallos = []
    for sid, obj, nivel, score, reglas in resultados_inj:
        ok = False
        if obj in ("RF-01", "RF-02", "RF-03", "RF-04") and nivel == "ROJO" and obj in reglas:
            aciertos[obj] += 1; ok = True
        elif obj == "RF-05" and nivel in ("AMARILLO", "ROJO") and "RF-05" in reglas:
            aciertos[obj] += 1; ok = True
        marker = "OK" if ok else "FALLO"
        print(f"{sid:<14} {obj:<8} {nivel:<9} {score:<6} {','.join(reglas):<30} [{marker}]")
        if not ok:
            fallos.append((sid, obj, nivel, reglas))

    print(f"\nAciertos: {aciertos}")
    print(f"Fallos: {len(fallos)}/{len(resultados_inj)}")

    print("\nEvaluando 200 casos aleatorios NO inyectados con etiqueta=0...")
    sample = s[(~s["caso_inyectado"]) & (s["etiqueta_fraude_simulada"] == 0)].sample(200, random_state=42)
    niveles_norm = {"VERDE": 0, "AMARILLO": 0, "ROJO": 0}
    for _, sin in sample.iterrows():
        r = evaluate_siniestro(
            siniestro=sin.to_dict(),
            poliza=pol.loc[sin["id_poliza"]].to_dict() | {"id_poliza": sin["id_poliza"]},
            asegurado=ase.loc[sin["id_asegurado"]].to_dict() | {"id_asegurado": sin["id_asegurado"]},
            vehiculo=veh.loc[sin["id_vehiculo"]].to_dict() | {"id_vehiculo": sin["id_vehiculo"]},
            proveedor=prov.loc[sin["id_proveedor"]].to_dict() | {"id_proveedor": sin["id_proveedor"]},
            conductor=cond.loc[sin["id_conductor"]].to_dict() | {"id_conductor": sin["id_conductor"]},
            documentos=docs_por_sin.get(sin["id_siniestro"], []),
            ctx=ctx,
        )
        niveles_norm[r["nivel"]] += 1

    print(f"  Sample de 200 no-fraude: VERDE={niveles_norm['VERDE']}, AMARILLO={niveles_norm['AMARILLO']}, ROJO={niveles_norm['ROJO']}")
    print(f"  Tasa de falso positivo (no-fraude marcado AMARILLO o ROJO): {(niveles_norm['AMARILLO']+niveles_norm['ROJO'])/200*100:.1f}%")

    return 0 if not fallos else 1


if __name__ == "__main__":
    sys.exit(main())
