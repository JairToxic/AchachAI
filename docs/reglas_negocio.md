# Reglas de negocio y señales de fraude

> Implementación literal de las **7 reglas críticas (RF-01..07)** y las **14 señales puntuadas** que define el documento del reto (secciones 7 y 8).

## 1. Score y semáforo

| Rango | Nivel | Acción sugerida |
|-------|-------|-----------------|
| 0 – 40 | 🟢 Verde Bajo | Continuar flujo normal |
| 41 – 75 | 🟡 Amarillo Medio | Escala a Unidad Antifraude — revisión documental |
| 76 – 100 | 🔴 Rojo Alto | Escala a Unidad Antifraude — revisión especializada de campo |

El score final se calcula así:

```
score_reglas   = sum(puntos de las 14 señales activadas)   # 0..N
score_modelo   = probabilidad XGBoost * 100                 # 0..100
score_híbrido  = 0.6 * normalizar(score_reglas, 0, 100)
               + 0.4 * score_modelo

# Las reglas críticas RF-01..04 fuerzan ROJO independiente del score
if alguna RF-01..04 activada → nivel = ROJO (score >= 76)
if alguna RF-05..07 activada → nivel mínimo AMARILLO
```

## 2. Reglas críticas (RF-01..07)

| Código | Regla | Clasif. | Cómo se detecta en código |
|--------|-------|---------|---------------------------|
| **RF-01** | Cobertura Pérdida Total por Robo (PTxRB) | 🔴 Rojo | `cobertura == "Robo"` AND `estado in ["Pago Total","Liquidado"]` AND `monto_pagado_usd >= 0.95 * suma_asegurada_usd` |
| **RF-02** | Evidencia de Falsificación o Adulteración Documental Evidente | 🔴 Rojo | Algún documento con `inconsistencia_detectada = True` AND `tipo_documento in ["Factura","Denuncia"]` |
| **RF-03** | Asegurado, Beneficiario o APS coincide con Lista Restrictiva | 🔴 Rojo | `proveedor.lista_restrictiva = True` OR `asegurado en lista_restrictiva` |
| **RF-04** | Dinámica del Accidente Físicamente Imposible | 🔴 Rojo | Análisis LLM sobre `descripcion` que detecte incoherencia (ej: "colisión frontal estando estacionado") |
| **RF-05** | Siniestro Extremo al Borde de Vigencia (< 48 hrs) | 🟡 Amarillo | `dias_desde_inicio_poliza < 2` OR `dias_desde_fin_poliza < 2` |
| **RF-06** | Demora Atípica en Denuncia de Robo (> 4 días) | 🟡 Amarillo | `cobertura == "Robo"` AND `dias_entre_ocurrencia_reporte > 4` |
| **RF-07** | Narrativa Idéntica (Clonada) | 🟡 Amarillo | Similitud coseno embeddings `> 0.90` con otro reclamo distinto |

## 3. Señales puntuadas (14)

| # | Señal | Detección | Puntos |
|---|-------|-----------|--------|
| 1 | Reclamo cercano al borde de vigencia | `min(dias_desde_inicio_poliza, dias_desde_fin_poliza)` | ≤10d → 8, 11-30d → 4, >30d → 0 |
| 2 | Demora denuncia por robo | `cobertura=="Robo"` AND `dias_entre_ocurrencia_reporte` (en horas) | >48h → 8, 24-48h → 4, <24h → 0 |
| 3 | Alta frecuencia de reclamos Asegurado | `historial_siniestros_asegurado` (últimos 18m) | ≥3 → 8, 2 → 4, 0-1 → 0 |
| 4 | Alta frecuencia de reclamos Vehículo | Conteo de siniestros del `id_vehiculo` últimos 18m | ≥3 → 6, 2 → 3, 0-1 → 0 |
| 5 | Alta frecuencia conductor | Conteo de siniestros del `id_conductor` últimos 18m | ≥3 → 8, 2 → 4, 0-1 → 0 |
| 6 | Alta frecuencia reclamos solo RC | Conteo previos con `cobertura == "Responsabilidad Civil"` | >2 → 6, 1 → 3, 0 → 0 |
| 7 | Beneficiario / Proveedor recurrente | `lista_restrictiva` OR conteo casos observados | Lista restrictiva → 10, >2 casos obs. año → 5 |
| 8 | Documentos incompletos | Falta documento legal obligatorio (denuncia/factura) | Falta → 4 |
| 9 | Dinámica sospechosa | NLP sobre `descripcion` + heurísticas tipo accidente | Relato ilógico → 6, accidente múltiple madrugada → 3 |
| 10 | Eventos sin tercero identificado | `fault_responsable in ["Tercero","Compartido"]` AND `tuvo_parte_policial == False` AND `monto_reclamado_usd alto` | Daño severo sin rastro → 5 |
| 11 | Documentos inconsistentes | `documentos.inconsistencia_detectada = True` OR fecha factura < fecha evento | Alteración / fecha inválida → 10 |
| 12 | Reporte tardío | `dias_entre_ocurrencia_reporte` | >7d → 5, 4-7d → 3, ≤3d → 0 |
| 13 | Narrativas similares | Embedding similarity sobre `descripcion` | >85% → 8, 70-84% → 4 |
| 14 | Monto cercano o superior a suma asegurada | `monto_reclamado_usd / suma_asegurada_usd` | >0.95 OR >1.5x promedio → 4 |

**Máximo teórico**: 100 pts (los pesos suman exactamente 100 — coherente con el rango del score).

## 4. Estructura de salida (cada siniestro)

```json
{
  "id_siniestro": "SIN-000123",
  "score": 82,
  "nivel": "ROJO",
  "reglas_criticas": [
    {"codigo": "RF-01", "descripcion": "Pérdida total por robo", "clasificacion": "ROJO"}
  ],
  "senales_activadas": [
    {"id": 1, "nombre": "Reclamo cercano al borde de vigencia", "puntos": 8, "evidencia": "dias_desde_inicio_poliza=3"},
    {"id": 7, "nombre": "Proveedor recurrente", "puntos": 10, "evidencia": "Proveedor PRV-0019 en lista restrictiva"}
  ],
  "modelo_ml": {
    "prob_fraude": 0.81,
    "top_features": [
      {"feature": "monto_reclamado_usd", "shap": 0.34},
      {"feature": "dias_desde_inicio_poliza", "shap": 0.22}
    ]
  },
  "explicacion_lenguaje_natural": "Este siniestro presenta tres factores que lo elevan a riesgo alto: ..."
}
```

## 5. Pruebas (`tests/test_rules.py`)

Cada regla y cada señal debe tener al menos un test con un caso positivo y uno negativo. Esto garantiza trazabilidad y que el motor es determinístico.
