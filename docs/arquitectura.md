# Arquitectura — AchachAI

> Documento de arquitectura técnica para el reto Aseguradora del Sur · hackIAthon 2026.

## 1. Vista de alto nivel

```
                                ┌──────────────────────────┐
                                │   Analista antifraude     │
                                └─────────────┬────────────┘
                                              │
                                ┌─────────────▼────────────┐
                                │  Frontend Next.js 14      │
                                │  - Bandeja de casos       │
                                │  - Detalle + explicación  │
                                │  - Chat con el agente     │
                                │  - Ranking proveedores    │
                                └─────────────┬────────────┘
                                              │ HTTPS / JSON
                                ┌─────────────▼────────────┐
                                │  FastAPI Backend          │
                                │  /score   /chat           │
                                │  /casos   /proveedores    │
                                │  /alertas /reportes       │
                                └────┬───────────┬─────────┘
                                     │           │
            ┌────────────────────────┘           └─────────────────────┐
            │                                                          │
┌───────────▼────────────┐  ┌─────────────────────┐  ┌────────────────▼─────────┐
│  Motor de Reglas        │  │ Azure ML Endpoint   │  │ Azure OpenAI GPT-4o      │
│  (Python, módulo local) │  │ (XGBoost + IForest) │  │ - Agente conversacional  │
│  - 7 reglas críticas    │  │ - Score 0..1        │  │ - Resumen / explicación  │
│  - 14 señales puntuadas │  │ - SHAP values       │  │ - Embeddings narrativas  │
└───────────┬─────────────┘  └──────────┬──────────┘  └────────────┬─────────────┘
            │                           │                           │
            └─────────────┬─────────────┘                           │
                          │                                         │
                ┌─────────▼──────────┐                              │
                │ Score híbrido       │                              │
                │ + semáforo          │                              │
                │ + explicación       │                              │
                └─────────┬───────────┘                              │
                          │                                          │
                ┌─────────▼──────────────────────────────────────────▼──────┐
                │  Capa de datos (parquet en disco + DuckDB para queries)   │
                │  Tablas: siniestros, polizas, asegurados, vehiculos,      │
                │           proveedores, documentos, conductores            │
                └────────────────────────────────────────────────────────────┘
```

## 2. Componentes

### 2.1 Capa de datos
- **Origen**: CSV sintético (`data/raw/`) generado por el equipo.
- **Procesamiento**: scripts en `scripts/` (clean → normalize → inject) → `data/processed/*.parquet`.
- **Acceso runtime**: DuckDB sobre los parquet (rápido para el dashboard) + pandas para feature engineering.

### 2.2 Motor de reglas (`src/rules/fraud_rules.py`)
- Implementa las 7 reglas críticas RF-01..07 (semáforo rojo/amarillo automático).
- Implementa las 14 señales puntuadas con los pesos exactos del reto (sección 7).
- Cada regla devuelve `{codigo, descripcion, puntos, evidencia}` para trazabilidad.

### 2.3 Modelo ML (Azure Machine Learning)
- **Algoritmo principal**: XGBoost clasificador binario, target = `etiqueta_fraude_simulada`.
- **Detección de anomalías complementaria**: Isolation Forest sobre features numéricas.
- **Entrenamiento**: Azure ML Compute (Standard_DS3_v2), tracking con MLflow.
- **Registro**: modelo registrado en el workspace con versión.
- **Despliegue**: managed online endpoint en Azure ML, escalado a 1 instancia (suficiente para demo).
- **Explicabilidad**: SHAP values precalculados, top features por predicción.

### 2.4 Agente conversacional (Azure OpenAI GPT-4o)
- Endpoint Azure OpenAI con deployment de `gpt-4o` y `text-embedding-3-large`.
- Tools:
  - `query_casos(filtros)` → consulta DuckDB
  - `get_score_detail(id_siniestro)` → invoca endpoint Azure ML + reglas
  - `similar_narratives(id_siniestro)` → embeddings sobre `descripcion`
  - `provider_stats(id_proveedor)` → agregaciones
- Responde a las 12 preguntas requeridas en sección 12 del reto.

### 2.5 Backend FastAPI (`src/api/`)
| Endpoint | Método | Función |
|----------|--------|---------|
| `/score/{id_siniestro}` | GET | Devuelve score + semáforo + reglas activadas + explicación |
| `/casos` | GET | Bandeja paginada, filtros por nivel/ramo/ciudad |
| `/chat` | POST | Pasa al agente GPT-4o |
| `/proveedores/ranking` | GET | Top proveedores por concentración de alertas |
| `/reportes/ejecutivo` | GET | Resumen ejecutivo generado por el agente |
| `/health` | GET | Healthcheck (incluye estado de Azure ML endpoint) |

### 2.6 Frontend Next.js 14
- App Router + Server Components donde es posible.
- Tailwind + shadcn/ui para componentes.
- Páginas:
  - `/` — Dashboard con KPIs (total casos, % rojo/amarillo/verde, monto en riesgo)
  - `/casos` — Bandeja filtrable
  - `/casos/[id]` — Detalle: timeline, reglas activadas, SHAP, narrativa, similares
  - `/chat` — Agente conversacional
  - `/proveedores` — Ranking + grafo de relaciones

## 3. Flujo de scoring de un siniestro

```
1. Usuario abre /casos/{id} en el frontend
2. Frontend → GET /score/{id} → FastAPI
3. FastAPI:
   a) Carga el siniestro y sus relacionados desde DuckDB
   b) Ejecuta motor de reglas → puntos por señal + reglas críticas
   c) POST al endpoint Azure ML → probabilidad XGBoost (0..1) + SHAP top-5
   d) Combina: score_final = w1 * score_reglas + w2 * prob_ml * 100
                          + bonus si regla crítica RF-01..04
   e) Si hay reglas críticas → forzar semáforo según RF-01..07
   f) Llama Azure OpenAI para generar explicación en lenguaje natural
4. Devuelve JSON con: score, nivel, reglas_activadas, top_features, explicacion
5. Frontend renderiza
```

## 4. Despliegue (en demo y futuro)

| Recurso | Para la demo | Producción futura |
|---------|--------------|-------------------|
| Frontend | localhost:3000 (`npm run dev`) | Azure Static Web Apps |
| Backend | localhost:8000 (uvicorn) | Azure Container Apps |
| Modelo ML | Azure ML Managed Online Endpoint | Idem + autoscale |
| Azure OpenAI | Recurso compartido | Idem + private endpoint |
| Datos | Parquet local | Azure Data Lake Storage Gen2 |
| Auth | — | Azure AD / Entra ID |

## 5. Seguridad

- Todas las credenciales vía `.env` (jamás en repo).
- Endpoint Azure ML autenticado con key (en `.env`).
- Azure OpenAI con resource-level RBAC.
- Logs sin PII (los datos son sintéticos, pero buena práctica).
- Frontend → Backend con CORS restringido en producción.

## 6. Escalabilidad

- DuckDB → reemplazable por Azure SQL / Synapse sin cambiar la capa de queries.
- Modelo registrado en Azure ML → versiones múltiples + A/B testing.
- Reglas en módulo Python → migrables a Drools / motor declarativo si el negocio lo pide.
- Agente: con prompt caching habilitado en Azure OpenAI para bajar costo en producción.
