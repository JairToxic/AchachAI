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

## 2. Datos de entrenamiento

| Concepto | Valor |
|----------|-------|
| **Origen** | Dataset sintético generado por el equipo (no PII real) |
| **Total filas** | 15.460 siniestros (15.420 originales + 40 críticos inyectados) |
| **Ramo cubierto** | Vehículos (único, por scope del prototipo) |
| **Distribución target** | 6.23% positivos (963 fraudes simulados / 14.497 no-fraudes) |
| **Split** | 80% train (12.368) / 20% test (3.092), estratificado |
| **Features finales** | 75 (12 numéricas + 4 ratios + 50+ one-hot + 5 booleanos + 3 agregaciones de documentos + 3 conteos de contexto) |
| **Balanceo** | `scale_pos_weight = 15.06` (sin SMOTE) |

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

## 4. Métricas de evaluación (test set 3.092 filas)

| Métrica | Valor | Objetivo del reto | ¿Cumple? |
|---------|-------|--------------------|----------|
| **AUC-ROC** | **0.940** | ≥ 0.85 | ✅ |
| **PR-AUC** | **0.643** | ≥ 0.60 | ✅ |
| **F1-score** | 0.576 | ≥ 0.50 | ✅ |
| **Precision** | 0.582 | ≥ 0.40 | ✅ |
| **Recall** | 0.570 | ≥ 0.70 | ⚠️ por debajo del objetivo |
| **Prob media en casos inyectados** | 0.951 | — | ✅ excelente |
| **% inyectados con prob ≥ 0.5** | 97.5% | — | ✅ |

### Matriz de confusión (test, threshold 0.5)

|              | Pred. NO fraude | Pred. POSIBLE fraude |
|--------------|-----------------|----------------------|
| **Real NO**  | 2820 (TN)       | 79 (FP)              |
| **Real SÍ**  | 83 (FN)         | 110 (TP)             |

- **Cobertura (Recall):** 57% — captura 110 de 193 fraudes simulados.
- **Pureza (Precision):** 58% — de cada 100 alertas del modelo, 58 son fraudes reales.

> Nota: el recall del 57% (debajo del 70% objetivo) se compensa con el **motor de reglas determinísticas** (7 RF críticas + 14 señales). El sistema final combina ambos. Las reglas atrapan casos que el modelo se pierde y viceversa.

## 5. Features más importantes (top 15)

| # | Feature | Importance |
|---|---------|-----------:|
| 1 | `cobertura_Responsabilidad Civil` | 17.46% |
| 2 | `fault_responsable_Tercero` | 10.55% |
| 3 | `documentos_completos` | 7.02% |
| 4 | `n_inconsistentes` (docs) | 5.96% |
| 5 | `categoria_SUV` | 4.48% |
| 6 | `deducible_usd` | 3.80% |
| 7 | `tipo_cobertura_Liability` | 2.24% |
| 8 | `dias_desde_inicio_poliza` | 1.83% |
| 9 | `monto_promedio_reclamado_usd` (prov) | 1.81% |
| 10 | `marca_Hyundai` | 1.80% |
| 11 | `marca_Nissan` | 1.80% |
| 12 | `lista_restrictiva` | 1.43% |
| 13 | `tipo_beneficiario_Taller` | 1.14% |
| 14 | `dias_entre_ocurrencia_reporte` | 1.12% |
| 15 | `monto_estimado_usd` | 1.12% |

**Interpretación:** las features más predictivas alinean con el conocimiento de negocio:
- Cobertura RC es la más asociada a fraude simulado en el dataset
- Documentos inconsistentes (señal 11 del reto) aparece como top-4
- Días desde inicio de póliza (señal 1) tiene peso
- Proveedor en lista restrictiva (RF-03) tiene peso

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
