---
title: AchachAI
subtitle: Detector de Posibles Fraudes en Siniestros Vehiculares
author: Equipo AchachAI · Reto Aseguradora del Sur
date: hackIAthon 2026
---

# AchachAI

## Detector de Posibles Fraudes en Siniestros Vehiculares

**Reto:** Aseguradora del Sur · hackIAthon 2026
**Stack:** Azure ML · Azure AI Foundry (gpt-5-mini) · FastAPI · Next.js
**Repo:** github.com/JairToxic/AchachAI

> *La solución genera **alertas de revisión**, no acusaciones de fraude.*

---

# Slide 1 · El problema (1 min)

## El analista antifraude pierde tiempo en lo obvio

- **15.000+ siniestros al mes** en una aseguradora típica de Ecuador
- **Solo 6-8%** son posibles fraudes — pero hay que revisar **todos**
- La detección manual depende de:
  - Experiencia del analista (ojo entrenado)
  - Cruce mental de múltiples variables (póliza, asegurado, vehículo, proveedor, documentos)
  - Reglas dispersas en Excel y manuales

## Consecuencias

| Pérdida directa | Indirecta |
|-----------------|-----------|
| Pagos a fraudes que pasan filtro | Tiempo del analista en casos verdes |
| Reservas sobreestimadas | Atraso en pagos legítimos |
| Riesgo regulatorio (SBS) | Frustración del cliente honesto |

---

# Slide 2 · La solución (1 min)

## Un sistema HÍBRIDO de 3 capas

```
┌─────────────────────────────────────────────────────────┐
│  1. REGLAS DETERMINÍSTICAS (7 críticas + 14 señales)   │
│      → trazable, auditable, semáforo rojo/amarillo     │
├─────────────────────────────────────────────────────────┤
│  2. MODELO ML (XGBoost en Azure ML)                    │
│      → captura patrones implícitos no obvios           │
├─────────────────────────────────────────────────────────┤
│  3. AGENTE CONVERSACIONAL (Azure AI Foundry GPT-5-mini)│
│      → analista pregunta en lenguaje natural           │
└─────────────────────────────────────────────────────────┘
```

## Cada caso recibe

- ✅ **Score 0-100** + semáforo VERDE/AMARILLO/ROJO
- ✅ **Reglas activadas** con evidencia concreta (citas a IDs, fechas, montos)
- ✅ **Explicación en lenguaje natural** generada por GPT-5-mini
- ✅ **Top 5 features SHAP** del modelo (interpretabilidad)

---

# Slide 3 · Demo funcional (4 min)

## En vivo durante el pitch

### A. Dashboard ejecutivo (`localhost:3000/`)
- 8 KPIs: total casos, fraudes, monto en riesgo, proveedores restrictivos
- Top 8 siniestros con mayor riesgo (calculado en vivo)
- Distribución por cobertura y estado

### B. Caso crítico: `SIN-0900000`
- Cobertura `Robo` + estado `Pago Total` + pagado=98% suma asegurada
- Score: **76 ROJO** por regla **RF-01 (PTxRB)**
- Banner rojo con evidencia: "pagado=$24,500 = 98% suma_asegurada"

### C. Agente conversacional (`/chat`)
- Pregunta: *"¿Qué proveedores concentran más alertas?"*
- Agente llama tool `ranking_proveedores` automáticamente
- Devuelve tabla markdown con PRV-0002 (429 siniestros), PRV-0044 (LISTA RESTRICTIVA), etc.
- Termina con: *"Acción sugerida: priorizar revisión de PRV-0044 antes de aprobar pagos pendientes."*

### D. Bandeja + filtros
- Filtrar por ciudad "Loja", cobertura "Robo"
- Click en cualquier caso → detalle con reglas + señales

---

# Slide 4 · Arquitectura y uso de IA (2 min)

## Diagrama técnico

```
┌─────────────┐
│ Analista UI │ Next.js (Vercel-ready)
└──────┬──────┘
       │ HTTP
┌──────▼──────────────────────────────────┐
│  FastAPI Backend (10 endpoints)         │
└──┬───────┬───────────┬──────────────────┘
   │       │           │
   ▼       ▼           ▼
┌─────┐ ┌──────────┐ ┌─────────────────┐
│Reglas│ │Azure ML │ │Azure AI Foundry │
│Python│ │Endpoint │ │gpt-5-mini + 8   │
│ +DuckDB│ │XGBoost  │ │tools (DuckDB)   │
└─────┘ └──────────┘ └─────────────────┘
            │
            ▼
   Modelo `achachai-fraude-xgb v2`
   registrado en `mlw-achachai` workspace
```

## Decisiones técnicas clave

| Decisión | Por qué |
|----------|---------|
| **Modelo registrado en Azure ML** | Versionado, auditable, accesible vía API |
| **Compute cluster min=0 nodes** | $0 idle, escala on-demand |
| **Environment curado sklearn-1.5** | Más rápido que build de imagen custom |
| **DuckDB sobre parquet** | Queries SQL sub-segundo sobre 15K filas, sin DB server |
| **Function calling con 8 tools** | Agente determinístico, no inventa datos |
| **Embeddings text-3-large** | Detección de narrativas clonadas (RF-07) |

---

# Slide 5 · Impacto de negocio (1 min)

## Métricas técnicas del modelo

| Métrica | Valor | Objetivo reto |
|---------|-------|---------------|
| AUC-ROC | **0.94** | ≥ 0.85 ✅ |
| PR-AUC | **0.64** | ≥ 0.60 ✅ |
| Recall en casos inyectados | **97.5%** | — ✅ |

## Métricas del sistema híbrido (reglas + modelo)

- **39/40 casos críticos inyectados** detectados como ROJO o AMARILLO
- **~10% falsos positivos** sobre no-fraudes (mayormente por RF-03 que es comportamiento correcto)
- **Latencia evaluación + score:** <100ms por caso (modelo local) · <500ms (endpoint Azure)
- **Costo agente:** ~$0.014 USD por consulta (gpt-5-mini)

## Proyección de impacto

Si Aseguradora del Sur procesa **30.000 siniestros/año** con un fraude promedio de **$8.000 USD**:

| Escenario | Detección | Recuperación anual |
|-----------|-----------|-------------------|
| Hoy (manual) | 30% | $432.000 |
| AchachAI (recall 70% combinado) | 70% | **$1.008.000** |
| **Diferencia** | +40% | **+$576.000 USD/año** |

> Inversión Azure estimada: ~$300/mes en producción = $3.600/año.
> **ROI: 160x**

---

# Slide 6 · Limitaciones y próximos pasos (1 min)

## Lo que NO hace

- ❌ No rechaza siniestros automáticamente
- ❌ No toma decisiones de pago
- ❌ No acusa de fraude
- ❌ No sustituye al analista

## Limitaciones conocidas

1. **Dataset sintético** — métricas se validan en piloto con datos reales anonimizados
2. **Solo Vehículos** — escalar a Salud, Vida, Hogar
3. **Recall 57%** del modelo solo (compensado con reglas — sistema combinado >85%)
4. **RF-03 muy amplia** — refinarla a nivel asegurado+proveedor en producción
5. **Sin imágenes** — agregar visión por computadora para fotos de daños

## Roadmap post-hackathon

| Sprint | Objetivo |
|--------|----------|
| 2 semanas | Piloto con 1.000 siniestros reales anonimizados |
| 1 mes | Calibrar pesos del semáforo con histórico real |
| 2 meses | Integración API con sistema core de Aseguradora |
| 3 meses | Extender a ramos Salud + Hogar |
| 6 meses | Dashboard de monitoreo (drift, fairness, ROI mensual) |

---

# Slide 7 · Equipo y entregables (resumen)

## Entregables completados

| # | Entregable | Estado |
|---|-----------|--------|
| 1 | Prototipo funcional | ✅ FastAPI + Next.js corriendo localmente |
| 2 | Código fuente | ✅ github.com/JairToxic/AchachAI |
| 3 | Dataset sintético | ✅ 15.460 siniestros + 40 casos críticos |
| 4 | README + Quickstart | ✅ |
| 5 | Arquitectura | ✅ `docs/arquitectura.md` |
| 6 | Modelo de datos | ✅ 7 tablas relacionales |
| 7 | Explicación del modelo (Model Card) | ✅ `docs/model_card.md` |
| 8 | Rúbrica de alertas | ✅ `docs/reglas_negocio.md` |
| 9 | Demo funcional | ✅ live durante pitch |
| 10 | Presentación ejecutiva | ✅ este deck |

## Tests

- ✅ **64 tests unitarios** pasando en 0.3s
- ✅ Smoke test E2E sobre 40 casos críticos: 97.5% detectados

## Stack utilizado

- **Azure Machine Learning** workspace `mlw-achachai`
- **Azure AI Foundry** recurso `ais-achachai` con deployments `gpt-5-mini` + `text-embedding-3-large`
- **XGBoost 2.0** entrenado local + registrado en Azure ML
- **FastAPI** backend
- **Next.js 14 + TypeScript + Tailwind** frontend
- **DuckDB** para queries sobre parquet

---

# Slide 8 · Preguntas frecuentes del jurado

## ¿Cómo evitan que la IA acuse a un cliente injustamente?

1. **System prompt** del agente prohíbe explícitamente acusar.
2. **Tests automáticos** verifican que las respuestas no contengan palabras como "fraude confirmado", "criminal", etc.
3. **Toda alerta** es revisada por humano antes de cualquier acción.
4. **Score es input al analista**, NO output al cliente.

## ¿Cómo detectan similitud entre 2 narrativas?

1. Embeddings vectoriales (3072 dims) con `text-embedding-3-large`.
2. Similitud coseno entre cada par.
3. Si > 0.85 → señal 13 activa (4-8 puntos).
4. Si > 0.90 → regla RF-07 (semáforo AMARILLO).

## ¿Cómo ayudan al analista a decidir más rápido?

1. **Bandeja ordenada por score** — los casos rojos arriba.
2. **1 click → detalle con TODA la evidencia** (no tiene que buscar nada).
3. **Chat con el agente** — pregunta natural, respuesta con tabla y acción sugerida.
4. **Generación de reportes ejecutivos** en 1 click.

---

# Slide 9 · Live demo — guión de 4 minutos

| Tiempo | Pantalla | Acción |
|--------|----------|--------|
| 0:00 | Dashboard `/` | "Vista consolidada: 15.460 casos, $102M en reclamos, $9.8M en posibles fraudes (10%)" |
| 0:30 | Cards KPI | Resaltar "4 proveedores en lista restrictiva" y "1.975 docs inconsistentes" |
| 0:50 | Tabla top riesgo | "Estos 8 casos los detectó el motor de reglas combinado con XGBoost" |
| 1:10 | Click en `SIN-0900000` | "Caso de PTxRB inyectado" — mostrar banner rojo |
| 1:30 | Detalle del caso | Reglas activadas, señales puntuadas, explicación del agente |
| 2:00 | Bandeja `/casos` | Filtrar por ciudad Loja, ver casos sospechosos |
| 2:30 | Chat `/chat` | Pregunta sugerida: "¿Qué proveedores concentran más alertas?" |
| 3:00 | Respuesta del agente | "Mostró tabla con PRV-0044 LISTA RESTRICTIVA + acción sugerida" |
| 3:20 | Otra pregunta | "Genera un resumen ejecutivo de los casos críticos" |
| 3:50 | Portal Azure ML | Mostrar modelo `achachai-fraude-xgb v2` registrado |
| 4:00 | Cierre | "Cualquier app puede llamar al endpoint: `curl POST /score`" |

---

# Slide 10 · Cierre

## "AchachAI" significa "rápido" en kichwa.

Eso es exactamente lo que damos al analista antifraude:
**del Excel manual al insight en 30 segundos.**

### Repo y demo

- **GitHub:** github.com/JairToxic/AchachAI
- **Demo en vivo:** localhost durante el pitch
- **Azure portal:** ml.azure.com/workspaces/mlw-achachai

### Hashtags

#hackIAthon #IAenEcuador #AgenteIA #AgenteASUR #DesafíoTechIA

### Sponsors etiquetados

@viamatica @aseguradoradelsurec @uteg_universidad @revistaitahora @citytech.ecuador @notionhq

---

## Gracias

**Preguntas?**
