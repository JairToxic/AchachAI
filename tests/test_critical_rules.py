"""Tests para las 7 reglas criticas RF-01..RF-07. 1+ positivo + 1 negativo por regla."""
from __future__ import annotations

from src.rules.critical_rules import (
    rf01_ptxrb,
    rf02_falsificacion,
    rf03_lista_restrictiva,
    rf04_dinamica_imposible,
    rf05_borde_vigencia,
    rf06_demora_robo,
    rf07_narrativa_clonada,
)


# ---------- RF-01: PTxRB ----------
def test_rf01_positivo(siniestro, poliza):
    siniestro["cobertura"] = "Robo"
    siniestro["estado"] = "Pago Total"
    siniestro["monto_pagado_usd"] = poliza["suma_asegurada_usd"] * 0.97
    result = rf01_ptxrb(siniestro, poliza)
    assert result is not None
    assert result["codigo"] == "RF-01"
    assert result["clasificacion"] == "ROJO"


def test_rf01_negativo_no_es_robo(siniestro, poliza):
    siniestro["estado"] = "Pago Total"
    siniestro["monto_pagado_usd"] = poliza["suma_asegurada_usd"]
    assert rf01_ptxrb(siniestro, poliza) is None


def test_rf01_negativo_pago_parcial(siniestro, poliza):
    siniestro["cobertura"] = "Robo"
    siniestro["estado"] = "Pago Total"
    siniestro["monto_pagado_usd"] = poliza["suma_asegurada_usd"] * 0.50
    assert rf01_ptxrb(siniestro, poliza) is None


# ---------- RF-02: falsificacion documental ----------
def test_rf02_factura_anterior_al_evento(siniestro, docs):
    docs[0]["fecha_emision"] = "2025-06-01"  # antes del 2025-06-15
    result = rf02_falsificacion(siniestro, docs)
    assert result is not None and result["codigo"] == "RF-02"
    assert result["clasificacion"] == "ROJO"


def test_rf02_inconsistencia_en_denuncia(siniestro, docs):
    docs[2]["inconsistencia_detectada"] = True
    docs[2]["observacion"] = "Denuncia alterada"
    result = rf02_falsificacion(siniestro, docs)
    assert result is not None and result["codigo"] == "RF-02"


def test_rf02_negativo(siniestro, docs):
    assert rf02_falsificacion(siniestro, docs) is None


# ---------- RF-03: lista restrictiva ----------
def test_rf03_positivo(proveedor_lista, ctx_vacio):
    ctx_vacio.proveedores_lista_restrictiva = {proveedor_lista["id_proveedor"]}
    result = rf03_lista_restrictiva(proveedor_lista, ctx_vacio)
    assert result is not None and result["codigo"] == "RF-03"
    assert result["clasificacion"] == "ROJO"


def test_rf03_negativo(proveedor, ctx_vacio):
    assert rf03_lista_restrictiva(proveedor, ctx_vacio) is None


# ---------- RF-04: dinamica imposible ----------
def test_rf04_garaje_cerrado(siniestro):
    siniestro["descripcion"] = "Vehiculo recibio impacto en garaje cerrado con candado."
    result = rf04_dinamica_imposible(siniestro)
    assert result is not None and result["codigo"] == "RF-04"
    assert result["clasificacion"] == "ROJO"


def test_rf04_freno_de_mano(siniestro):
    siniestro["descripcion"] = "El vehiculo estaba apagado y con freno de mano puesto."
    result = rf04_dinamica_imposible(siniestro)
    assert result is not None and result["codigo"] == "RF-04"


def test_rf04_negativo(siniestro):
    assert rf04_dinamica_imposible(siniestro) is None


# ---------- RF-05: borde de vigencia <48h ----------
def test_rf05_positivo(siniestro):
    siniestro["dias_desde_inicio_poliza"] = 1
    siniestro["dias_desde_fin_poliza"] = 364
    result = rf05_borde_vigencia(siniestro)
    assert result is not None and result["codigo"] == "RF-05"
    assert result["clasificacion"] == "AMARILLO"


def test_rf05_negativo(siniestro):
    siniestro["dias_desde_inicio_poliza"] = 60
    siniestro["dias_desde_fin_poliza"] = 305
    assert rf05_borde_vigencia(siniestro) is None


# ---------- RF-06: demora denuncia robo ----------
def test_rf06_positivo(siniestro):
    siniestro["cobertura"] = "Robo"
    siniestro["dias_entre_ocurrencia_reporte"] = 7
    result = rf06_demora_robo(siniestro)
    assert result is not None and result["codigo"] == "RF-06"


def test_rf06_negativo_choque(siniestro):
    siniestro["dias_entre_ocurrencia_reporte"] = 30
    assert rf06_demora_robo(siniestro) is None


def test_rf06_negativo_robo_rapido(siniestro):
    siniestro["cobertura"] = "Robo"
    siniestro["dias_entre_ocurrencia_reporte"] = 2
    assert rf06_demora_robo(siniestro) is None


# ---------- RF-07: narrativa clonada (top-K + sim>0.99) ----------
def test_rf07_positivo_en_topk_y_alta_sim(siniestro, ctx_vacio):
    """Necesita estar en top-K y tener sim >= 0.99."""
    ctx_vacio.ids_en_topk_similar = {siniestro["id_siniestro"]}
    ctx_vacio.similitud_max_por_siniestro = {siniestro["id_siniestro"]: 0.995}
    result = rf07_narrativa_clonada(siniestro, ctx_vacio)
    assert result is not None and result["codigo"] == "RF-07"


def test_rf07_negativo_no_topk(siniestro, ctx_vacio):
    """Aunque la sim sea altisima, sin estar en top-K NO dispara."""
    ctx_vacio.similitud_max_por_siniestro = {siniestro["id_siniestro"]: 0.999}
    assert rf07_narrativa_clonada(siniestro, ctx_vacio) is None


def test_rf07_negativo_topk_pero_sim_baja(siniestro, ctx_vacio):
    """Esta en top-K pero la sim no llega a 0.99 -> no dispara."""
    ctx_vacio.ids_en_topk_similar = {siniestro["id_siniestro"]}
    ctx_vacio.similitud_max_por_siniestro = {siniestro["id_siniestro"]: 0.96}
    assert rf07_narrativa_clonada(siniestro, ctx_vacio) is None
