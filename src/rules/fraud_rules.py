"""Motor principal de evaluacion: orquesta senales + reglas criticas + scoring.

API publica de mas alto nivel:
    evaluate_siniestro(siniestro, poliza, asegurado, vehiculo, proveedor,
                       conductor, documentos, ctx) -> dict

Retorna:
{
    "id_siniestro": str,
    "score": int (0..100),
    "nivel": "VERDE" | "AMARILLO" | "ROJO",
    "reglas_criticas": [ {codigo, nombre, clasificacion, evidencia}, ... ],
    "senales_activadas": [ {id, nombre, puntos, evidencia}, ... ],
    "puntos_totales_senales": int,
    "explicacion_corta": str,  # 1 oracion lista para mostrar en UI
}
"""
from __future__ import annotations

from src.rules.contexto import Contexto
from src.rules.critical_rules import evaluar_todas_reglas_criticas
from src.rules.scoring import calcular_score
from src.rules.signals import evaluar_todas_senales


def evaluate_siniestro(
    *,
    siniestro: dict,
    poliza: dict,
    asegurado: dict,
    vehiculo: dict | None = None,
    proveedor: dict,
    conductor: dict | None = None,
    documentos: list[dict] | None = None,
    ctx: Contexto,
) -> dict:
    """Evalua un siniestro y devuelve score + reglas + senales + explicacion."""
    documentos = documentos or []

    senales = evaluar_todas_senales(siniestro, poliza, proveedor, documentos, ctx)
    reglas = evaluar_todas_reglas_criticas(siniestro, poliza, proveedor, documentos, ctx)
    score, nivel = calcular_score(senales, reglas)

    return {
        "id_siniestro": siniestro.get("id_siniestro"),
        "score": score,
        "nivel": nivel,
        "reglas_criticas": reglas,
        "senales_activadas": senales,
        "puntos_totales_senales": sum(s["puntos"] for s in senales),
        "explicacion_corta": _explicacion_corta(score, nivel, reglas, senales),
    }


def _explicacion_corta(score: int, nivel: str, reglas: list[dict], senales: list[dict]) -> str:
    """Genera 1-2 oraciones explicando el score, sin acusar."""
    if not reglas and not senales:
        return f"Sin senales de riesgo detectadas (score {score}/100, nivel {nivel})."

    partes = []
    if reglas:
        codigos = ", ".join(r["codigo"] for r in reglas[:3])
        partes.append(f"Regla(s) critica(s) activada(s): {codigos}")
    if senales:
        top = sorted(senales, key=lambda s: -s["puntos"])[:3]
        nombres = "; ".join(f"{s['nombre']} ({s['puntos']}pts)" for s in top)
        partes.append(f"Senales principales: {nombres}")

    return (f"Score {score}/100 (nivel {nivel}). "
            + ". ".join(partes) + ". Requiere revision por analista antifraude.")
