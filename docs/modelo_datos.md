# Modelo de datos

> Modelo relacional final que vive en `data/processed/*.parquet`, derivado del CSV crudo.

## Diagrama lógico

```
                              ┌──────────────┐
                              │   POLIZAS    │
                              │ id_poliza PK │
                              └──────┬───────┘
                                     │ 1
                                     │
                                     │ N
┌─────────────┐       ┌──────────────▼──────────────┐       ┌──────────────┐
│ ASEGURADOS  │1     N│         SINIESTROS          │N     1│  VEHICULOS   │
│ id_asegurado├───────│ id_siniestro PK             │───────│ id_vehiculo  │
│ PK          │       │ id_poliza FK                │       │ PK           │
└─────────────┘       │ id_asegurado FK             │       └──────────────┘
                      │ id_vehiculo FK              │
                      │ id_proveedor FK             │
                      │ id_conductor FK             │              ┌──────────────┐
                      └──┬────────┬────────┬────────┘1            N│ DOCUMENTOS   │
                         │N      N│       N│───────────────────────│ id_documento │
                         │        │        │                       │ id_siniestro │
                         │1       │1       │                       └──────────────┘
                  ┌──────▼───┐ ┌──▼──────┐ │
                  │PROVEEDORES│ │CONDUCT. │ │
                  │id_provee. │ │id_cond. │ │
                  │PK         │ │PK       │ │
                  └───────────┘ └─────────┘
```

## Tablas

### `siniestros` (tabla principal)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_siniestro | str (PK) | Identificador único |
| id_poliza | str (FK) | → polizas |
| id_asegurado | str (FK) | → asegurados |
| id_vehiculo | str (FK) | → vehiculos |
| id_proveedor | str (FK) | → proveedores (beneficiario principal) |
| id_conductor | str (FK) | → conductores |
| ramo | str | Vehículos |
| cobertura | str | Choque / RC / Robo / ... |
| fecha_ocurrencia | date | |
| fecha_reporte | date | |
| monto_reclamado_usd | float | |
| monto_estimado_usd | float | |
| monto_pagado_usd | float | |
| estado | str | Reserva / Pago Total / ... (7 valores) |
| sucursal | str | |
| ciudad_evento | str | |
| descripcion | str | Texto libre del reclamo |
| documentos_completos | bool | (resumen — el detalle vive en `documentos`) |
| tipo_beneficiario | str | Taller / Clínica / Perito |
| dias_desde_inicio_poliza | int | |
| dias_desde_fin_poliza | int | |
| dias_entre_ocurrencia_reporte | int | |
| historial_siniestros_asegurado | int | |
| tuvo_parte_policial | bool | |
| tuvo_testigo | bool | |
| fault_responsable | str | Asegurado / Tercero / Compartido |
| etiqueta_fraude_simulada | int (0/1) | **Sólo entrenamiento — no usar en producción** |

### `polizas`
| Campo | Tipo |
|-------|------|
| id_poliza (PK) | str |
| id_asegurado (FK) | str |
| ramo | str |
| fecha_inicio | date |
| fecha_fin | date |
| prima_usd | float |
| suma_asegurada_usd | float |
| deducible_usd | float |
| canal_venta | str |
| ciudad | str |
| estado_poliza | str |
| tipo_cobertura | str |

### `asegurados`
| Campo | Tipo |
|-------|------|
| id_asegurado (PK) | str |
| segmento | str |
| antiguedad_anios | int |
| ciudad | str |
| num_polizas | int |
| reclamos_ultimos_12_meses | int |
| mora_actual | bool |
| score_cliente_simulado | int |

### `vehiculos`
| Campo | Tipo |
|-------|------|
| id_vehiculo (PK) | str |
| placa | str |
| chasis | str |
| motor | str |
| marca | str |
| modelo | str |
| anio_vehiculo | int |
| categoria | str |
| valor_comercial_usd | float |

### `proveedores`
| Campo | Tipo |
|-------|------|
| id_proveedor (PK) | str |
| nombre | str |
| tipo | str (Taller / Clínica / Perito) |
| ciudad | str |
| antiguedad_anios | int |
| lista_restrictiva | bool |
| reclamos_asociados | int |
| porcentaje_casos_observados | float |
| monto_promedio_reclamado_usd | float |

### `conductores` ⚠️ nueva tabla a generar
| Campo | Tipo |
|-------|------|
| id_conductor (PK) | str |
| nombre_seudonimo | str |
| edad | int |
| anios_licencia | int |
| infracciones_previas | int |
| siniestros_18m | int |

### `documentos` ⚠️ nueva tabla a generar
| Campo | Tipo |
|-------|------|
| id_documento (PK) | str |
| id_siniestro (FK) | str |
| tipo_documento | str (Factura / Denuncia / Informe perito / Foto / Parte policial) |
| entregado | bool |
| legible | bool |
| fecha_emision | date |
| inconsistencia_detectada | bool |
| observacion | str |

## Convenciones

- IDs siguen patrón `<PREFIJO>-<NUMERO>`: `SIN-`, `POL-`, `ASE-`, `VEH-`, `PRV-`, `CON-`, `DOC-`.
- Todas las fechas en ISO 8601 (`YYYY-MM-DD`).
- Todos los montos en USD, columna sufijada `_usd`.
- Booleanos como `bool` real, no como `Sí/No`.
- Texto siempre UTF-8.
