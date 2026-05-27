# AchachAI — Detector de Posibles Fraudes en Siniestros Vehiculares

> **hackIAthon 2026 — Reto Aseguradora del Sur**
> Equipo: AchachAI · Organizado por Viamatica · Innovation Leader: Aseguradora del Sur

Prototipo funcional de Inteligencia Artificial que analiza siniestros de seguros de vehículos, detecta patrones anómalos y genera un **score de riesgo de posible fraude (0–100)** con alertas explicables y semáforo verde / amarillo / rojo.

> ⚠️ **Principio clave**: la solución genera **alertas de revisión, no acusaciones**. Toda decisión final queda en manos del analista humano.

---

## 🎯 Objetivo

Apoyar al analista antifraude de una aseguradora con:

1. **Score de riesgo** explicable por cada siniestro (0–100).
2. **Semáforo** Verde (0–40) / Amarillo (41–75) / Rojo (76–100).
3. **Alertas** con motivo concreto (qué regla / qué señal se activó).
4. **Agente conversacional** para consultar la cartera en lenguaje natural.
5. **Dashboard** con priorización de casos y ranking de proveedores sospechosos.

---

## 🏗️ Arquitectura

```
┌────────────────────┐
│  Frontend Next.js  │  ← dashboard analista
└──────────┬─────────┘
           │ REST
┌──────────▼─────────┐
│  FastAPI Backend   │  ← /score, /chat, /casos, /proveedores
└──────────┬─────────┘
           │
    ┌──────┴──────────────────────────────────┐
    │                                          │
┌───▼────────────┐  ┌────────────────┐  ┌─────▼────────────┐
│ Reglas Negocio │  │ Azure ML       │  │ Azure OpenAI     │
│ RF-01 a RF-07  │  │ Endpoint       │  │ GPT-4o           │
│ + 14 señales   │  │ (XGBoost)      │  │ (agente + NLP)   │
└────────────────┘  └────────────────┘  └──────────────────┘
           │                │
           └────────┬───────┘
                    ▼
        ┌───────────────────────┐
        │  Score híbrido final  │
        │  + explicabilidad     │
        └───────────────────────┘
```

Detalle completo en [`docs/arquitectura.md`](docs/arquitectura.md).

---

## 🧰 Stack técnico

| Capa | Tecnología |
|------|------------|
| Modelo ML | Azure Machine Learning (XGBoost + Isolation Forest), endpoint REST desplegado |
| LLM / Agente | Azure OpenAI GPT-4o |
| NLP narrativas | `sentence-transformers` (embeddings) + GPT-4o (resumen y justificación) |
| Backend API | FastAPI + Pydantic |
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| Reglas | Python puro, modular y testeable |
| Datos | CSV sintético → 6 tablas normalizadas (parquet) |
| Orquestación | Azure ML Pipelines |
| Repo / CI | GitHub + GitHub Actions |

---

## 📁 Estructura del repositorio

Sigue la estructura sugerida en la sección 15 del documento del reto:

```
AchachAI/
├── README.md
├── requirements.txt
├── .env.example
├── .gitignore
├── data/
│   ├── raw/          ← dataset sintético original
│   ├── processed/    ← 6 tablas normalizadas (parquet)
│   └── synthetic/    ← casos extremos inyectados para reglas críticas
├── notebooks/
│   ├── 01_exploracion_datos.ipynb
│   ├── 02_modelo_fraude.ipynb
│   └── 03_evaluacion_modelo.ipynb
├── src/
│   ├── ingestion/load_data.py
│   ├── features/build_features.py
│   ├── rules/fraud_rules.py        ← RF-01..07 + 14 señales puntuadas
│   ├── models/fraud_model.py       ← train, register, deploy en Azure ML
│   ├── explainability/explain_score.py
│   ├── ai_agent/claims_agent.py    ← GPT-4o + tools
│   ├── api/                        ← FastAPI app
│   └── app/main.py
├── frontend/                       ← Next.js
├── azure/                          ← infra Azure ML (yaml de jobs, endpoints)
├── docs/
│   ├── arquitectura.md
│   ├── modelo_datos.md
│   ├── reglas_negocio.md
│   ├── uso_ia.md
│   └── limitaciones.md
├── scripts/                        ← limpieza, normalización, inyección de casos
├── tests/test_rules.py
└── presentation/pitch.pdf
```

---

## 🚀 Quickstart

### 1. Clonar y preparar entorno

```bash
git clone https://github.com/JairToxic/AchachAI.git
cd AchachAI
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
cp .env.example .env       # rellenar con credenciales Azure
```

### 2. Preparar datos

```bash
python scripts/clean_dataset.py        # arregla encoding, reescala montos
python scripts/normalize_tables.py     # genera 6 tablas parquet en data/processed/
python scripts/inject_critical_cases.py  # casos para reglas RF-01..04
```

### 3. Notebook de exploración

```bash
jupyter lab notebooks/01_exploracion_datos.ipynb
```

### 4. Levantar API + Frontend

```bash
# Terminal 1
uvicorn src.api.main:app --reload --port 8000

# Terminal 2
cd frontend && npm install && npm run dev
```

App disponible en http://localhost:3000.

---

## 📊 Reglas y señales implementadas

| Tipo | Cantidad | Detalle |
|------|----------|---------|
| Reglas críticas (RF-01..07) | 7 | Disparan semáforo rojo / amarillo automático |
| Señales puntuadas | 14 | Suman al score 0–100 |
| Modelo supervisado | XGBoost | Probabilidad de fraude entrenada con etiqueta sintética |
| Detección de anomalías | Isolation Forest | Casos fuera del comportamiento esperado |
| NLP | Embeddings | Similitud entre narrativas (clonadas) |

Ver detalle en [`docs/reglas_negocio.md`](docs/reglas_negocio.md).

---

## 🤖 Agente conversacional

El agente responde a las 12 preguntas que define el reto (sección 12), por ejemplo:

- ¿Cuáles son los 10 siniestros con mayor riesgo?
- ¿Por qué este siniestro fue marcado como alto riesgo?
- ¿Qué proveedores concentran más alertas?
- Genera un resumen ejecutivo de los casos críticos.

Implementado con Azure OpenAI GPT-4o + tools que consultan la base normalizada.

---

## 🔒 Seguridad, privacidad y ética

- ✅ Sólo se usan **datos sintéticos**, ningún dato personal real.
- ✅ El sistema emite **alertas**, nunca acusaciones.
- ✅ Toda alerta es **explicable**: se muestra qué regla / señal disparó el score.
- ✅ Credenciales en `.env` (jamás en el repo). `.env.example` con placeholders.
- ✅ Documentación de **limitaciones y falsos positivos** en [`docs/limitaciones.md`](docs/limitaciones.md).
- ✅ Decisión humana obligatoria antes de cualquier acción operativa.

---

## 📅 Cronograma (3 días)

| Día | Foco |
|-----|------|
| **D1** | Limpieza/normalización de datos · reglas RF-01..07 · score base · skeleton API y frontend |
| **D2** | Entrenamiento XGBoost en Azure ML · endpoint desplegado · agente GPT-4o · dashboard funcional |
| **D3** | Explicabilidad · pruebas · pulido visual · pitch deck · ensayo demo |

---

## 👥 Equipo

| Rol | Integrante |
|-----|------------|
| Lead / ML | Jair Sánchez |
| ... | _por completar_ |

---

## 📄 Licencia

Uso exclusivo para el hackIAthon 2026. Dataset sintético sin información personal real.

---

**Etiquetas:** `#hackIAthon` `#IAenEcuador` `#AgenteIA` `#AgenteASUR` `#DesafíoTechIA` `#AIChallenge` `#IdeasQueImpactan`
