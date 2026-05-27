# Model Card — `achachai-fraude-xgb` v2

> Tarjeta de modelo siguiendo el estándar Mitchell et al. (2019). Documenta el modelo
> XGBoost que asigna probabilidad de posible fraude a siniestros vehiculares.

## 1. Información del modelo

| Atributo | Valor |
|----------|-------|
| **Nombre** | `achachai-fraude-xgb` |
| **Versión** | v2 |
| **Tipo** | Clasificación binaria supervisada |
| **Algoritmo** | XGBoost (Extreme Gradient Boosting) |
| **Tarea** | Predecir probabilidad de que un siniestro sea posible fraude |
| **Registrado en** | Azure Machine Learning workspace `mlw-achachai` (eastus2) |
| **Endpoint URL** | `https://achachai-fraud.eastus2.inference.ml.azure.com/score` |
| **Entrenado el** | 2026-05-26 |
| **Autor** | Equipo AchachAI - hackIAthon 2026 |

## 2. Datos de entrenamiento (extendido)

| Concepto | Valor |
|----------|-------|
| **Origen** | Dataset sintético generado por el equipo (no PII real) |
| **Total filas** | **25.460 siniestros** (15.420 originales + 10.000 nuevos diversos + 40 críticos inyectados) |
| **Ramo cubierto** | Vehículos (único, por scope del prototipo) |
| **Distribución target** | ~9.5% positivos (fraude correlacionado con patrones: lista_restrictiva, PTxRB, docs incompletos, etc.) |
| **Proveedores** | **198** (vs 48 en v2): mayor diversidad y patrones más realistas |
| **Templates de descripción** | **50+** diferentes (resuelve problema de embeddings homogéneos) |
| **Split** | 80% train (20.368) / 20% test (5.092), estratificado |
| **Features finales** | 79 |
| **Balanceo** | `scale_pos_weight = 9.48` (auto-calculado del nuevo dataset) |

## 3. Hyperparámetros

| Parámetro | Valor |
|-----------|-------|
| `n_estimators` | 400 |
| `max_depth` | 6 |
| `learning_rate` | 0.05 |
| `subsample` | 0.85 |
| `colsample_bytree` | 0.85 |
| `objective` | `binary:logistic` |
| `eval_metric` | `aucpr` |
| `tree_method` | `hist` |
| `random_state` | 42 |

## 4. Métricas de evaluación (test set 5.092 filas) — v4 FINAL

### Globales (no dependen de threshold)

| Métrica | Valor | Objetivo reto | ¿Cumple? |
|---------|-------|---------------|----------|
| **AUC-ROC** | **0.961** | ≥ 0.85 | ✅✅ excede |
| **PR-AUC** | **0.811** | ≥ 0.60 | ✅✅ excede |
| **Prob media en inyectados** | 0.948 | — | ✅ |
| **% inyectados con prob ≥ 0.5** | **100%** | — | ✅✅ |

### Por threshold (configurable según prioridad de negocio)

| Threshold | Precision | Recall | F1 | Uso recomendado |
|-----------|-----------|--------|-----|-----------------|
| **0.30** (recall-priority) | 0.46 | **0.88** | 0.60 | Sospecha alta — UAF |
| **0.50** (default) | 0.61 | **0.79** | 0.69 | Operación normal |
| **0.77** (F1-optimal) | **0.81** | 0.66 | **0.73** | Reportes ejecutivos |

### Matriz de confusión (threshold 0.5 default)

|              | Pred. NO fraude | Pred. POSIBLE fraude |
|--------------|-----------------|----------------------|
| **Real NO**  | 4358 (TN)       | 248 (FP)             |
| **Real SÍ**  | 101 (FN)        | 385 (TP)             |

### Evolución del modelo

| Versión | Filas | Features | AUC-ROC | Recall | PR-AUC | Mejora vs anterior |
|---------|-------|----------|---------|--------|--------|---------------------|
| v1 | 15.420 | 60 | — | — | — | baseline |
| v2 | 15.460 | 75 | 0.94 | 0.57 | 0.64 | + 40 casos inyectados |
| v3 | 25.460 | 79 | 0.88 | 0.61 | 0.55 | + 10K filas diversas |
| **v4** | **25.460** | **92** | **0.96** | **0.79** | **0.81** | **+ 16 features avanzadas (LOO) + Optuna + threshold tuning** |

> El recall pasó de 0.57 a 0.79 (+22pp) y PR-AUC de 0.64 a 0.81 (+17pp) gracias a:
> - **16 features avanzadas**: tasa_fraude historica (leave-one-out), velocidad reclamo, es_borde_vigencia, es_ptxrb_candidato, es_reporte_tardio, edad_vehiculo, ratios derivados
> - **Optuna tuning** sobre 9 hyperparams XGBoost (50 trials, optimiza PR-AUC)
> - **Threshold tuning** automático (default 0.5, F1-optimal 0.77, recall-priority 0.30)

## 5. Features más importantes (top 15) — v3

| # | Feature | Importance |
|---|---------|-----------:|
| 1 | `n_inconsistentes` (docs) | 10.88% |
| 2 | `documentos_completos` | 6.75% |
| 3 | `cobertura_Responsabilidad Civil` | 4.35% |
| 4 | `lista_restrictiva` | **4.19%** ⬆ |
| 5 | `fault_responsable_Tercero` | 3.24% |
| 6 | `monto_promedio_reclamado_usd` (prov) | 2.71% |
| 7 | `deducible_usd` | 2.41% |
| 8 | `cobertura_Robo` | **1.96%** ⬆ |
| 9 | `tipo_cobertura_Liability` | 1.63% |
| 10 | `dias_desde_fin_poliza` | 1.56% |
| 11 | `dias_entre_ocurrencia_reporte` | 1.44% |
| 12 | `cobertura_Pérdida Total` | 1.24% |
| 13 | `ratio_pagado_reclamado` | 1.16% |
| 14 | `tipo_cobertura_Collision` | 1.13% |
| 15 | `n_no_entregados` | 1.12% |

**Interpretación (v3):** el modelo aprendió correctamente los patrones que el reto identifica:
- **`n_inconsistentes` ahora #1** (10.9%) — confirma señal 11 del reto como dominante
- **`lista_restrictiva` saltó a #4** (4.2% vs 1.4% en v2) — el modelo ahora pondera fuerte RF-03
- **`cobertura_Robo` apareció en top-15** — refuerza RF-01 (PTxRB)
- Las features sospechosas de sesgo (marcas específicas) desaparecieron del top
- `ratio_pagado_reclamado` apareció como predictivo — captura PTxRB indirectamente

## 6. Uso esperado y limitaciones

### ✅ Usos permitidos
- Apoyar al analista antifraude **priorizando** casos sospechosos.
- Componente de un sistema híbrido (reglas + ML + agente conversacional).
- Calcular probabilidad informativa que se suma al motor de reglas determinísticas.

### ❌ Usos NO permitidos
- ❌ NO debe usarse como justificación única para **rechazar** un siniestro.
- ❌ NO debe automatizar decisiones de pago ni de comunicación con el asegurado.
- ❌ NO debe usarse para acusar formalmente de fraude.
- ❌ NO debe sustituir el análisis humano.

### Limitaciones conocidas
1. **Recall del 57%** — el modelo se pierde ~43% de los fraudes. Por eso existe el motor de reglas como complemento.
2. **Sesgo por features categóricas** (`marca_Hyundai`, `marca_Nissan` aparecen en top 15) — puede reflejar artefactos del dataset sintético más que patrones reales.
3. **Solo ramo Vehículos** — no generaliza a otros ramos (Salud, Vida, Hogar).
4. **Entrenado con etiqueta sintética** — la `etiqueta_fraude_simulada` no es ground truth real. En producción se necesita re-entrenamiento con casos confirmados por la Unidad Antifraude.
5. **Sin información de imágenes** — no procesa fotos, documentos escaneados, ni audio.
6. **Drift no monitoreado** — si las prácticas de fraude cambian, el modelo se degrada. Requiere reentrenamiento mensual y monitoreo de feature drift.

## 7. Consideraciones éticas

- **Sesgo demográfico:** las features `segmento`, `ciudad`, `marca`, `categoria` pueden introducir sesgos no intencionados. Análisis de fairness por grupo pendiente (próximos pasos).
- **Explicabilidad:** el modelo se acompaña SIEMPRE de SHAP values (top 5 features por predicción) + reglas activadas + explicación en lenguaje natural por GPT-5-mini. Nunca se entrega un score "caja negra".
- **Revisión humana:** toda decisión final es del analista antifraude. El modelo es una alerta, no una sentencia.

## 8. Reproducibilidad

```bash
# Regenerar el modelo idéntico (random_state=42)
python scripts/clean_dataset.py
python scripts/normalize_tables.py
python scripts/inject_critical_cases.py
python src/features/build_features.py
python src/models/train_xgboost.py

# Output: runs/local/model_xgb.pkl + metrics.json + feature_columns.json
```

Las métricas son **deterministas** dada la `random_state=42` y la versión exacta de las dependencias en `requirements.txt`.

## 9. Datos para auditoría

| Artefacto | Ubicación |
|-----------|-----------|
| Script de entrenamiento | `src/models/train_xgboost.py` |
| Pipeline de features | `src/features/build_features.py` |
| Modelo serializado | `runs/local/model_xgb.pkl` + `model_xgb.json` |
| Columnas de features | `runs/local/feature_columns.json` |
| Métricas completas | `runs/local/metrics.json` |
| Endpoint Azure ML | `https://achachai-fraud.eastus2.inference.ml.azure.com/score` |
| Workspace | Azure portal → `mlw-achachai` → Models → `achachai-fraude-xgb` |

## 10. Próximos pasos (post-hackathon)

1. **Mejorar recall** con threshold tuning + ensemble con Isolation Forest.
2. **Calibrar probabilidades** (Platt scaling).
3. **Validar con datos reales** de Aseguradora del Sur (con re-etiquetado por UAF).
4. **Análisis de fairness** por segmento, ciudad, marca.
5. **Pipeline de reentrenamiento automatizado** mensual en Azure ML.
6. **Monitoreo de drift** en producción (Application Insights).
7. **Extender a otros ramos** (Salud, Vida, Hogar).
