"""Calculo del score 0..100 y asignacion de semaforo.

Combina senales (suman) + reglas criticas (override del semaforo).

Niveles segun el PDF (seccion 13):
  0..40  -> Verde Bajo  -> continuar flujo normal
  41..75 -> Amarillo Medio -> Unidad Antifraude revision documental
  76..100 -> Rojo Alto -> Unidad Antifraude revision especializada de campo

Override del semaforo cuando hay reglas criticas:
  - RF-01..04 activas -> fuerza ROJO (score minimo 76)
  - RF-05..07 activas -> fuerza al menos AMARILLO (score minimo 41)
"""
from __future__ import annotations

ROJO = "ROJO"
AMARILLO = "AMARILLO"
VERDE = "VERDE"

REGLAS_ROJAS = {"RF-01", "RF-02", "RF-03", "RF-04"}
REGLAS_AMARILLAS = {"RF-05", "RF-06", "RF-07"}


def calcular_score(senales: list[dict], reglas_criticas: list[dict]) -> tuple[int, str]:
    """Devuelve (score_int, nivel_string).

    Score base = suma de puntos de senales (capped a 100).
    Override:
      - Si hay regla roja: nivel=ROJO y score>=76
      - Si hay regla amarilla: nivel=AMARILLO si no era ROJO, score>=41
    """
    score = sum(s.get("puntos", 0) for s in senales)
    score = max(0, min(score, 100))

    codigos = {r.get("codigo") for r in reglas_criticas}

    if codigos & REGLAS_ROJAS:
        score = max(score, 76)
        nivel = ROJO
    elif codigos & REGLAS_AMARILLAS:
        score = max(score, 41)
        nivel = AMARILLO
    elif score >= 76:
        nivel = ROJO
    elif score >= 41:
        nivel = AMARILLO
    else:
        nivel = VERDE

    return int(score), nivel
