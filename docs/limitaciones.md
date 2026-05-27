# Limitaciones, riesgos y mitigaciones

> Documento exigido por el reto (criterio de Explicabilidad y Ética, 25%).

## 1. Limitaciones conocidas del prototipo

### 1.1 Datos
- **Sintéticos**: el dataset fue generado por el equipo. No refleja la distribución real de siniestros de Aseguradora del Sur. Los patrones aprendidos por el modelo son los que existen en la generación sintética, no necesariamente los del mundo real.
- **Etiqueta de fraude simulada**: el campo `etiqueta_fraude_simulada` es una aproximación. En producción la etiqueta requeriría confirmación de un comité antifraude o de un proceso judicial.
- **Un solo ramo**: el prototipo cubre únicamente **Vehículos**. El reto permite otros ramos (salud, vida, hogar), pero el alcance se acotó por tiempo.
- **Sin imágenes**: no se analizan fotos de daños, documentos escaneados ni videos. Sólo metadatos y texto libre.

### 1.2 Modelo
- **Sobreajuste posible**: con sólo 15.420 filas y ~6% de positivos, el modelo puede memorizar patrones idiosincráticos del generador. Mitigación: split estratificado + cross-validation + monitoreo de la diferencia train/test.
- **Drift**: si las prácticas de fraude cambian, el modelo se degrada. Mitigación: pipeline de reentrenamiento mensual en Azure ML + monitoreo de feature drift.
- **Sesgos**: variables como `ciudad` o `segmento` pueden introducir sesgos demográficos. Mitigación: análisis de fairness por grupo + revisión de feature importance.

### 1.3 Reglas
- Los **pesos** de cada señal vienen del documento del reto y son referenciales. En producción deberían calibrarse contra histórico real.
- Algunas reglas (RF-04 "dinámica imposible") dependen de interpretación del LLM y son inherentemente subjetivas.

### 1.4 LLM / Agente
- **Alucinaciones**: GPT-4o puede inventar datos si no usa las tools. Mitigación: system prompt restrictivo + tools como única fuente de verdad + validación de IDs en respuestas.
- **Latencia**: cada consulta del agente toma 2-5 segundos. No es apto para volúmenes masivos sin batch.
- **Costo**: la consulta agentica cuesta ~$0.01-0.05 por interacción. En producción se debe habilitar prompt caching y rate limiting.
- **Idioma**: el agente fue afinado en español. Respuestas en otros idiomas pueden degradarse.

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
