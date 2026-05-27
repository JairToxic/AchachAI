"""Motor de reglas y senales para detectar posibles fraudes en siniestros.

Implementacion literal del documento del reto Aseguradora del Sur:
- 7 reglas criticas RF-01..RF-07 (semaforo rojo/amarillo automatico).
- 14 senales puntuadas (suman al score 0..100).
- Score hibrido: si hay regla critica activa, override del semaforo.

API publica:
    from src.rules import evaluate_siniestro, Contexto, build_contexto

Ver docs/reglas_negocio.md para la especificacion completa.
"""

from src.rules.contexto import Contexto, build_contexto
from src.rules.fraud_rules import evaluate_siniestro

__all__ = ["evaluate_siniestro", "Contexto", "build_contexto"]
