"""Tests para las 14 senales puntuadas. 1 caso positivo + 1 negativo por senal."""
from __future__ import annotations

from src.rules.contexto import Contexto
from src.rules.signals import (
    signal_borde_vigencia,
    signal_demora_denuncia_robo,
    signal_dinamica_sospechosa,
    signal_documentos_inconsistentes,
    signal_documentos_incompletos,
    signal_freq_asegurado,
    signal_freq_conductor,
    signal_freq_solo_rc,
    signal_freq_vehiculo,
    signal_monto_atipico,
    signal_narrativas_similares,
    signal_proveedor_recurrente,
    signal_reporte_tardio,
    signal_sin_tercero,
)


# ---------- Senal 1: borde de vigencia ----------
def test_signal_borde_vigencia_positivo(siniestro):
    siniestro["dias_desde_inicio_poliza"] = 5
    siniestro["dias_desde_fin_poliza"] = 360
    result = signal_borde_vigencia(siniestro)
    assert result is not None
    assert result["puntos"] == 8


def test_signal_borde_vigencia_negativo(siniestro):
    siniestro["dias_desde_inicio_poliza"] = 180
    siniestro["dias_desde_fin_poliza"] = 185
    assert signal_borde_vigencia(siniestro) is None


def test_signal_borde_vigencia_intermedio(siniestro):
    siniestro["dias_desde_inicio_poliza"] = 20
    siniestro["dias_desde_fin_poliza"] = 345
    result = signal_borde_vigencia(siniestro)
    assert result["puntos"] == 4


# ---------- Senal 2: demora denuncia robo ----------
def test_signal_demora_robo_positivo(siniestro):
    siniestro["cobertura"] = "Robo"
    siniestro["dias_entre_ocurrencia_reporte"] = 5  # 5*24 = 120h > 48
    result = signal_demora_denuncia_robo(siniestro)
    assert result is not None and result["puntos"] == 8


def test_signal_demora_robo_no_aplica_a_choque(siniestro):
    siniestro["cobertura"] = "Choque"
    siniestro["dias_entre_ocurrencia_reporte"] = 10
    assert signal_demora_denuncia_robo(siniestro) is None


# ---------- Senal 3: frecuencia asegurado ----------
def test_signal_freq_asegurado_positivo(siniestro, ctx_vacio):
    ctx_vacio.siniestros_por_asegurado_18m = {siniestro["id_asegurado"]: 4}
    result = signal_freq_asegurado(siniestro, ctx_vacio)
    assert result["puntos"] == 8


def test_signal_freq_asegurado_negativo(siniestro, ctx_vacio):
    assert signal_freq_asegurado(siniestro, ctx_vacio) is None


# ---------- Senal 4: frecuencia vehiculo ----------
def test_signal_freq_vehiculo_positivo(siniestro, ctx_vacio):
    ctx_vacio.siniestros_por_vehiculo_18m = {siniestro["id_vehiculo"]: 3}
    result = signal_freq_vehiculo(siniestro, ctx_vacio)
    assert result["puntos"] == 6


def test_signal_freq_vehiculo_negativo(siniestro, ctx_vacio):
    ctx_vacio.siniestros_por_vehiculo_18m = {siniestro["id_vehiculo"]: 1}
    assert signal_freq_vehiculo(siniestro, ctx_vacio) is None


# ---------- Senal 5: frecuencia conductor ----------
def test_signal_freq_conductor_positivo(siniestro, ctx_vacio):
    ctx_vacio.siniestros_por_conductor_18m = {siniestro["id_conductor"]: 3}
    result = signal_freq_conductor(siniestro, ctx_vacio)
    assert result["puntos"] == 8


def test_signal_freq_conductor_negativo(siniestro, ctx_vacio):
    assert signal_freq_conductor(siniestro, ctx_vacio) is None


# ---------- Senal 6: frecuencia solo RC ----------
def test_signal_freq_rc_positivo(siniestro, ctx_vacio):
    siniestro["cobertura"] = "Responsabilidad Civil"
    # ctx incluye al actual + 3 previos = 4 RC totales -> 3 previos -> >2 -> 6pts
    ctx_vacio.siniestros_rc_por_asegurado = {siniestro["id_asegurado"]: 4}
    result = signal_freq_solo_rc(siniestro, ctx_vacio)
    assert result["puntos"] == 6


def test_signal_freq_rc_no_aplica_a_choque(siniestro, ctx_vacio):
    siniestro["cobertura"] = "Choque"
    ctx_vacio.siniestros_rc_por_asegurado = {siniestro["id_asegurado"]: 10}
    assert signal_freq_solo_rc(siniestro, ctx_vacio) is None


# ---------- Senal 7: proveedor recurrente ----------
def test_signal_proveedor_lista_restrictiva(proveedor_lista, ctx_vacio):
    ctx_vacio.proveedores_lista_restrictiva = {proveedor_lista["id_proveedor"]}
    result = signal_proveedor_recurrente(proveedor_lista, ctx_vacio)
    assert result["puntos"] == 10


def test_signal_proveedor_recurrente_por_volumen(proveedor, ctx_vacio):
    ctx_vacio.casos_anuales_por_proveedor = {proveedor["id_proveedor"]: 5}
    result = signal_proveedor_recurrente(proveedor, ctx_vacio)
    assert result["puntos"] == 5


def test_signal_proveedor_negativo(proveedor, ctx_vacio):
    assert signal_proveedor_recurrente(proveedor, ctx_vacio) is None


# ---------- Senal 8: documentos incompletos ----------
def test_signal_docs_incompletos_positivo(docs):
    # Sacamos la Denuncia: tipos entregados = {Factura, Foto}, falta Denuncia
    docs_sin_denuncia = [d for d in docs if d["tipo_documento"] != "Denuncia"]
    result = signal_documentos_incompletos(docs_sin_denuncia)
    assert result is not None and result["puntos"] == 4


def test_signal_docs_incompletos_negativo(docs):
    assert signal_documentos_incompletos(docs) is None


# ---------- Senal 9: dinamica sospechosa ----------
def test_signal_dinamica_garaje_cerrado(siniestro):
    siniestro["descripcion"] = "El vehiculo estaba en garaje cerrado cuando recibio colision frontal."
    result = signal_dinamica_sospechosa(siniestro)
    assert result is not None and result["puntos"] == 6


def test_signal_dinamica_descripcion_normal(siniestro):
    assert signal_dinamica_sospechosa(siniestro) is None


# ---------- Senal 10: sin tercero identificado ----------
def test_signal_sin_tercero_positivo(siniestro, poliza):
    siniestro["fault_responsable"] = "Tercero"
    siniestro["tuvo_parte_policial"] = False
    siniestro["monto_reclamado_usd"] = poliza["suma_asegurada_usd"] * 0.5
    result = signal_sin_tercero(siniestro, poliza)
    assert result is not None and result["puntos"] == 5


def test_signal_sin_tercero_no_aplica_si_responsable_asegurado(siniestro, poliza):
    assert signal_sin_tercero(siniestro, poliza) is None


# ---------- Senal 11: documentos inconsistentes ----------
def test_signal_docs_inconsistentes_positivo(siniestro, docs):
    docs[0]["inconsistencia_detectada"] = True
    docs[0]["observacion"] = "Alterado"
    result = signal_documentos_inconsistentes(siniestro, docs)
    assert result is not None and result["puntos"] == 10


def test_signal_factura_anterior_al_evento(siniestro, docs):
    docs[0]["fecha_emision"] = "2025-06-01"  # antes del 2025-06-15
    result = signal_documentos_inconsistentes(siniestro, docs)
    assert result is not None and result["puntos"] == 10


def test_signal_docs_inconsistentes_negativo(siniestro, docs):
    assert signal_documentos_inconsistentes(siniestro, docs) is None


# ---------- Senal 12: reporte tardio ----------
def test_signal_reporte_tardio_positivo(siniestro):
    siniestro["dias_entre_ocurrencia_reporte"] = 10
    result = signal_reporte_tardio(siniestro)
    assert result is not None and result["puntos"] == 5


def test_signal_reporte_tardio_intermedio(siniestro):
    siniestro["dias_entre_ocurrencia_reporte"] = 5
    result = signal_reporte_tardio(siniestro)
    assert result["puntos"] == 3


def test_signal_reporte_tardio_no_aplica_a_robo(siniestro):
    siniestro["cobertura"] = "Robo"
    siniestro["dias_entre_ocurrencia_reporte"] = 10
    assert signal_reporte_tardio(siniestro) is None


# ---------- Senal 13: narrativas similares ----------
def test_signal_narrativa_alta_similitud(siniestro, ctx_vacio):
    ctx_vacio.similitud_max_por_siniestro = {siniestro["id_siniestro"]: 0.92}
    result = signal_narrativas_similares(siniestro, ctx_vacio)
    assert result["puntos"] == 8


def test_signal_narrativa_sin_similitud(siniestro, ctx_vacio):
    ctx_vacio.similitud_max_por_siniestro = {siniestro["id_siniestro"]: 0.10}
    assert signal_narrativas_similares(siniestro, ctx_vacio) is None


# ---------- Senal 14: monto atipico ----------
def test_signal_monto_proximo_a_suma(siniestro, poliza, proveedor):
    siniestro["monto_reclamado_usd"] = poliza["suma_asegurada_usd"] * 0.98
    result = signal_monto_atipico(siniestro, poliza, proveedor)
    assert result is not None and result["puntos"] == 4


def test_signal_monto_superior_promedio_proveedor(siniestro, poliza, proveedor):
    proveedor["monto_promedio_reclamado_usd"] = 1000.0
    siniestro["monto_reclamado_usd"] = 2000.0  # > 1.5x
    result = signal_monto_atipico(siniestro, poliza, proveedor)
    assert result is not None and result["puntos"] == 4


def test_signal_monto_normal(siniestro, poliza, proveedor):
    assert signal_monto_atipico(siniestro, poliza, proveedor) is None
