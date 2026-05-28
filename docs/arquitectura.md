# 🦅 Arquitectura completa de AchachAI

> Documento de arquitectura técnica · hackIAthon 2026 · Reto Aseguradora del Sur

---

## 1. Diagrama de arquitectura

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USUARIO (analista, jefe, gerente)                │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND · Next.js 14 + React + TypeScript        localhost:3000/achachai   │
│  ─────────────────────────────────────────────────────────────────────────    │
│  Sidebar (12 pantallas)  →  Cada una llama endpoints REST del backend         │
│  Mi vista · Chat · Bandeja · Explorar · Evaluar · Prevención · Patrones      │
│  Documentos · Red · Reportes · Ajustes · Investigación 360                   │
│                                                                               │
│  Componentes especiales:                                                      │
│   • EcuadorHeatMap (GeoJSON real + 24 provincias)                            │
│   • VueloDelCondor (score 0-100 visual)                                       │
│   • EvidencePreview (auto-extrae SIN-IDs del chat)                           │
│   • LearningBar (feedback stats live)                                         │
│   • JarvisStream (chat tool-by-tool reveal)                                   │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │  HTTP / JSON / multipart
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  BACKEND · FastAPI (Python 3.11)                   localhost:8000             │
│  ─────────────────────────────────────────────────────────────────────────    │
│  ~30 endpoints REST · CORS abierto · cache en memoria (top-riesgo, IF)        │
│                                                                               │
│  Capas:                                                                       │
│   ┌────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐   │
│   │  src/api/      │  │ src/ai_agent/    │  │ src/document_analysis/      │   │
│   │   main.py      │  │  agent + tools   │  │  factura · imagen · OCR     │   │
│   └────────┬───────┘  └────────┬─────────┘  └─────────────┬──────────────┘   │
│            │                   │                          │                   │
│            ▼                   ▼                          ▼                   │
│   ┌──────────────────────────────────────────────────────────────────────┐   │
│   │  CAPA DE REGLAS · src/rules/                                          │   │
│   │   • 7 reglas críticas RF-01..07 (force semáforo)                     │   │
│   │   • 14 señales ponderadas (suman al score)                           │   │
│   │   • Pesos editables vía /config/pesos (JSON persistido)              │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│   ┌──────────────────────────────────────────────────────────────────────┐   │
│   │  CAPA DE MODELOS · runs/local/                                        │   │
│   │   • XGBoost supervisado (AUC 0.96, Recall 0.79) · model_xgb.pkl     │   │
│   │   • IsolationForest no supervisado · iforest.pkl                     │   │
│   │   • Embeddings · embeddings_descripciones.npz                        │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                │                                              │
                ▼                                              ▼
┌────────────────────────────────────┐  ┌────────────────────────────────────┐
│  DATOS LOCALES · data/processed/    │  │  AZURE CLOUD                       │
│  ─────────────────────────────────  │  │  ─────────────────────────────────  │
│  7 parquet (modelo de datos PDF):   │  │  ┌────────────────────────────┐   │
│   • siniestros.parquet (25.460)     │  │  │ Azure ML Workspace          │   │
│   • polizas / asegurados            │  │  │  ml-achachai-uniandes       │   │
│   • vehiculos / conductores         │  │  │   • XGBoost registrado v4   │   │
│   • proveedores / documentos        │  │  │   • Endpoint online (opc.)  │   │
│                                      │  │  └────────────────────────────┘   │
│  Generados por el pipeline:         │  │                                    │
│   • features.parquet (XGB input)    │  │  ┌────────────────────────────┐   │
│   • embeddings_descripciones.npz    │  │  │ Azure AI Foundry            │   │
│   • similitudes_top_pares.parquet   │  │  │  (Azure OpenAI Service)     │   │
│                                      │  │  │   • gpt-5-mini (agente)     │   │
│  Mutables (loop de aprendizaje):    │  │  │   • gpt-4o (vision)         │   │
│   • feedback_analistas.parquet      │  │  │   • text-embedding-3-large  │   │
│   • documentos_analizados.parquet   │  │  └────────────────────────────┘   │
│   • pesos_config.json               │  │                                    │
│                                      │  │  ┌────────────────────────────┐   │
└────────────────────────────────────┘  │  │ Azure Document Intelligence │   │
                                         │  │   • prebuilt-invoice        │   │
                                         │  │   • prebuilt-read (OCR)     │   │
                                         │  └────────────────────────────┘   │
                                         └────────────────────────────────────┘
```

---

## 2. Stack tecnológico completo

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| **Next.js** | 14 (App Router) | Framework React con SSR + routing |
| **React** | 18 | UI library |
| **TypeScript** | 5.x (con `@ts-nocheck` para velocidad demo) | Tipado |
| **react-markdown** | latest | Renderiza respuestas del cóndor |
| **remark-gfm** | latest | Soporte tablas markdown en chat |
| **CSS custom** | — | Sistema de design "Cielo andino" (variables CSS) |
| **SVG inline** | — | Cóndor, mapa Ecuador, grafo bipartito |

### Backend
| Tecnología | Versión | Uso |
|---|---|---|
| **Python** | 3.11.9 | Runtime |
| **FastAPI** | latest | API REST con validación Pydantic |
| **uvicorn** | 0.32 | Servidor ASGI |
| **DuckDB** | latest | Engine OLAP sobre los parquet (sin levantar Postgres) |
| **Pandas** | 2.x | Manipulación de datos |
| **scikit-learn** | latest | IsolationForest, LOF, EllipticEnvelope, StandardScaler, PCA |
| **XGBoost** | 2.x | Clasificador supervisado de fraude |
| **joblib** | latest | Serialización de modelos a `.pkl` |
| **python-dotenv** | latest | Carga `.env` con credenciales Azure |
| **openai** | 1.x (Azure mode) | Cliente para AI Foundry |
| **azure-ai-documentintelligence** | latest | Cliente para Document Intelligence |
| **scipy** | latest | Tests estadísticos en notebook 04 |
| **seaborn / matplotlib** | latest | Visualizaciones notebooks |

---

## 3. Stack Azure (lo que el reto pide)

### 🤖 Azure AI Foundry (antes Azure OpenAI Service)
**Workspace:** `ais-achachai` · región: eastus

| Modelo desplegado | Deployment | Uso en AchachAI |
|---|---|---|
| **gpt-5-mini** | `gpt-5-mini` | • Agente conversacional con function calling (11 tools)<br>• Explicación de anomalías (`/anomalias-novedosas/{id}/explicar`)<br>• Síntesis ejecutiva (`/reportes/ejecutivo`) |
| **gpt-4o** | `gpt-4o` | • GPT-4o Vision analiza fotos del daño<br>• Cruza descripción narrativa con imagen<br>• Detecta inconsistencias visuales |
| **text-embedding-3-large** | `embeddings` | • Embeddings de las descripciones de siniestros<br>• Similitud coseno → señal #13 (narrativas clonadas)<br>• Precomputado offline a `similitudes_top_pares.parquet` |

**Donde se invoca:**
- `src/ai_agent/agent.py` — cliente único cacheado
- `src/document_analysis/analyze.py` — Vision + DI

### 📄 Azure Document Intelligence
**Workspace:** `di-achachai`

| Modelo | Uso |
|---|---|
| **prebuilt-invoice** | Extracción de campos de facturas (RUC, total, fecha emisión, items) |
| **prebuilt-read** | OCR genérico para partes policiales y denuncias |

**Donde se invoca:**
- `src/document_analysis/analyze.py:analyze_factura()`
- `src/document_analysis/analyze.py:analyze_documento_generico()`

Disparado desde:
- `POST /analyze-document` (multipart upload)
- `POST /evaluar-completo` (incluido en el análisis integral)

### ⚙️ Azure ML Workspace
**Workspace:** `ml-achachai-uniandes` · suscripción Azure For Students $5K

| Recurso | Uso |
|---|---|
| **Workspace** | Gestión centralizada de experiments |
| **Model registry** | XGBoost v4 registrado (`achachai-fraude-xgb`, AUC 0.96) |
| **Compute cluster** | (opcional) para reentrenar en cloud |
| **Online endpoint** | (opcional) para inferencia remota — actualmente servimos local desde `runs/local/model_xgb.pkl` |

---

## 4. Modelo de datos (Base de datos)

**No usamos Postgres/Oracle.** El reto permite "archivos planos". Usamos **DuckDB sobre parquet** — más rápido que SQLite, soporta SQL completo, sin servidor.

### Tablas (data/processed/)

| Parquet | Filas | Descripción |
|---|---|---|
| `siniestros.parquet` | **25.460** | Tabla principal: id, fechas, monto, cobertura, estado, sucursal, ciudad, etiqueta_fraude_simulada, etc. |
| `polizas.parquet` | 23.597 | Suma asegurada, prima, deducible, canal venta, vigencia |
| `asegurados.parquet` | 11.031 | Segmento, antigüedad, ciudad, reclamos 12m, score cliente, mora |
| `vehiculos.parquet` | 23.597 | Marca, modelo, año, chasis, placa, motor |
| `conductores.parquet` | 23.597 | Edad, años de licencia |
| `proveedores.parquet` | 198 | Talleres, clínicas, peritos · `lista_restrictiva` flag |
| `documentos.parquet` | ~75K | Tipo, entregado, legible, fecha_emision, inconsistencias |

### Tablas derivadas (pipeline ML)
| Parquet | Generador | Uso |
|---|---|---|
| `features.parquet` | `src/features/build_features.py` | Input listo para XGBoost (target encoding, ratios, deltas) |
| `embeddings_descripciones.npz` | `scripts/compute_embeddings.py` | Vectores 3072d de text-embedding-3-large |
| `similitudes_top_pares.parquet` | mismo script | Top-100 pares cosine sim ≥ 0.94 |

### Tablas mutables (loop de aprendizaje)
| Parquet | Endpoint que escribe | Uso |
|---|---|---|
| `feedback_analistas.parquet` | `POST /feedback` | Decisiones del analista (Aprobar/Retener/Bloquear/Escalar) |
| `documentos_analizados.parquet` | `POST /analyze-document` con `id_siniestro` | Log de cada documento analizado, vinculado al caso |
| `pesos_config.json` | `PUT /config/pesos` | Pesos editables de señales/reglas, persistidos |

### Modelos serializados (runs/local/)
| Archivo | Generador | Uso |
|---|---|---|
| `model_xgb.pkl` | `notebooks/02_modelo_fraude.ipynb` | XGBoost classifier |
| `feature_columns.json` | mismo | Orden de columnas (importa para predict) |
| `iforest.pkl` | `scripts/train_iforest.py` | IsolationForest |
| `iforest_scaler.pkl` | mismo | StandardScaler ajustado |
| `iforest_columns.json` + `_meta.json` | mismo | Schema y metadata |

---

## 5. Sistema híbrido de 4 capas (el corazón de AchachAI)

```
              ┌─────────────────────────────────────────────────┐
              │   1. REGLAS CRÍTICAS RF-01..07                  │
              │   Determinísticas. Fuerzan ROJO o AMARILLO.     │
              │   src/rules/critical_rules.py                   │
              └────────────────────┬────────────────────────────┘
                                   │ override
              ┌────────────────────▼────────────────────────────┐
              │   2. 14 SEÑALES PONDERADAS (1-14)               │
              │   Suman al score numérico 0-100.                │
              │   src/rules/signals.py · pesos editables.       │
              └────────────────────┬────────────────────────────┘
                                   │ se combinan
              ┌────────────────────▼────────────────────────────┐
              │   3. XGBOOST SUPERVISADO                        │
              │   AUC 0.96 · Recall 0.79 · F1 0.73              │
              │   Aprende de la etiqueta_fraude_simulada.       │
              │   runs/local/model_xgb.pkl                      │
              └────────────────────┬────────────────────────────┘
                                   │ complementa
              ┌────────────────────▼────────────────────────────┐
              │   4. ISOLATION FOREST NO SUPERVISADO            │
              │   Detecta PATRONES NUEVOS que el modelo         │
              │   supervisado nunca vio. 413 casos novedosos.   │
              │   runs/local/iforest.pkl                        │
              └─────────────────────────────────────────────────┘
                                   │
                                   ▼
                       SCORE FINAL + NIVEL VERDE/AMARILLO/ROJO
                                   │
                                   ▼
                   EXPLICACIÓN AUTOMÁTICA (motor de reglas o GPT-5-mini)
```

---

## 6. Endpoints API (resumen por categoría)

| Categoría | Endpoint | Verbo | Qué hace |
|---|---|---|---|
| **Casos** | `/casos` | GET | Lista paginada con 13 filtros |
| | `/casos/{id}` | GET | Detalle 360 con reglas + señales + explicación |
| | `/casos/{id}/similares` | GET | Narrativas similares (embeddings) |
| | `/casos/{id}/documentos` | GET | Documentos vinculados al caso |
| | `/casos/filtros/opciones` | GET | Valores para los `<select>` del explorador |
| **Asegurados** | `/asegurados/{id}` | GET | Vista 360 (perfil + siniestros + proveedores + pólizas) |
| | `/asegurados/buscar` | GET | Búsqueda por id/ciudad/segmento |
| **Proveedores** | `/proveedores/ranking` | GET | Top proveedores con lista restrictiva |
| | `/red-relaciones` | GET | Grafo bipartito asegurado↔proveedor |
| **Sucursales** | `/sucursales/ranking` | GET | Tasa de alertas por sucursal |
| **Analytics** | `/top-riesgo` | GET | Top scoring (cache 5min) |
| | `/ciudades/ranking` | GET | Geografía |
| | `/asegurados/recurrentes` | GET | Frecuencia anormal |
| | `/docs/faltantes` | GET | Cobertura documental |
| | `/kpis` | GET | KPIs totales de cartera |
| **Workflows** | `/chat` | POST | Agente gpt-5-mini con 11 tools |
| | `/evaluar` | POST | Score en vivo (JSON) |
| | `/evaluar-completo` | POST | Score + documentos (multipart) |
| | `/analyze-document` | POST | Azure DI + GPT-4o Vision |
| | `/feedback` | POST | Persiste decisión del analista |
| | `/feedback/stats` | GET | Stats para LearningBar |
| **Reportes** | `/reportes/ejecutivo` | GET | Síntesis GPT-5-mini con 4 tools en cadena |
| | `/exportar-reporte.csv` | GET | Descarga CSV de auditoría |
| **Prevención** | `/prevencion/alertas-tempranas` | GET | Clusters formándose (ventana adaptativa) |
| | `/prevencion/watchlist-sugerida` | GET | Proveedores sugeridos para vigilancia |
| **Anomalías** | `/anomalias-novedosas` | GET | IsolationForest, cached |
| | `/anomalias-novedosas/{id}/explicar` | GET | Explicación GPT-5-mini estructurada |
| **Analistas** | `/analistas/carga` | GET | Distribución simulada por hash |
| **Simulación** | `/simulacion-ahorro` | GET | ROI/payback |
| **Config** | `/config/pesos` | GET/PUT/POST reset | Pesos editables persistidos |

---

## 7. El agente (gpt-5-mini con 11 tools)

```
        USUARIO escribe pregunta
                │
                ▼
        ┌───────────────────┐
        │  /chat endpoint   │
        │  ClaimsAgent      │
        └─────────┬─────────┘
                  │ system prompt: no acusatorio
                  │ + las 11 tools como schema
                  ▼
        ┌───────────────────┐
        │  gpt-5-mini       │
        │  function calling │
        └─────────┬─────────┘
                  │ decide qué tool(s) llamar
                  ▼
   ┌──────────────────────────────────────────┐
   │  TOOLS REGISTRADAS (TOOLS_REGISTRY)       │
   ├──────────────────────────────────────────┤
   │  1. top_riesgo                            │
   │  2. detalle_siniestro                     │
   │  3. ranking_proveedores                   │
   │  4. ranking_ciudades                      │
   │  5. asegurados_recurrentes                │
   │  6. docs_faltantes                        │
   │  7. montos_atipicos                       │
   │  8. estadisticas_por_cobertura            │
   │  9. simulacion_ahorro                     │
   │  10. exportar_reporte                     │
   │  11. anomalias_novedosas (nueva)          │
   └──────────────────────────────────────────┘
                  │ resultados como JSON
                  ▼
        ┌───────────────────┐
        │  gpt-5-mini       │
        │  sintetiza        │
        └─────────┬─────────┘
                  ▼
            RESPUESTA + tools_used + tokens
```

Cada tool toca **DuckDB sobre parquet**, salvo `simulacion_ahorro` que es cálculo puro.

---

## 8. Pipeline de datos (offline, una vez)

```
data/raw/dataset_sintetico.csv (15.420 filas iniciales)
            │
            │  scripts/clean_dataset.py
            ▼
data/processed/siniestros_clean.csv
            │
            │  scripts/normalize_tables.py (split en 7 tablas relacionadas)
            ▼
7 parquet (siniestros + polizas + asegurados + ...)
            │
            ├──→ scripts/inject_critical_cases.py (red team: agrega 100 casos extremos)
            │
            ├──→ scripts/generate_more_data.py (escala a 25.460 con 50+ templates de descripción)
            │
            ├──→ src/features/build_features.py → features.parquet
            │
            ├──→ scripts/compute_embeddings.py → embeddings + similitudes_top_pares
            │
            ├──→ notebooks/02_modelo_fraude.ipynb → runs/local/model_xgb.pkl (XGBoost)
            │
            └──→ scripts/train_iforest.py → runs/local/iforest.pkl (IsolationForest)
```

Todo el pipeline corre en **<1 minuto** local, totalmente reproducible.

---

## 9. Notebooks (CU-DS del reto)

| Notebook | Qué demuestra |
|---|---|
| `01_exploracion_datos.ipynb` | EDA de las 7 tablas, distribuciones, correlaciones |
| `02_modelo_fraude.ipynb` | Entrenamiento XGBoost · split 80/20 · ROC · feature importance |
| `03_evaluacion_modelo.ipynb` | Evaluación del híbrido reglas+modelo sobre 2K casos |
| `04_anomalias_patrones_nuevos.ipynb` | Investigación científica: 5 hipótesis, 3 algoritmos, sensitivity, decisión operativa |

---

## 10. Estructura del repo

```
AchachAI/
├── data/
│   ├── raw/                  ← CSV original sintético
│   └── processed/            ← 7 parquet + embeddings + mutables
├── runs/local/               ← XGBoost.pkl + IsolationForest.pkl
├── azure/                    ← scripts setup Azure ML (CLI)
├── notebooks/                ← 4 notebooks Jupyter
├── scripts/                  ← pipeline: clean, normalize, inject, train_iforest
├── src/
│   ├── api/main.py           ← FastAPI · ~30 endpoints
│   ├── ai_agent/             ← agente gpt-5-mini + 11 tools
│   ├── document_analysis/    ← Azure DI + GPT-4o Vision
│   ├── rules/                ← 7 reglas críticas + 14 señales + scoring
│   ├── features/             ← engineering
│   └── models/               ← XGBoost wrapper
├── frontend/
│   ├── src/app/achachai/     ← Next.js App Router
│   │   ├── page.tsx          ← sidebar + routing de 12 pantallas
│   │   └── _components/      ← Screens.tsx, Chat.tsx, Investigation.tsx,
│   │                            EcuadorHeatMap.tsx, Condor.tsx, etc.
│   └── public/ec-all.geo.json  ← GeoJSON real Ecuador (24 provincias)
├── docs/
│   ├── arquitectura.md       ← (este documento)
│   ├── modelo_datos.md
│   ├── reglas_negocio.md
│   ├── uso_ia.md
│   └── limitaciones.md       ← análisis de sesgo + ética
└── tests/                    ← test_rules.py + test_signals.py
```

---

## 11. Lo que nos diferencia (los 5 puntos para el pitch)

1. **Sistema híbrido de 4 capas** — reglas + señales + XGBoost + IsolationForest. La 4ª capa detecta patrones que NUNCA vimos en entrenamiento.
2. **Pipeline 100% reproducible en <1 min** — desde CSV crudo hasta modelos entrenados.
3. **Loop de aprendizaje real** — cada click en Aprobar/Bloquear persiste a parquet y alimenta el próximo reentreno. El `LearningBar` cuenta números reales, no decoración.
4. **Calibrable en vivo sin redeploy** — pantalla Ajustes cambia pesos y umbrales en segundos, invalida cache, los nuevos pesos aplican al siguiente score.
5. **Análisis multimodal en un solo veredicto** — `/evaluar-completo` combina datos tabulares + factura (Azure DI) + foto del daño (GPT-4o Vision) + parte policial en un solo score.

---

## 12. Limitaciones conocidas y trabajo futuro

Ver detalle completo en [docs/limitaciones.md](limitaciones.md).

| Área | Estado | Plan |
|---|---|---|
| Ramos distintos (salud, vida, hogar) | ❌ | Próxima fase: extender pipeline genérico |
| Endpoint Azure ML online activo | ❌ | Servimos local desde `.pkl` por velocidad demo; deploy a Azure ML es scripted en `azure/` |
| Análisis de fairness con Cohen's kappa | 🟡 parcial | Tenemos `% alineación` heurístico; falta kappa por sucursal |
| AutoEncoder no supervisado | ❌ | IsolationForest cubre el caso; AE sería upgrade NLP+tabular |
| Reentreno automático mensual | 🟡 | Pipeline scripted; falta cron en producción |
