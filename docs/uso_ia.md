# Uso de Inteligencia Artificial en AchachAI

> Justificación del enfoque híbrido (reglas + ML + NLP + agente) que el reto valora con el 40% del puntaje.

## 1. Capas de IA

| Capa | Tecnología | Para qué |
|------|------------|----------|
| **Reglas determinísticas** | Python | Garantizar trazabilidad e interpretabilidad inmediata |
| **ML supervisado** | XGBoost (Azure ML) | Aprende patrones implícitos en la `etiqueta_fraude_simulada` |
| **Detección de anomalías** | Isolation Forest | Casos atípicos no cubiertos por reglas ni etiquetas |
| **NLP — embeddings** | `text-embedding-3-large` (Azure OpenAI) | Detectar narrativas clonadas / similares |
| **NLP — generación** | GPT-4o (Azure OpenAI) | Explicar el score en lenguaje natural, resumir, dialogar |
| **Agente con tools** | GPT-4o + function calling | Permitir consultas en lenguaje natural sobre toda la cartera |

## 2. Modelo XGBoost en Azure ML

### 2.1 Pipeline de entrenamiento

```
data/processed/*.parquet
   ↓ (build_features.py)
matriz de features (numéricas + categóricas one-hot + agregaciones)
   ↓
train/test split estratificado por etiqueta (80/20)
   ↓
SMOTE para balancear clases (~6% fraude)
   ↓
XGBoost (max_depth=6, n_estimators=500, learning_rate=0.05, scale_pos_weight)
   ↓
Métricas: F1, Precision, Recall, AUC-ROC, PR-AUC
   ↓
MLflow log → registro en Azure ML Workspace
   ↓
Despliegue → managed online endpoint
```

### 2.2 Métricas objetivo (mínimo aceptable para la demo)

| Métrica | Mínimo | Comentario |
|---------|--------|------------|
| Recall (clase fraude) | ≥ 0.70 | Lo más importante: no perder casos sospechosos |
| Precision | ≥ 0.40 | Aceptamos falsos positivos — son alertas, no acusaciones |
| F1 | ≥ 0.50 | |
| AUC-ROC | ≥ 0.85 | |
| PR-AUC | ≥ 0.60 | Más informativo con clases desbalanceadas |

### 2.3 Features esperadas (~40)

- Numéricas crudas: `monto_reclamado_usd`, `prima_usd`, `suma_asegurada_usd`, `dias_*`, `score_cliente_simulado`, `valor_comercial_usd`, `historial_siniestros_asegurado`, `antiguedad_anios`.
- Ratios derivados: `reclamo/suma_asegurada`, `reclamo/prima`, `reclamo/valor_comercial`, `pagado/reclamado`.
- Conteos por entidad: siniestros previos por asegurado / vehículo / conductor / proveedor.
- Categóricas one-hot: `ramo`, `cobertura`, `estado`, `tipo_beneficiario`, `canal_venta`, `tipo_cobertura`, `segmento`, `fault_responsable`, `ciudad`.
- Booleanas: `documentos_completos`, `tuvo_parte_policial`, `tuvo_testigo`, `mora_actual`, `lista_restrictiva`.
- NLP-derived: longitud `descripcion`, similitud máxima con otros reclamos.

### 2.4 Explicabilidad
- **SHAP** sobre cada predicción → top-5 features que más contribuyen al score.
- Visualizado en el detalle del caso (frontend).

## 3. Agente conversacional (GPT-4o)

### 3.1 Tools registradas

| Tool | Input | Output |
|------|-------|--------|
| `query_casos` | filtros (nivel, ramo, ciudad, rango fechas, límite) | lista de siniestros con score |
| `get_score_detail` | `id_siniestro` | JSON completo de score + reglas + SHAP |
| `similar_narratives` | `id_siniestro`, `top_k` | reclamos con narrativa similar (cosine) |
| `provider_stats` | `id_proveedor` o ranking general | conteo de alertas, monto promedio, casos observados |
| `executive_summary` | `nivel`, `periodo` | resumen ejecutivo del periodo |
| `insured_history` | `id_asegurado` | historial de pólizas y siniestros |

### 3.2 Preguntas garantizadas (sección 12 del reto)

El agente cubre las **12 preguntas obligatorias**:
1. Top 10 siniestros con mayor riesgo
2. Por qué un siniestro fue marcado alto riesgo
3. Proveedores que concentran más alertas
4. Ramos con mayor porcentaje sospechoso
5. Ciudades con mayor concentración de alertas
6. Asegurados con mayor frecuencia
7. Documentos faltantes en casos críticos
8. Casos con montos atípicos
9. Siniestros cerca del inicio de póliza
10. Patrones repetidos en reclamos sospechosos
11. Resumen ejecutivo de casos críticos
12. Recomendación de qué casos revisar primero

### 3.3 System prompt (esqueleto)

```
Eres un asistente de análisis antifraude para Aseguradora del Sur. 
Tu rol: ayudar al analista humano a priorizar casos.
NUNCA acuses a un asegurado. Hablas siempre de "posible fraude" o 
"requiere revisión". Cita evidencia concreta (id_siniestro, reglas
activadas, valores). Si no estás seguro, dilo. Usa las tools 
disponibles antes de responder.
```

## 4. Por qué este enfoque maximiza el puntaje del jurado

| Criterio (peso) | Cómo lo cubrimos |
|-----------------|------------------|
| Uso efectivo de IA (40%) | Híbrido: ML + NLP + Agente (nivel "Excepcional" en matriz) |
| Explicabilidad y ética (25%) | SHAP + reglas trazables + agente que justifica + lenguaje "posible fraude" |
| Análisis del caso (15%) | Cruza 6 tablas, implementa las 14 señales y 7 reglas exactas del reto |
| Tecnología y arquitectura (10%) | Repo modular, Azure ML endpoint desplegado, FastAPI + Next.js |
| Seguridad y ética (10%) | Datos sintéticos, sin PII, credenciales en `.env`, revisión humana obligatoria |
| Pitch e impacto (10%) | Demo en vivo con consultas en lenguaje natural + carga de siniestro de prueba |
