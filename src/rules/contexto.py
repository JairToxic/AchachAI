"""Contexto agregado del dataset, precomputado una sola vez para que
las reglas y senales puedan ejecutarse en O(1) por siniestro evaluado.

Contiene contadores y agregaciones que requieren mirar el historico completo:
- conteo de siniestros por asegurado/vehiculo/conductor (ultimos 18m)
- conteo de siniestros previos solo-RC por asegurado
- conteo de casos observados por proveedor en el ano
- embeddings de narrativas (para senal 13 y RF-07)

Se construye desde los DataFrames normalizados (siniestros + relaciones).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import pandas as pd


@dataclass
class Contexto:
    """Agregaciones precomputadas sobre el dataset completo."""

    # Conteos por entidad en los ultimos 18 meses
    siniestros_por_asegurado_18m: dict[str, int] = field(default_factory=dict)
    siniestros_por_vehiculo_18m: dict[str, int] = field(default_factory=dict)
    siniestros_por_conductor_18m: dict[str, int] = field(default_factory=dict)

    # Conteo de siniestros previos solo-RC por asegurado (para senal 6)
    siniestros_rc_por_asegurado: dict[str, int] = field(default_factory=dict)

    # Proveedores: cuantos casos del ano actual estan asociados
    casos_anuales_por_proveedor: dict[str, int] = field(default_factory=dict)

    # Umbral dinamico (P90) de casos/ano por proveedor. Se considera "recurrente" si lo supera.
    umbral_recurrencia_proveedor: int = 2

    # Para senal 13 / RF-07: similitudes textuales precomputadas
    # {id_siniestro: similitud_maxima (0..1)}
    similitud_max_por_siniestro: dict[str, float] = field(default_factory=dict)

    # Indice rapido de proveedores en lista restrictiva
    proveedores_lista_restrictiva: set[str] = field(default_factory=set)

    # Fecha de referencia (para ventana de 18 meses y casos del ano)
    fecha_referencia: Optional[datetime] = None


def _contar_recientes(df: pd.DataFrame, fecha_col: str, key_col: str,
                       fecha_ref: pd.Timestamp, meses: int = 18) -> dict[str, int]:
    """Conteo por key_col de filas con fecha_col en los ultimos N meses respecto a fecha_ref."""
    fechas = pd.to_datetime(df[fecha_col], errors="coerce")
    limite = fecha_ref - pd.DateOffset(months=meses)
    sub = df[(fechas >= limite) & (fechas <= fecha_ref)]
    return sub.groupby(key_col).size().to_dict()


def build_contexto(
    siniestros: pd.DataFrame,
    proveedores: pd.DataFrame,
    *,
    fecha_referencia: Optional[pd.Timestamp] = None,
    similitudes: Optional[dict[str, float]] = None,
) -> Contexto:
    """Construye el Contexto a partir de las tablas normalizadas.

    Args:
        siniestros: tabla siniestros.parquet
        proveedores: tabla proveedores.parquet
        fecha_referencia: fecha "actual" para la ventana de 18 meses
            (default: max(fecha_ocurrencia) en el dataset).
        similitudes: dict {id_siniestro: similitud_maxima 0..1} si ya se
            calcularon embeddings; default todo en 0.
    """
    s = siniestros.copy()
    s["fecha_ocurrencia_dt"] = pd.to_datetime(s["fecha_ocurrencia"], errors="coerce")

    if fecha_referencia is None:
        fecha_referencia = s["fecha_ocurrencia_dt"].max()
    fecha_referencia = pd.Timestamp(fecha_referencia)

    # Conteos 18 meses
    sin_asegurado = _contar_recientes(s, "fecha_ocurrencia_dt", "id_asegurado", fecha_referencia)
    sin_vehiculo  = _contar_recientes(s, "fecha_ocurrencia_dt", "id_vehiculo",  fecha_referencia)
    sin_conductor = _contar_recientes(s, "fecha_ocurrencia_dt", "id_conductor", fecha_referencia)

    # Senal 6: siniestros solo-RC por asegurado
    rc_only = s[s["cobertura"] == "Responsabilidad Civil"]
    sin_rc = rc_only.groupby("id_asegurado").size().to_dict()

    # Casos anuales por proveedor
    inicio_ano = fecha_referencia.replace(month=1, day=1)
    anio = s[(s["fecha_ocurrencia_dt"] >= inicio_ano) & (s["fecha_ocurrencia_dt"] <= fecha_referencia)]
    casos_prov = anio.groupby("id_proveedor").size().to_dict()
    # Umbral dinamico: P90 del ano (un proveedor es "recurrente" si esta entre el top 10%)
    if casos_prov:
        umbral = max(2, int(pd.Series(list(casos_prov.values())).quantile(0.90)))
    else:
        umbral = 2

    # Proveedores en lista restrictiva
    lista_rest = set(proveedores[proveedores["lista_restrictiva"]]["id_proveedor"].tolist())

    # Similitudes
    sims = similitudes or {sid: 0.0 for sid in s["id_siniestro"]}

    return Contexto(
        siniestros_por_asegurado_18m=sin_asegurado,
        siniestros_por_vehiculo_18m=sin_vehiculo,
        siniestros_por_conductor_18m=sin_conductor,
        siniestros_rc_por_asegurado=sin_rc,
        casos_anuales_por_proveedor=casos_prov,
        umbral_recurrencia_proveedor=umbral,
        similitud_max_por_siniestro=sims,
        proveedores_lista_restrictiva=lista_rest,
        fecha_referencia=fecha_referencia.to_pydatetime(),
    )
