"""Tests de scoring + integracion del motor completo (evaluate_siniestro)."""
from __future__ import annotations

from src.rules import evaluate_siniestro
from src.rules.scoring import calcular_score


# ---------- calcular_score: niveles puros ----------
def test_score_verde():
    s, n = calcular_score(senales=[{"puntos": 10}, {"puntos": 5}], reglas_criticas=[])
    assert s == 15 and n == "VERDE"


def test_score_amarillo():
    s, n = calcular_score(senales=[{"puntos": 20}, {"puntos": 25}], reglas_criticas=[])
    assert s == 45 and n == "AMARILLO"


def test_score_rojo_por_puntaje():
    s, n = calcular_score(senales=[{"puntos": 40}, {"puntos": 50}], reglas_criticas=[])
    assert s == 90 and n == "ROJO"


def test_score_cap_a_100():
    s, n = calcular_score(senales=[{"puntos": 70}, {"puntos": 70}], reglas_criticas=[])
    assert s == 100 and n == "ROJO"


# ---------- override por reglas criticas ----------
def test_score_override_rojo_por_rf01():
    s, n = calcular_score(senales=[{"puntos": 0}], reglas_criticas=[{"codigo": "RF-01"}])
    assert n == "ROJO" and s >= 76


def test_score_override_rojo_por_rf02():
    s, n = calcular_score(senales=[], reglas_criticas=[{"codigo": "RF-02"}])
    assert n == "ROJO" and s >= 76


def test_score_override_amarillo_por_rf05():
    s, n = calcular_score(senales=[{"puntos": 5}], reglas_criticas=[{"codigo": "RF-05"}])
    assert n == "AMARILLO" and s >= 41


def test_score_rf_roja_supera_a_rf_amarilla():
    # Si hay ambas, gana la roja
    s, n = calcular_score(senales=[], reglas_criticas=[
        {"codigo": "RF-05"}, {"codigo": "RF-01"},
    ])
    assert n == "ROJO" and s >= 76


# ---------- Integracion end-to-end ----------
def test_evaluate_caso_verde(siniestro, poliza, proveedor, docs, ctx_vacio):
    result = evaluate_siniestro(
        siniestro=siniestro, poliza=poliza, asegurado={"id_asegurado": "ASE-T01"},
        vehiculo={"id_vehiculo": "VEH-T01"}, proveedor=proveedor,
        documentos=docs, ctx=ctx_vacio,
    )
    assert result["nivel"] == "VERDE"
    assert result["score"] < 41
    assert len(result["reglas_criticas"]) == 0


def test_evaluate_ptxrb_es_rojo(siniestro, poliza, proveedor, docs, ctx_vacio):
    siniestro["cobertura"] = "Robo"
    siniestro["estado"] = "Pago Total"
    siniestro["monto_pagado_usd"] = poliza["suma_asegurada_usd"] * 0.98
    result = evaluate_siniestro(
        siniestro=siniestro, poliza=poliza, asegurado={"id_asegurado": "ASE-T01"},
        vehiculo={"id_vehiculo": "VEH-T01"}, proveedor=proveedor,
        documentos=docs, ctx=ctx_vacio,
    )
    assert result["nivel"] == "ROJO"
    assert any(r["codigo"] == "RF-01" for r in result["reglas_criticas"])


def test_evaluate_borde_vigencia_es_al_menos_amarillo(siniestro, poliza, proveedor, docs, ctx_vacio):
    siniestro["dias_desde_inicio_poliza"] = 1
    result = evaluate_siniestro(
        siniestro=siniestro, poliza=poliza, asegurado={"id_asegurado": "ASE-T01"},
        vehiculo={"id_vehiculo": "VEH-T01"}, proveedor=proveedor,
        documentos=docs, ctx=ctx_vacio,
    )
    assert result["nivel"] in ("AMARILLO", "ROJO")
    assert any(r["codigo"] == "RF-05" for r in result["reglas_criticas"])


def test_evaluate_explicacion_no_acusa(siniestro, poliza, proveedor, docs, ctx_vacio):
    """La explicacion nunca debe contener palabras acusatorias."""
    siniestro["dias_desde_inicio_poliza"] = 1
    result = evaluate_siniestro(
        siniestro=siniestro, poliza=poliza, asegurado={"id_asegurado": "ASE-T01"},
        vehiculo={"id_vehiculo": "VEH-T01"}, proveedor=proveedor,
        documentos=docs, ctx=ctx_vacio,
    )
    palabras_prohibidas = ["fraude confirmado", "fraudulento", "estafa", "criminal", "delincuente"]
    expl = result["explicacion_corta"].lower()
    for p in palabras_prohibidas:
        assert p not in expl, f"La explicacion contiene palabra acusatoria: {p}"


def test_evaluate_caso_critico_inyectado_es_rojo(siniestro, poliza, proveedor, docs, ctx_vacio):
    """Caso real estilo RF-02: factura previa al evento debe dar ROJO."""
    docs[0]["fecha_emision"] = "2025-06-05"  # 10 dias antes del evento (2025-06-15)
    result = evaluate_siniestro(
        siniestro=siniestro, poliza=poliza, asegurado={"id_asegurado": "ASE-T01"},
        vehiculo={"id_vehiculo": "VEH-T01"}, proveedor=proveedor,
        documentos=docs, ctx=ctx_vacio,
    )
    assert result["nivel"] == "ROJO"
    assert any(r["codigo"] == "RF-02" for r in result["reglas_criticas"])
