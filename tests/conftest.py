"""Fixtures compartidos para tests."""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import pytest

# Asegurar que `src` es importable
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.rules.contexto import Contexto  # noqa: E402


def _siniestro_base() -> dict:
    """Caso de baseline: VERDE, ninguna senal activa."""
    return {
        "id_siniestro": "SIN-T0001",
        "id_poliza": "POL-T01",
        "id_asegurado": "ASE-T01",
        "id_vehiculo": "VEH-T01",
        "id_proveedor": "PRV-T01",
        "id_conductor": "CON-T01",
        "ramo": "Vehiculos",
        "cobertura": "Choque",
        "fecha_ocurrencia": "2025-06-15",
        "fecha_reporte": "2025-06-16",
        "monto_reclamado_usd": 3000.0,
        "monto_estimado_usd": 3000.0,
        "monto_pagado_usd": 0.0,
        "estado": "Reserva",
        "sucursal": "Quito",
        "ciudad_evento": "Quito",
        "descripcion": "Colision lateral menor en estacionamiento de centro comercial.",
        "documentos_completos": True,
        "tipo_beneficiario": "Taller",
        "dias_desde_inicio_poliza": 180,
        "dias_desde_fin_poliza": 185,
        "dias_entre_ocurrencia_reporte": 1,
        "historial_siniestros_asegurado": 0,
        "tuvo_parte_policial": True,
        "tuvo_testigo": False,
        "fault_responsable": "Asegurado",
        "etiqueta_fraude_simulada": 0,
    }


def _poliza_base() -> dict:
    return {
        "id_poliza": "POL-T01",
        "id_asegurado": "ASE-T01",
        "ramo": "Vehiculos",
        "fecha_inicio": "2024-12-01",
        "fecha_fin": "2025-12-01",
        "prima_usd": 600.0,
        "suma_asegurada_usd": 20000.0,
        "deducible_usd": 500.0,
        "canal_venta": "Web",
        "ciudad": "Quito",
        "estado_poliza": "Vigente",
        "tipo_cobertura": "Collision",
    }


def _proveedor_base(*, en_lista: bool = False) -> dict:
    return {
        "id_proveedor": "PRV-T01",
        "nombre": "Taller Test",
        "tipo": "Taller",
        "ciudad": "Quito",
        "antiguedad_anios": 5,
        "lista_restrictiva": en_lista,
        "reclamos_asociados": 10,
        "porcentaje_casos_observados": 0.0,
        "monto_promedio_reclamado_usd": 4000.0,
    }


def _docs_completos(id_sin: str = "SIN-T0001", fecha_oc: str = "2025-06-15") -> list[dict]:
    return [
        {"id_documento": "DOC-1", "id_siniestro": id_sin, "tipo_documento": "Factura",
         "entregado": True, "legible": True, "fecha_emision": "2025-06-20",
         "inconsistencia_detectada": False, "observacion": None},
        {"id_documento": "DOC-2", "id_siniestro": id_sin, "tipo_documento": "Foto",
         "entregado": True, "legible": True, "fecha_emision": "2025-06-16",
         "inconsistencia_detectada": False, "observacion": None},
        {"id_documento": "DOC-3", "id_siniestro": id_sin, "tipo_documento": "Denuncia",
         "entregado": True, "legible": True, "fecha_emision": "2025-06-17",
         "inconsistencia_detectada": False, "observacion": None},
    ]


def _ctx_vacio() -> Contexto:
    return Contexto(
        siniestros_por_asegurado_18m={},
        siniestros_por_vehiculo_18m={},
        siniestros_por_conductor_18m={},
        siniestros_rc_por_asegurado={},
        casos_anuales_por_proveedor={},
        similitud_max_por_siniestro={},
        proveedores_lista_restrictiva=set(),
        fecha_referencia=datetime(2025, 12, 31),
    )


@pytest.fixture
def siniestro():
    return _siniestro_base()


@pytest.fixture
def poliza():
    return _poliza_base()


@pytest.fixture
def proveedor():
    return _proveedor_base()


@pytest.fixture
def proveedor_lista():
    return _proveedor_base(en_lista=True)


@pytest.fixture
def docs():
    return _docs_completos()


@pytest.fixture
def ctx_vacio():
    return _ctx_vacio()
