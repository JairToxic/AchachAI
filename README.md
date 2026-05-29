# AchachAI · Ojos de Cóndor — Detector Multi-Ramo de Posibles Fraudes en Siniestros

> **hackIAthon 2026 · Reto Aseguradora del Sur**
> Equipo: **AchachAI** · Organizado por Viamática · Innovation Leader: Aseguradora del Sur

## 🦅 Demo en vivo (Azure App Service · East US 2)

| Servicio | URL pública |
|---|---|
| **🌐 Aplicación web (frontend)** | <https://achachai-app.azurewebsites.net/achachai> |
| **🔌 API (backend FastAPI)** | <https://achachai-api.azurewebsites.net> |
| **💚 Health check** | <https://achachai-api.azurewebsites.net/health> |
| **📁 Repositorio** | <https://github.com/JairToxic/AchachAI> |

## 👥 Equipo AchachAI

| Integrante | Rol |
|---|---|
| **Jair Sánchez** | Backend ML/IA, arquitectura Azure, integración Document Intelligence + GPT-4o Vision |
| **Pablo Arcos** | Frontend Next.js, UX del Modo Investigación, Cóndor Profesor, Voz Jarvis |
| **Cristina Molina** | Datos sintéticos multi-ramo, motor de reglas RF-01..07, calibración del modelo XGBoost |

---

**AchachAI** ("achachay" en kichwa significa _"¡qué frío!"_ — ese escalofrío que recorre el cuerpo cuando algo no encaja) es un prototipo end-to-end que combina **reglas de negocio + Machine Learning supervisado + detección de anomalías no supervisada + análisis multimodal de documentos (con forensia visual) + agente conversacional con orquestador de intenciones** para asignar a cada siniestro un **score 0–100** y un **semáforo Verde / Amarillo / Rojo**, con explicación auditable de cada decisión.

> ⚠️ **Principio fundacional**: el sistema produce **alertas para revisión humana, NUNCA acusaciones**. La decisión final siempre es del analista. Sección 17 del PDF del reto.

## 🆕 Lo nuevo desde la versión inicial (29 mayo 2026)

| Capa | Mejora |
|---|---|
| 📊 **Dataset** | 15K → **39.960 siniestros multi-ramo** (Vehículos 65% / Hogar 20% / Salud 15%) · 271 proveedores |
| 🤖 **Modelo** | XGBoost reentrenado: **AUC 0.974**, F1 **0.80**, Precision 0.75, Recall 0.86 |
| 🔬 **Forensia visual** | GPT-4o Vision detecta cambios de tipografía, texto sobrepuesto, firmas alteradas, documentos sintéticos |
| 📋 **Catálogo de inconsistencias** | 20+ tipos con descripción humana + mapeo a reglas RF + por qué importa cada una |
| 💬 **Agente con orquestador** | Clasifica intent (canned / explanation / data) → respuestas instantáneas para saludos, sin tools cuando no aplican |
| 🎤 **Voz Jarvis** | Web Speech API: STT con overlay grande, TTS con voz neuronal latina (off por default) |
| 🎓 **Cóndor Profesor** | Tour guiado nativo + asistente flotante en 9 pantallas con prompts contextuales |
| 🎨 **UI premium** | Markdown del cóndor con IDs como chips inline, callouts naranjas, headings con subrayado, JarvisHUD con KPIs auto-detectados |
| 🔔 **Notificaciones reales** | Campana del topbar conectada al backend (top_riesgo + alertas tempranas) |
| ⚡ **Performance** | **Cache persistente** del scoring en parquet (`data/processed/_top_riesgo_cache.parquet`) → `/top-riesgo` baja de **15-20s a <500ms** en cold start. Warmup en background al boot. Endpoint `/warmup` para verificar estado. |
| ☁️ **Deploy producción** | Azure App Service Linux **Premium P0v3** (East US 2) · Always On en backend y frontend · Blob Storage para embeddings · Plan compartido `asp-achachai` |

---

## ⚡ ATENCIÓN — Configuración de credenciales Azure (obligatorio)

Este proyecto **no funciona sin credenciales Azure válidas**. El archivo `.env` con las claves reales **NO está en el repo** (sólo está la plantilla `.env.example`).

### Lo que tenés que hacer antes de arrancar:

```bash
# 1. Copiar la plantilla
cp .env.example .env

# 2. Editar .env y reemplazar TODOS los <placeholder> con tus claves de Azure
```

### Variables que el código lee y QUE DEBES RELLENAR:

| Variable | Para qué | Dónde se crea |
|----------|----------|---------------|
| `AZURE_OPENAI_API_KEY` | Chat del agente + visión de fotos | Azure Portal → Azure OpenAI → Keys |
| `AZURE_OPENAI_ENDPOINT` | URL del recurso | mismo recurso |
| `AZURE_OPENAI_DEPLOYMENT_CHAT` | Nombre del deployment de `gpt-5-mini` | Azure AI Foundry → Deployments |
| `AZURE_OPENAI_DEPLOYMENT_VISION` | Nombre del deployment de `gpt-4o` | Azure AI Foundry → Deployments |
| `AZURE_DOCINTEL_KEY` | Análisis de facturas (`/evaluar-completo`) | Azure Portal → Document Intelligence → Keys |
| `AZURE_DOCINTEL_ENDPOINT` | URL del recurso DocIntel | mismo recurso |

Opcionales (si querés usar endpoint remoto en lugar del modelo local):
`AZURE_ML_ENDPOINT_URL`, `AZURE_ML_ENDPOINT_KEY`, `AZURE_SUBSCRIPTION_ID`.

Para el frontend, además crear `frontend/.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> 🔒 **No commitees el `.env`**. Está en `.gitignore`. Si lo subís por error, **rotá las claves en Azure inmediatamente**.

---

## 🏆 Cómo cubrimos cada dimensión de la rúbrica

| Dimensión | Peso | Nivel logrado | Evidencia |
|-----------|:----:|:-------------:|-----------|
| **Tecnología y Arquitectura** | 10% | **5/5 — Excepcional** | Código modular en `src/` separado por responsabilidad (ingestion, features, rules, models, ai_agent, document_analysis, api). Manejo de excepciones en cada tool y endpoint. `requirements.txt` versionado. `.env.example` documentado. Docs técnicas en `docs/` (arquitectura, modelo_datos, reglas_negocio, uso_ia, limitaciones). Tests en `tests/`. Frontend Next.js 14 con TypeScript. |
| **Análisis del Caso y Lógica** | 15% | **5/5 — Excepcional** | **Sistema híbrido de 5 capas** cruzando 7 tablas: (1) 7 reglas críticas RF-01..07, (2) 14 señales puntuadas, (3) XGBoost supervisado, (4) Isolation Forest no supervisado, (5) AutoEncoder PCA para anomalías sutiles. Cruza asegurado + proveedor + vehículo + narrativa + documentos + foto del daño. Detecta **redes** (proveedores en lista restrictiva, asegurados recurrentes, similitud de narrativas) y **anomalías no evidentes** (tool `anomalias_novedosas` encuentra patrones que el supervisado no vio). |
| **Uso de IA y Prototipo** | 40% | **5/5 — Excepcional** | **Enfoque genuinamente híbrido**: ML supervisado (XGBoost) + ML no supervisado (Isolation Forest + AutoEncoder PCA) + NLP (embeddings `text-embedding-3-large` para similitud de narrativas) + **Agente conversacional** con Azure OpenAI gpt-5-mini y **14 tools de function calling**. Procesamiento **multimodal**: tabular + facturas (Document Intelligence) + fotos (gpt-4o vision) + parte policial OCR, fusionados en un único score combinado con override por severidad. Genera reportes PDF descargables desde el chat. |
| **Explicabilidad y Ética** | 25% | **5/5 — Excepcional** | Cada score viene con: regla(s) crítica(s) disparadas, señales activadas con peso individual, fórmula explícita (`score = max(suma_señales, mínimo_forzado_por_reglas)`), explicación textual del agente, comparativa con percentiles de cartera. **El agente nunca acusa** (system prompt explícito). Documento [`docs/limitaciones.md`](docs/limitaciones.md) sobre sesgos, falsos positivos y datos sintéticos. **Auditoría de fairness** integrada (`/feedback/fairness`, Cohen's kappa por sucursal y cobertura). Cada decisión queda **trazada** (id_siniestro, regla, fecha, analista). |

---

## 🏗️ Arquitectura

<img width="1536" height="1024" alt="Complete architecture of AchachAI" src="https://github.com/user-attachments/assets/edcf26ab-3900-4e4d-9185-e8f21305ab57" />


Detalle completo: [`docs/arquitectura.md`](docs/arquitectura.md).

---

## 🧰 Stack técnico

| Capa | Tecnología |
|------|-----------|
| **Modelo ML supervisado** | XGBoost (entrenado en Azure ML, persistido en `runs/local/`) |
| **Modelo ML no supervisado** | Isolation Forest + AutoEncoder PCA (scikit-learn) |
| **LLM / Agente** | Azure OpenAI gpt-5-mini (chat + function calling sobre 14 tools) |
| **Visión** | Azure OpenAI gpt-4o (análisis de fotos del daño) |
| **OCR / documentos** | Azure Document Intelligence (`prebuilt-invoice` + `prebuilt-read`) |
| **NLP** | `text-embedding-3-large` (Azure OpenAI) para similitud de narrativas |
| **Backend** | FastAPI + Pydantic + DuckDB (queries sobre parquet) |
| **Frontend** | Next.js 14 (App Router) + TypeScript + Tailwind + SVG custom |
| **Reglas** | Python puro, módulo `src/rules` con tests en `tests/test_rules.py` |
| **Datos** | CSV sintético → 7 tablas normalizadas (parquet) |
| **Reportes** | HTML imprimible servido desde `/reportes/pdf` → `Ctrl+P` → PDF |
| **Repo / CI** | GitHub + GitHub Actions |
| **Hosting** | Azure App Service Linux **Premium P0v3** (1 vCPU dedicado + 4GB RAM) + Always On + warmup en background |
| **Cache** | Parquet `_top_riesgo_cache.parquet` (4500 casos pre-evaluados) + cache en memoria con TTL 5 min |

---

## ⚡ Performance y latencias (post-optimización)

| Endpoint | Cold start | Hit caliente | Notas |
|---|:---:|:---:|---|
| `GET /health` | <300 ms | <50 ms | Solo listar parquets |
| `GET /warmup` | <100 ms | <50 ms | Estado del precalentado (`top_riesgo_ready`, `agent_ready`) |
| `GET /casos?limit=50` | <600 ms | <200 ms | DuckDB sobre parquet, sin score |
| `GET /top-riesgo?limit=10` | **~500 ms** | **<50 ms** | Lee parquet pre-computado; antes era 15-20 s |
| `GET /anomalias-novedosas` | ~3-5 s | <500 ms | Isolation Forest cacheado 10 min |
| `POST /chat` (saludo) | ~50 ms | ~50 ms | Orquestador `canned` sin Azure OpenAI |
| `POST /chat` (con tools) | ~5-10 s | ~3-5 s | gpt-5-mini + function calling |
| `POST /evaluar-completo` | ~15-25 s | — | Document Intelligence + GPT-4o Vision |

**Trucos clave que aplicamos:**

1. **Cache en parquet** del scoring sobre 4500 casos → sobrevive cold starts y reinicios.
2. **Warmup background** en `@app.on_event("startup")` que precarga top_riesgo + ClaimsAgent sin bloquear `/health`.
3. **Orquestador de intenciones** (`src/ai_agent/orchestrator.py`) que evita ir al LLM para saludos / agradecimientos / despedidas (0 ms).
4. **Always On** activado en ambos sites para evitar suspensión por inactividad.
5. **Plan Premium P0v3** con vCPU dedicado (vs CPU compartida del tier Basic).

---

## 📁 Estructura del repositorio

```
AchachAI/
├── README.md                       ← este archivo
├── requirements.txt                ← dependencias Python (ver sección)
├── .env.example                    ← PLANTILLA — copiar a .env y rellenar
├── .gitignore
├── data/
│   ├── Data set documentos evento/ ← dataset OFICIAL del reto (xlsx 500 casos + PDFs reales)
│   │   ├── Evento Datasets_Sinteticos_Fraude_500_v2.xlsx
│   │   ├── FACTURAS/               ← 15 facturas PDF
│   │   ├── PARTE POLICIAL/         ← 6 partes policiales PDF
│   │   └── DECLARACIÓN DE ACCIDENTE/ ← 5 declaraciones PDF
│   ├── raw/                        ← dataset legacy CSV (deprecated)
│   ├── processed/                  ← 7 tablas normalizadas (parquet) + similitudes
│   └── synthetic/                  ← casos extremos inyectados (RF-01..05)
├── notebooks/
│   ├── 01_exploracion_datos.ipynb
│   ├── 02_modelo_fraude.ipynb
│   ├── 03_evaluacion_modelo.ipynb
│   ├── 04_anomalias_patrones_nuevos.ipynb
│   └── 05_autoencoder_anomalias.ipynb
├── src/
│   ├── ingestion/                  ← carga + normalización
│   ├── features/                   ← feature engineering
│   ├── rules/                      ← motor de reglas + contexto + scoring
│   ├── models/                     ← entrenamiento XGBoost
│   ├── ai_agent/
│   │   ├── claims_agent.py         ← agente con system prompt
│   │   └── tools.py                ← 14 tools de function calling
│   ├── document_analysis/
│   │   └── analyze.py              ← Document Intelligence + GPT-4o vision
│   └── api/main.py                 ← FastAPI app
├── frontend/                       ← Next.js 14
│   └── src/app/achachai/
│       ├── _components/Chat.tsx, Investigation.tsx, Screens.tsx, ...
│       └── page.tsx
├── azure/                          ← infra Azure ML (yaml de jobs)
├── docs/
│   ├── arquitectura.md
│   ├── modelo_datos.md
│   ├── reglas_negocio.md
│   ├── uso_ia.md
│   └── limitaciones.md             ← sesgos, falsos positivos, ética
├── scripts/                        ← limpieza, normalización, inyección
├── runs/local/                     ← modelos persistidos (joblib)
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
.venv\Scripts\activate            # Windows PowerShell
# source .venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
```

### 2. Configurar credenciales Azure (OBLIGATORIO)

```bash
cp .env.example .env
# ABRIR .env Y REEMPLAZAR TODOS LOS <placeholder> CON TUS CLAVES
```

Sin esto, `/chat` y `/evaluar-completo` fallan con `KeyError: 'AZURE_OPENAI_API_KEY'`.

### 3. Preparar datos (sólo primera vez)

**Dataset oficial del reto** (xlsx con 500 casos multi-ramo + PDFs reales):

```bash
python scripts/load_xlsx_dataset.py        # ingesta xlsx -> 7 parquets + similitudes
python scripts/inject_critical_cases.py    # +40 casos extremos para demo RF-01..05
```

`load_xlsx_dataset.py` reemplaza al viejo `clean_dataset.py + normalize_tables.py`
(que quedan deprecated, sólo aplicables al CSV legacy en `data/raw/`). Lee:

- `data/Data set documentos evento/Evento Datasets_Sinteticos_Fraude_500_v2.xlsx`
- PDFs reales en `data/Data set documentos evento/{FACTURAS,PARTE POLICIAL,DECLARACIÓN DE ACCIDENTE}/`

y genera los 7 parquets en `data/processed/` con el mismo esquema `snake_case`
que el resto del pipeline ya consumía. La columna `ruta_pdf` en
`documentos.parquet` apunta al PDF físico (26 documentos reales: 6 partes
policiales + 5 declaraciones + 15 facturas).

### 4. Levantar backend

```bash
uvicorn src.api.main:app --reload --port 8000
```

Verifica: http://localhost:8000/health debe responder `{"azure_openai_configured": true}`.

### 5. Levantar frontend

```bash
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm install
npm run dev
```

App en http://localhost:3000.

---

## 📊 Reglas, señales y modelos implementados

| Capa | Cantidad | Detalle |
|------|----------|---------|
| Reglas críticas (RF-01..07) | 7 | Disparan semáforo automático (proveedor restrictivo, póliza vencida, monto > suma asegurada, etc.) |
| Señales puntuadas | 14 | Suman al score 0–100 (timing sospechoso, historial, docs incompletos, narrativa clonada, ...) |
| Modelo supervisado | XGBoost | Probabilidad de fraude entrenada con etiqueta sintética + casos inyectados |
| Anomalía estadística | Isolation Forest | Outliers en espacio multidimensional (`tool anomalias_novedosas`) |
| Anomalía sutil | AutoEncoder PCA | Reconstrucción con error alto = patrón raro (`/anomalias-autoencoder`) |
| NLP narrativas | Embeddings `text-embedding-3-large` | Similitud > 0.95 → posible copia |
| Visión | GPT-4o vision | Análisis de la foto del daño vs descripción textual |
| OCR estructurado | Document Intelligence | Extracción de facturas + parte policial |

Detalle completo en [`docs/reglas_negocio.md`](docs/reglas_negocio.md).

---

## 🤖 Agente conversacional

Responde las **12 preguntas obligatorias** del reto (sección 12 del PDF) con **14 tools de function calling**:

| Pregunta del reto | Tool |
|--------------------|------|
| Top 10 siniestros con mayor riesgo | `top_riesgo` |
| ¿Por qué este siniestro es alto riesgo? | `detalle_siniestro` |
| Proveedores con más alertas | `ranking_proveedores` |
| Ramos / coberturas con mayor % sospechoso | `estadisticas_por_cobertura` |
| Ciudades con mayor concentración | `ranking_ciudades` |
| Asegurados con más reclamos | `asegurados_recurrentes` |
| Documentos faltantes en casos críticos | `docs_faltantes` |
| Montos atípicos | `montos_atipicos` |
| Siniestros cerca del inicio de póliza | `siniestros_borde_vigencia` |
| Patrones que se repiten | encadena `ranking_proveedores` + `asegurados_recurrentes` + `anomalias_novedosas` |
| Resumen ejecutivo / reporte PDF | `generar_reporte_pdf` |
| Casos a revisar primero | `top_riesgo` ordenado |

Tools adicionales: `evaluar_caso_hipotetico`, `simulacion_ahorro`, `exportar_reporte`.

---

## 🔒 Seguridad, privacidad y ética

- ✅ Sólo se usan **datos sintéticos**, ningún dato personal real.
- ✅ El sistema emite **alertas, nunca acusaciones** (system prompt del agente lo refuerza).
- ✅ Toda alerta es **explicable**: regla disparada, señales con peso individual, fórmula explícita.
- ✅ **Credenciales en `.env`** (jamás en el repo). `.env.example` con placeholders.
- ✅ Documentación de **limitaciones, sesgos y falsos positivos**: [`docs/limitaciones.md`](docs/limitaciones.md).
- ✅ **Auditoría de fairness** integrada: Cohen's kappa por sucursal y cobertura (`/feedback/fairness`).
- ✅ **Decisión humana obligatoria** antes de cualquier acción operativa.
- ✅ Score **trazable**: cada decisión queda persistida con id_siniestro, regla activada, fecha y analista.

---

## 📅 Cronograma de ejecución (3 días)

| Día | Foco |
|-----|------|
| **D1** | Limpieza/normalización (7 tablas) · reglas RF-01..07 + 14 señales · skeleton API y frontend |
| **D2** | Entrenamiento XGBoost · IsolationForest · AutoEncoder · agente con 14 tools · multimodal (factura + foto) |
| **D3** | Explicabilidad + comparativa cartera · PDFs descargables · auditoría fairness · pulido visual + pitch |

---

## 👥 Equipo

| Integrante | Rol |
|---|---|
| **Jair Sánchez** | Backend ML/IA, arquitectura Azure, Document Intelligence + GPT-4o Vision, orquestador del agente, optimización de latencias (cache parquet + warmup) |
| **Pablo Arcos** | Frontend Next.js, UX del Modo Investigación, Cóndor Profesor, Voz Jarvis (Web Speech API), markdown premium con chips |
| **Cristina Molina** | Datos sintéticos multi-ramo (39.960 siniestros), motor de reglas RF-01..07, calibración del modelo XGBoost, etiquetado y validación |

---

## Demo

https://youtu.be/Yx5kiuJ7PCU

## 📄 Licencia

Uso exclusivo para el hackIAthon 2026. Dataset sintético sin información personal real.

---

**Etiquetas:** `#hackIAthon` `#IAenEcuador` `#AgenteIA` `#AgenteASUR` `#DesafíoTechIA` `#AIChallenge` `#IdeasQueImpactan`
