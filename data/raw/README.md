# `data/raw/` — Dataset original

## Archivo

`Car_Insurance_Fraud_Detection_Dataset.csv` — **15.420 filas, ~10 MB**, sintético, generado por el equipo.

## Esquema (denormalizado, 1 sola tabla)

Contiene en una sola fila todos los campos de:
- **Siniestro**: `id_siniestro`, `ramo`, `cobertura`, `fecha_ocurrencia`, `fecha_reporte`, `monto_*`, `estado`, `sucursal`, `ciudad_evento`, `descripcion`, `documentos_completos`, `tipo_beneficiario`, `dias_*`, `historial_siniestros_asegurado`, `tuvo_parte_policial`, `tuvo_testigo`, `fault_responsable`, `etiqueta_fraude_simulada`
- **Póliza**: `id_poliza`, `ramo_pol`, `fecha_inicio`, `fecha_fin`, `prima_usd`, `suma_asegurada_usd`, `deducible_usd`, `canal_venta`, `ciudad`, `estado_poliza`, `tipo_cobertura`
- **Asegurado**: `id_asegurado`, `segmento`, `antiguedad_anios`, `ciudad_ase`, `num_polizas`, `reclamos_ultimos_12_meses`, `mora_actual`, `score_cliente_simulado`
- **Vehículo**: `id_vehiculo`, `placa`, `chasis`, `motor`, `marca`, `modelo`, `anio_vehiculo`, `categoria`, `valor_comercial_usd`
- **Proveedor**: `id_proveedor`, `nombre`, `tipo`, `ciudad_prov`, `antiguedad_anios_prov`, `lista_restrictiva`, `reclamos_asociados`, `porcentaje_casos_observados`, `monto_promedio_reclamado_usd`

## Estadísticas validadas

| Métrica | Valor |
|---------|-------|
| Total filas | 15.420 |
| Etiqueta fraude = 1 | 923 (5,99%) |
| Etiqueta fraude = 0 | 14.497 (94,01%) |
| Ramos únicos | 1 (Vehículos) |
| Estados de siniestro | 7 (los 7 que pide el reto) |
| Encoding | ISO-8859 / Latin-1 |
| Separador | `;` |
| Fecha formato | `D/M/YYYY` |

## ⚠️ Issues identificados (corregir en `data/processed/`)

| # | Issue | Severidad | Fix |
|---|-------|-----------|-----|
| 1 | Encoding Latin-1 — caracteres especiales aparecen como `Veh�culos` | 🟡 Media | Reguardar UTF-8 en `scripts/clean_dataset.py` |
| 2 | Montos irreales: mediana $674K, máx $10,8M USD para vehículos | 🔴 Alta | Reescalar en `scripts/clean_dataset.py` — rangos Ecuador reales: prima $200–$2000, suma asegurada $8K–$60K, reclamo $500–$30K |
| 3 | Falta tabla `documentos` separada (la 6.2 del reto la exige) | 🔴 Alta | Generar sintéticamente en `scripts/normalize_tables.py` |
| 4 | Falta `id_conductor` para señal "Alta frecuencia conductor" (8 pts) | 🟡 Media | Generar conductores sintéticos en `scripts/normalize_tables.py` |
| 5 | Pocos casos extremos para reglas RF-01..04 (rojo automático) | 🟡 Media | Inyectar ~30-50 casos en `scripts/inject_critical_cases.py` |
| 6 | Todo denormalizado en 1 CSV | 🟢 Baja | Dividir en 6 tablas parquet en `data/processed/` |

## Cómo regenerar `data/processed/`

```bash
python scripts/clean_dataset.py
python scripts/normalize_tables.py
python scripts/inject_critical_cases.py
```
