# Limitaciones, riesgos y mitigaciones

> Documento exigido por el reto (criterio de Explicabilidad y Ética, 25%).
> Última actualización: 2026-05-27.

## 1. Limitaciones conocidas del prototipo

### 1.1 Datos
- **Sintéticos**: el dataset fue generado por el equipo. No refleja la distribución real de siniestros de Aseguradora del Sur. Los patrones aprendidos por el modelo son los que existen en la generación sintética, no necesariamente los del mundo real.
- **Etiqueta de fraude simulada**: el campo `etiqueta_fraude_simulada` es una aproximación. En producción la etiqueta requeriría confirmación de un comité antifraude o de un proceso judicial.
- **Un solo ramo**: el prototipo cubre únicamente **Vehículos** (25.460 siniestros). El reto permite otros ramos (salud, vida, hogar), pero el alcance se acotó por tiempo.
- **Imágenes y documentos**: SÍ se procesan (Azure Document Intelligence + GPT-4o Vision via `/analyze-document`), pero la cobertura es por documento individual; no hay batching ni archivos masivos.
- **Asignación de analistas simulada**: el dataset no trae `asignado_a`, así que la carga por analista se calcula con un hash determinista del `id_siniestro`. Es ilustrativa, no operativa.

### 1.2 Modelo
- **Sobreajuste posible**: con sólo 15.420 filas y ~6% de positivos, el modelo puede memorizar patrones idiosincráticos del generador. Mitigación: split estratificado + cross-validation + monitoreo de la diferencia train/test.
- **Drift**: si las prácticas de fraude cambian, el modelo se degrada. Mitigación: pipeline de reentrenamiento mensual en Azure ML + monitoreo de feature drift.
- **Sesgos**: variables como `ciudad` o `segmento` pueden introducir sesgos demográficos. Mitigación: análisis de fairness por grupo + revisión de feature importance.

### 1.3 Reglas
- Los **pesos** de cada señal vienen del documento del reto y son referenciales. En producción deberían calibrarse contra histórico real.
- Algunas reglas (RF-04 "dinámica imposible") dependen de interpretación del LLM y son inherentemente subjetivas.

### 1.4 LLM / Agente
- **Alucinaciones**: GPT-5-mini puede inventar datos si no usa las tools. Mitigación: system prompt restrictivo + tools como única fuente de verdad + validación de IDs en respuestas.
- **Latencia**: cada consulta del agente toma 2-5 segundos. No es apto para volúmenes masivos sin batch.
- **Costo**: la consulta agentica cuesta ~$0.01-0.05 por interacción. En producción se debe habilitar prompt caching y rate limiting.
- **Idioma**: el agente fue afinado en español. Respuestas en otros idiomas pueden degradarse.
- **Filtros de contenido Azure**: GPT-4o Vision puede bloquear análisis por jailbreak detector si la descripción del siniestro arrastra palabras sensibles. Mitigación implementada: prompt sanitizado + fallback elegante que devuelve resultado con `score_inconsistencia=0` y nota explicativa en vez de 500.

### 1.5 Endpoint de evaluación en vivo (`/evaluar`)
- El endpoint POST `/evaluar` permite cargar un siniestro hipotético sin pasar por la base. Usa **defaults** para campos no provistos (suma asegurada 15K, edad conductor 35, etc.) lo que puede no reflejar la realidad del caso del jurado.
- El contexto de comparación está vacío: el caso hipotético NO se compara contra los 25K reales para frecuencias del asegurado/conductor/vehículo (porque el `id_asegurado` no existe en el dataset). Las señales S3/S4/S5 sólo dispararán si el usuario pasa explícitamente `historial_siniestros_asegurado > 0`.

### 1.6 Feedback del analista (`/feedback`)
- Persiste a `data/processed/feedback_analistas.parquet` pero NO retroalimenta automáticamente al modelo. El loop de aprendizaje real requeriría: (a) acumular feedback, (b) reentrenar XGBoost con muestra reciente, (c) deployar nueva versión al endpoint Azure ML. Eso queda fuera del scope del hackathon.
- La métrica "alineación con modelo" en `/feedback/stats` es heurística simple (acuerdo entre `decision` y `nivel_modelo`), no es un Cohen's kappa ni un análisis de causalidad.

## 1.7 Análisis de sesgo concreto (sección 20 del PDF)

El reto exige *"usar variables explicables y análisis de sesgo"*. Esto es lo que detectamos en el prototipo actual:

### Sesgo por sucursal / ciudad
- **Quito** y **Guayaquil** concentran el 36% de los casos. Si el modelo aprende un sesgo geográfico, podría sobrepuntuar a esas ciudades simplemente por volumen.
- **Mitigación**: el feature `sucursal` NO entra directo al modelo; solo `ciudad_evento` y derivados temporales. Verificable en `src/features/build_features.py`.
- **Riesgo residual**: las señales agregadas (top proveedores, top asegurados) sí dependen de volumen — un taller honesto pero muy activo en Quito puede entrar al ranking junto con uno sospechoso.

### Sesgo por segmento de cliente
- El campo `segmento` del asegurado (Personas, PyME, Corporativo) está correlacionado con monto y tipo de cobertura. Si el modelo asocia "PyME → más fraude", puede penalizar injustamente a un segmento.
- **Mitigación**: no se usa `segmento` como feature directa. Se usa `reclamos_ultimos_12_meses` (medible y justificable).

### Sesgo por proveedor "nuevo"
- La regla heurística "proveedor con `NEW` en el ID concentra más casos" es un patrón de la generación sintética. En producción, un proveedor nuevo legítimo (recién dado de alta) NO debería ser flageado solo por ser nuevo.
- **Mitigación**: la regla RF-03 sólo dispara si está en **lista restrictiva** explícita, no por antigüedad. Las señales 7 (proveedor recurrente) usan el conteo de casos, no la fecha de alta.

### Trazabilidad de cada decisión
- Cada caso evaluado expone `reglas_criticas` y `senales_activadas` con `evidencia` textual por ítem. Es auditable manualmente.
- El analista puede registrar feedback (`POST /feedback`) que persiste con justificación, lo que cierra el loop para auditorías futuras.

### Métricas de fairness pendientes
Lo que NO hicimos por tiempo y dejamos documentado como deuda:
- Cohen's kappa entre decisiones humanas y nivel del modelo (sólo tenemos un % alineación simple).
- Demographic parity por sucursal: comparar tasa de falsos positivos entre ciudades.
- Equalized odds por segmento de cliente.

## 2. Riesgos éticos y mitigaciones

| Riesgo | Mitigación implementada |
|--------|-------------------------|
| Confundir alerta con acusación | Lenguaje obligatorio "posible fraude / requiere revisión" en backend, frontend y agente. Validado en system prompts y copy del dashboard. |
| Sesgo en datos | Variables demográficas sensibles auditadas en el notebook de evaluación. Análisis de paridad por grupo. |
| Falsos positivos | Revisión humana obligatoria antes de cualquier decisión operativa. El score es input al analista, no output al cliente. |
| Datos sensibles | Sólo datos sintéticos. No se procesa PII real. |
| Modelo caja negra | SHAP por predicción + reglas trazables + explicación en lenguaje natural por GPT-4o. |
| Sobreajuste | Split estratificado, métricas reportadas en test set, monitoreo de drift en producción. |
| Mal uso legal | Documentación clara de que la salida es una alerta, no una conclusión legal. |
| Dependencia de APIs externas (Azure OpenAI / ML) | Endpoint Azure ML tiene fallback: si está caído, el sistema sigue funcionando con sólo reglas + agente degradado a respuestas plantilla. |

## 3. Qué NO hace este sistema (explícito)

- ❌ NO rechaza siniestros automáticamente.
- ❌ NO toma decisiones de pago.
- ❌ NO acusa de fraude a ningún asegurado.
- ❌ NO emite conclusiones legales.
- ❌ NO se conecta a sistemas core de la aseguradora en esta versión.
- ❌ NO procesa datos personales reales.
- ❌ NO sustituye al analista antifraude humano.

## 4. Próximos pasos para llevarlo a producción

| Fase | Acciones |
|------|----------|
| Validación | Pilotear con dataset real anonimizado, comparar score vs casos confirmados |
| Calibración | Reentrenar pesos de las 14 señales contra histórico real |
| Integración | Conexión al core (vía API) para puntuar siniestros en tiempo real al ingresar |
| Gobernanza | Política de uso aceptable, comité de revisión, auditoría trimestral |
| Monitoreo | Dashboard de Azure Monitor: latencia endpoint, drift de features, % falsos positivos |
| Feedback loop | Botón en el frontend para que el analista marque "fue fraude / no fue" → reentrenamiento |
| Cumplimiento | Revisión legal SBS Ecuador, política de retención de datos, derecho de explicación al asegurado |
