"""Las 14 senales puntuadas del reto (PDF seccion 7).

Cada senal es una funcion pura que recibe los datos del caso y devuelve
una lista de dicts {nombre, puntos, evidencia} con todos los matches.

Las senales SUMAN al score (max teorico = 100 pts).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from src.rules.contexto import Contexto


def _date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


# ----------------- Senal 1: Reclamo cercano al borde de vigencia -----------------
def signal_borde_vigencia(siniestro: dict) -> dict | None:
    """<=10d -> 8pts, 11-30d -> 4pts, >30d -> 0pts.
    Se considera el minimo entre dias_desde_inicio y dias_desde_fin de poliza.
    """
    d_ini = siniestro.get("dias_desde_inicio_poliza", 999)
    d_fin = siniestro.get("dias_desde_fin_poliza", 999)
    d = min(abs(int(d_ini)), abs(int(d_fin)))
    if d <= 10:
        pts = 8
    elif d <= 30:
        pts = 4
    else:
        return None
    return {"id": 1, "nombre": "Reclamo cercano al borde de vigencia",
            "puntos": pts, "evidencia": f"min(dias_inicio={d_ini}, dias_fin={d_fin})={d}d"}


# ----------------- Senal 2: Demora denuncia por robo -----------------
def signal_demora_denuncia_robo(siniestro: dict) -> dict | None:
    """Solo aplica a Robo. >48h -> 8pts, 24-48h -> 4pts, <24h -> 0pts."""
    if siniestro.get("cobertura") != "Robo":
        return None
    dias = int(siniestro.get("dias_entre_ocurrencia_reporte", 0))
    horas = dias * 24
    if horas > 48:
        pts = 8
    elif horas >= 24:
        pts = 4
    else:
        return None
    return {"id": 2, "nombre": "Demora en denuncia por robo",
            "puntos": pts, "evidencia": f"{dias} dias = {horas}h entre ocurrencia y reporte"}


# ----------------- Senal 3: Alta frecuencia de reclamos del asegurado -----------------
def signal_freq_asegurado(siniestro: dict, ctx: Contexto) -> dict | None:
    """>=3 -> 8pts, 2 -> 4pts."""
    n = ctx.siniestros_por_asegurado_18m.get(siniestro.get("id_asegurado"), 0)
    if n >= 3:
        pts = 8
    elif n == 2:
        pts = 4
    else:
        return None
    return {"id": 3, "nombre": "Alta frecuencia de reclamos del asegurado (18m)",
            "puntos": pts, "evidencia": f"{n} siniestros del asegurado en 18m"}


# ----------------- Senal 4: Alta frecuencia de reclamos del vehiculo -----------------
def signal_freq_vehiculo(siniestro: dict, ctx: Contexto) -> dict | None:
    """>=3 -> 6pts, 2 -> 3pts."""
    n = ctx.siniestros_por_vehiculo_18m.get(siniestro.get("id_vehiculo"), 0)
    if n >= 3:
        pts = 6
    elif n == 2:
        pts = 3
    else:
        return None
    return {"id": 4, "nombre": "Alta frecuencia de reclamos del vehiculo (18m)",
            "puntos": pts, "evidencia": f"{n} siniestros del vehiculo en 18m"}


# ----------------- Senal 5: Alta frecuencia del conductor -----------------
def signal_freq_conductor(siniestro: dict, ctx: Contexto) -> dict | None:
    """>=3 -> 8pts, 2 -> 4pts."""
    n = ctx.siniestros_por_conductor_18m.get(siniestro.get("id_conductor"), 0)
    if n >= 3:
        pts = 8
    elif n == 2:
        pts = 4
    else:
        return None
    return {"id": 5, "nombre": "Alta frecuencia de reclamos del conductor (18m)",
            "puntos": pts, "evidencia": f"{n} siniestros del conductor en 18m"}


# ----------------- Senal 6: Alta frecuencia reclamos solo RC -----------------
def signal_freq_solo_rc(siniestro: dict, ctx: Contexto) -> dict | None:
    """>2 RC previos -> 6pts, 1 RC previo -> 3pts. Solo cuenta si actual es RC."""
    if siniestro.get("cobertura") != "Responsabilidad Civil":
        return None
    # Restamos 1 porque el conteo incluye el siniestro actual
    n_previos = max(0, ctx.siniestros_rc_por_asegurado.get(siniestro.get("id_asegurado"), 0) - 1)
    if n_previos > 2:
        pts = 6
    elif n_previos == 1 or n_previos == 2:
        pts = 3
    else:
        return None
    return {"id": 6, "nombre": "Alta frecuencia de reclamos solo RC",
            "puntos": pts, "evidencia": f"{n_previos} eventos previos solo-RC del asegurado"}


# ----------------- Senal 7: Beneficiario / Proveedor recurrente -----------------
def signal_proveedor_recurrente(proveedor: dict, ctx: Contexto) -> dict | None:
    """En lista restrictiva -> 10pts. Casos > umbral dinamico (P90 del ano) -> 5pts.

    El umbral dinamico evita falsos positivos cuando hay pocos proveedores con mucho
    volumen. Solo dispara si el proveedor esta efectivamente en el top 10% por volumen.
    """
    id_prov = proveedor.get("id_proveedor")
    if id_prov in ctx.proveedores_lista_restrictiva:
        return {"id": 7, "nombre": "Proveedor en Lista Restrictiva",
                "puntos": 10, "evidencia": f"Proveedor {id_prov} en lista_restrictiva"}
    casos = ctx.casos_anuales_por_proveedor.get(id_prov, 0)
    if casos > ctx.umbral_recurrencia_proveedor:
        return {"id": 7, "nombre": "Proveedor recurrente (top 10% del ano)",
                "puntos": 5, "evidencia": f"{casos} casos asociados (umbral P90={ctx.umbral_recurrencia_proveedor})"}
    return None


# ----------------- Senal 8: Documentos incompletos -----------------
DOCS_OBLIGATORIOS = {"Denuncia", "Factura"}

def signal_documentos_incompletos(documentos: list[dict]) -> dict | None:
    """Falta documento legal obligatorio (Denuncia o Factura) -> 4pts."""
    tipos_entregados = {d["tipo_documento"] for d in documentos if d.get("entregado")}
    faltantes = DOCS_OBLIGATORIOS - tipos_entregados
    if faltantes:
        return {"id": 8, "nombre": "Documentos obligatorios incompletos",
                "puntos": 4, "evidencia": f"Falta(n) documento(s): {sorted(faltantes)}"}
    return None


# ----------------- Senal 9: Dinamica sospechosa -----------------
PALABRAS_IMPOSIBLES = [
    "garaje cerrado", "estacionado dentro", "apagado", "freno de mano",
    "sin marcas", "5 km/h", "5km/h", "sin testigos", "sin parte policial",
    "sin camaras", "3am", "4am", "5am", "sin que nadie",
]

def signal_dinamica_sospechosa(siniestro: dict) -> dict | None:
    """Relato ilogico vs tipo de impacto -> 6pts.
    Accidente multiple de madrugada -> 3pts.
    Detectado por palabras clave en descripcion (proxy del LLM en produccion).
    """
    desc = (siniestro.get("descripcion") or "").lower()
    matches = [w for w in PALABRAS_IMPOSIBLES if w in desc]
    if any(w in desc for w in ["garaje cerrado", "estacionado dentro", "apagado", "freno de mano",
                                "sin marcas", "5 km/h", "5km/h"]):
        return {"id": 9, "nombre": "Dinamica del accidente sospechosa",
                "puntos": 6, "evidencia": f"Relato sospechoso: {matches[:3]}"}
    if any(w in desc for w in ["3am", "4am", "5am", "madrugada"]) and any(
        w in desc for w in ["multiple", "3 vehiculos", "varios vehiculos"]
    ):
        return {"id": 9, "nombre": "Accidente multiple de madrugada",
                "puntos": 3, "evidencia": "Multiple vehiculos en horario de madrugada"}
    return None


# ----------------- Senal 10: Eventos sin tercero identificado -----------------
def signal_sin_tercero(siniestro: dict, poliza: dict) -> dict | None:
    """Dano severo (>30% suma asegurada) sin parte policial cuando hay tercero -> 5pts."""
    fault = siniestro.get("fault_responsable")
    if fault not in ("Tercero", "Compartido"):
        return None
    if siniestro.get("tuvo_parte_policial"):
        return None
    monto = float(siniestro.get("monto_reclamado_usd", 0))
    suma = float(poliza.get("suma_asegurada_usd", 1))
    if suma > 0 and monto / suma >= 0.30:
        return {"id": 10, "nombre": "Dano severo sin tercero identificado ni parte policial",
                "puntos": 5, "evidencia": f"reclamado={monto:.0f} = {monto/suma*100:.0f}% suma, sin parte policial, fault={fault}"}
    return None


# ----------------- Senal 11: Documentos inconsistentes -----------------
def signal_documentos_inconsistentes(siniestro: dict, documentos: list[dict]) -> dict | None:
    """Cualquier doc con inconsistencia_detectada=True -> 10pts.
    O factura con fecha_emision previa a fecha_ocurrencia -> 10pts.
    """
    fecha_oc = _date(siniestro.get("fecha_ocurrencia"))
    for d in documentos:
        if d.get("inconsistencia_detectada"):
            return {"id": 11, "nombre": "Documentos inconsistentes / alteracion",
                    "puntos": 10, "evidencia": f"Doc {d.get('id_documento')} ({d.get('tipo_documento')}): {d.get('observacion','inconsistencia')}"}
        if d.get("tipo_documento") == "Factura":
            f_emi = _date(d.get("fecha_emision"))
            if fecha_oc and f_emi and f_emi < fecha_oc:
                return {"id": 11, "nombre": "Factura con fecha previa al evento",
                        "puntos": 10, "evidencia": f"Factura {d.get('id_documento')} fechada {d.get('fecha_emision')} < ocurrencia {siniestro.get('fecha_ocurrencia')}"}
    return None


# ----------------- Senal 12: Reporte tardio -----------------
def signal_reporte_tardio(siniestro: dict) -> dict | None:
    """>7d -> 5pts, 4-7d -> 3pts, <=3d -> 0pts. NO aplica a Robo (lo cubre senal 2)."""
    if siniestro.get("cobertura") == "Robo":
        return None
    d = int(siniestro.get("dias_entre_ocurrencia_reporte", 0))
    if d > 7:
        pts = 5
    elif d >= 4:
        pts = 3
    else:
        return None
    return {"id": 12, "nombre": "Reporte tardio del siniestro",
            "puntos": pts, "evidencia": f"{d} dias entre ocurrencia y reporte"}


# ----------------- Senal 13: Narrativas similares -----------------
def signal_narrativas_similares(siniestro: dict, ctx: Contexto) -> dict | None:
    """Similitud >85% -> 8pts, 70-84% -> 4pts. Requiere embeddings precomputados."""
    sim = ctx.similitud_max_por_siniestro.get(siniestro.get("id_siniestro"), 0.0)
    if sim > 0.85:
        pts = 8
    elif sim >= 0.70:
        pts = 4
    else:
        return None
    return {"id": 13, "nombre": "Narrativa similar a otro reclamo",
            "puntos": pts, "evidencia": f"Similitud maxima de embeddings = {sim:.2%}"}


# ----------------- Senal 14: Monto cercano o superior a suma asegurada -----------------
def signal_monto_atipico(siniestro: dict, poliza: dict, proveedor: dict) -> dict | None:
    """Reclamado >95% suma asegurada OR >150% promedio del proveedor -> 4pts."""
    monto = float(siniestro.get("monto_reclamado_usd", 0))
    suma = float(poliza.get("suma_asegurada_usd", 1) or 1)
    promedio_prov = float(proveedor.get("monto_promedio_reclamado_usd", 0) or 0)
    ratio = monto / suma
    if ratio > 0.95:
        return {"id": 14, "nombre": "Monto reclamado proximo a suma asegurada",
                "puntos": 4, "evidencia": f"reclamado={monto:.0f} = {ratio*100:.0f}% suma asegurada"}
    if promedio_prov > 0 and monto > promedio_prov * 1.5:
        return {"id": 14, "nombre": "Monto reclamado muy superior al promedio del proveedor",
                "puntos": 4, "evidencia": f"reclamado={monto:.0f}, promedio_prov={promedio_prov:.0f}, ratio={monto/promedio_prov:.1f}x"}
    return None


# ----------------- Catalogo y orquestador -----------------
def evaluar_todas_senales(
    siniestro: dict,
    poliza: dict,
    proveedor: dict,
    documentos: list[dict],
    ctx: Contexto,
) -> list[dict]:
    """Ejecuta las 14 senales y devuelve lista con las activadas (puntos > 0)."""
    activadas = []
    for s in [
        signal_borde_vigencia(siniestro),
        signal_demora_denuncia_robo(siniestro),
        signal_freq_asegurado(siniestro, ctx),
        signal_freq_vehiculo(siniestro, ctx),
        signal_freq_conductor(siniestro, ctx),
        signal_freq_solo_rc(siniestro, ctx),
        signal_proveedor_recurrente(proveedor, ctx),
        signal_documentos_incompletos(documentos),
        signal_dinamica_sospechosa(siniestro),
        signal_sin_tercero(siniestro, poliza),
        signal_documentos_inconsistentes(siniestro, documentos),
        signal_reporte_tardio(siniestro),
        signal_narrativas_similares(siniestro, ctx),
        signal_monto_atipico(siniestro, poliza, proveedor),
    ]:
        if s is not None and s["puntos"] > 0:
            activadas.append(s)
    return activadas
