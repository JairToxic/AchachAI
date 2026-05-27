"""Las 7 reglas criticas del reto (PDF seccion 8).

Cuando alguna se activa, fuerzan el semaforo (ROJO para RF-01..04, AMARILLO
para RF-05..07) independiente del score numerico de las senales.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from src.rules.contexto import Contexto


ROJO = "ROJO"
AMARILLO = "AMARILLO"


def _date(value: str | None) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


# ----------------- RF-01: Cobertura Perdida Total por Robo (PTxRB) -----------------
def rf01_ptxrb(siniestro: dict, poliza: dict) -> dict | None:
    """cobertura=Robo AND estado in (Pago Total, Liquidado) AND
    monto_pagado >= 95% suma_asegurada.
    """
    if siniestro.get("cobertura") != "Robo":
        return None
    if siniestro.get("estado") not in ("Pago Total", "Liquidado"):
        return None
    pagado = float(siniestro.get("monto_pagado_usd", 0))
    suma = float(poliza.get("suma_asegurada_usd", 0) or 0)
    if suma > 0 and pagado >= 0.95 * suma:
        return {
            "codigo": "RF-01", "nombre": "Cobertura Perdida Total por Robo (PTxRB)",
            "clasificacion": ROJO,
            "evidencia": f"cobertura=Robo, estado={siniestro.get('estado')}, pagado={pagado:.0f} = {pagado/suma*100:.0f}% suma_asegurada",
        }
    return None


# ----------------- RF-02: Evidencia de Falsificacion o Adulteracion Documental Evidente -----------------
def rf02_falsificacion(siniestro: dict, documentos: list[dict]) -> dict | None:
    """Doc con inconsistencia_detectada=True en {Factura, Denuncia} O
    factura con fecha_emision anterior a la fecha del evento.
    """
    fecha_oc = _date(siniestro.get("fecha_ocurrencia"))
    for d in documentos:
        tipo = d.get("tipo_documento")
        if d.get("inconsistencia_detectada") and tipo in ("Factura", "Denuncia"):
            return {
                "codigo": "RF-02", "nombre": "Falsificacion o adulteracion documental evidente",
                "clasificacion": ROJO,
                "evidencia": f"Doc {d.get('id_documento')} tipo={tipo} marcado como inconsistente: {d.get('observacion','')}",
            }
        if tipo == "Factura":
            f_emi = _date(d.get("fecha_emision"))
            if fecha_oc and f_emi and f_emi < fecha_oc:
                return {
                    "codigo": "RF-02", "nombre": "Factura con fecha previa al evento",
                    "clasificacion": ROJO,
                    "evidencia": f"Factura {d.get('id_documento')} emitida {d.get('fecha_emision')} antes del evento {siniestro.get('fecha_ocurrencia')}",
                }
    return None


# ----------------- RF-03: Asegurado / Beneficiario / APS en Lista Restrictiva -----------------
def rf03_lista_restrictiva(proveedor: dict, ctx: Contexto) -> dict | None:
    """Coincidencia exacta de proveedor en lista restrictiva."""
    id_prov = proveedor.get("id_proveedor")
    if id_prov in ctx.proveedores_lista_restrictiva:
        return {
            "codigo": "RF-03", "nombre": "Beneficiario / Proveedor en Lista Restrictiva",
            "clasificacion": ROJO,
            "evidencia": f"Proveedor {id_prov} ({proveedor.get('nombre','?')}) en lista restrictiva",
        }
    return None


# ----------------- RF-04: Dinamica del Accidente Fisicamente Imposible -----------------
PATRONES_IMPOSIBLES = [
    "garaje cerrado", "estacionado dentro", "candado",
    "estaba apagado", "freno de mano",
    "no presenta marcas", "sin marcas en el lado",
    "5 km/h", "5km/h", "10 km/h",
    "taller no reporta",
]

def rf04_dinamica_imposible(siniestro: dict) -> dict | None:
    """Proxy textual del LLM: si la descripcion menciona patrones imposibles, ROJO.
    En produccion esto lo hace GPT-4o; aqui hacemos detection por keywords como fallback.
    """
    desc = (siniestro.get("descripcion") or "").lower()
    for pat in PATRONES_IMPOSIBLES:
        if pat in desc:
            return {
                "codigo": "RF-04", "nombre": "Dinamica del accidente fisicamente imposible",
                "clasificacion": ROJO,
                "evidencia": f"Descripcion contiene patron imposible: '{pat}'",
            }
    return None


# ----------------- RF-05: Siniestro Extremo al Borde de Vigencia (< 48 hrs) -----------------
def rf05_borde_vigencia(siniestro: dict) -> dict | None:
    """Siniestro ocurrido < 2 dias despues del inicio o antes del fin de poliza."""
    d_ini = abs(int(siniestro.get("dias_desde_inicio_poliza", 999)))
    d_fin = abs(int(siniestro.get("dias_desde_fin_poliza", 999)))
    d = min(d_ini, d_fin)
    if d < 2:
        return {
            "codigo": "RF-05", "nombre": "Siniestro al borde de vigencia (<48h)",
            "clasificacion": AMARILLO,
            "evidencia": f"min(dias_inicio={d_ini}, dias_fin={d_fin})={d} dias",
        }
    return None


# ----------------- RF-06: Demora Atipica en Denuncia de Robo (> 4 dias) -----------------
def rf06_demora_robo(siniestro: dict) -> dict | None:
    """Solo Robo, mas de 4 dias entre ocurrencia y reporte."""
    if siniestro.get("cobertura") != "Robo":
        return None
    d = int(siniestro.get("dias_entre_ocurrencia_reporte", 0))
    if d > 4:
        return {
            "codigo": "RF-06", "nombre": "Demora atipica en denuncia de robo",
            "clasificacion": AMARILLO,
            "evidencia": f"{d} dias entre ocurrencia y denuncia (umbral 4 dias)",
        }
    return None


# ----------------- RF-07: Narrativa Identica (Clonada) -----------------
def rf07_narrativa_clonada(siniestro: dict, ctx: Contexto) -> dict | None:
    """Similitud de embeddings > 0.90 con otra narrativa distinta."""
    sim = ctx.similitud_max_por_siniestro.get(siniestro.get("id_siniestro"), 0.0)
    if sim > 0.90:
        return {
            "codigo": "RF-07", "nombre": "Narrativa identica/clonada de otro reclamo",
            "clasificacion": AMARILLO,
            "evidencia": f"Similitud maxima de embeddings = {sim:.2%}",
        }
    return None


# ----------------- Orquestador -----------------
def evaluar_todas_reglas_criticas(
    siniestro: dict, poliza: dict, proveedor: dict,
    documentos: list[dict], ctx: Contexto,
) -> list[dict]:
    """Evalua las 7 reglas criticas y devuelve lista con las activadas."""
    activadas = []
    for r in [
        rf01_ptxrb(siniestro, poliza),
        rf02_falsificacion(siniestro, documentos),
        rf03_lista_restrictiva(proveedor, ctx),
        rf04_dinamica_imposible(siniestro),
        rf05_borde_vigencia(siniestro),
        rf06_demora_robo(siniestro),
        rf07_narrativa_clonada(siniestro, ctx),
    ]:
        if r is not None:
            activadas.append(r)
    return activadas
