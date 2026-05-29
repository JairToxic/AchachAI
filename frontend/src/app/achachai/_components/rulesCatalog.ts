/**
 * Catálogo de explicaciones humanas para las 7 reglas críticas (RF-01..07)
 * y las 14 señales ponderadas (S1..S14) del manual antifraude.
 *
 * El backend devuelve {codigo, nombre, evidencia} para cada regla/señal activada.
 * Este catálogo agrega contexto para que el analista entienda:
 *   - qué busca esa regla en la cartera (definición)
 *   - por qué importa cuando dispara (implicación)
 *   - qué hacer concretamente (acción)
 *
 * Fuentes:
 *   - src/rules/critical_rules.py (7 reglas)
 *   - src/rules/signals.py (14 señales)
 *   - PDF del reto (manual antifraude Aseguradora del Sur)
 */

export type RuleExplain = {
  descripcion: string;
  porQueImporta: string;
  queHacer: string[];
};

export const RULE_EXPLAIN: Record<string, RuleExplain> = {
  'RF-01': {
    descripcion:
      'Detecta siniestros de cobertura "Robo" liquidados como Pérdida Total donde el monto pagado se aproxima al 95%+ de la suma asegurada. El patrón "PTxRB" (Pérdida Total por Robo) es el vector clásico de fraude organizado: el bien nunca fue robado o se sobre-aseguró deliberadamente.',
    porQueImporta:
      'El manual fuerza ROJO automático porque históricamente este combo (Robo + Pago Total + monto ≈ suma asegurada) tiene una tasa de fraude varias veces superior a la media de la cartera.',
    queHacer: [
      'Verificar denuncia policial en la base del Ministerio del Interior.',
      'Confirmar que la unidad no aparece operando posteriormente al supuesto robo.',
      'Cruzar con base de vehículos recuperados.',
      'Si no se confirma robo real → escalar a Unidad Antifraude.',
    ],
  },
  'RF-02': {
    descripcion:
      'Detecta documentos de soporte (Factura o Denuncia) marcados por Azure Document Intelligence como alterados, ilegibles o con fecha de emisión anterior al evento. Una factura no puede ser emitida antes del siniestro que pretende reparar.',
    porQueImporta:
      'Si la prueba documental está adulterada, el reclamo pierde sustento probatorio. Manual antifraude: ROJO automático sin importar el score de las demás señales.',
    queHacer: [
      'Solicitar al asegurado la factura/denuncia original en físico.',
      'Verificar serie y secuencial de la factura en el portal del SRI.',
      'Cruzar la fecha de emisión contra el comprobante fiscal electrónico.',
      'Si se confirma adulteración → bloquear pago y escalar a Unidad Antifraude.',
    ],
  },
  'RF-03': {
    descripcion:
      'Detecta cuando el proveedor (taller, médico, perito) o el beneficiario aparece en la lista restrictiva interna de Aseguradora del Sur: actores con historial de fraude confirmado, sanciones regulatorias o vínculos investigados.',
    porQueImporta:
      'Cada caso vinculado a un actor restrictivo merece revisión específica. No implica que este caso sea fraude, pero el riesgo de colusión es materialmente más alto.',
    queHacer: [
      'Validar el motivo por el cual el proveedor está en la lista (Compliance).',
      'Revisar si el asegurado ha trabajado antes con este proveedor.',
      'Pedir cotización paralela con un proveedor de la red preferente.',
      'No autorizar pago sin visto bueno de Compliance.',
    ],
  },
  'RF-04': {
    descripcion:
      'Detecta cuando la narrativa del siniestro describe una dinámica físicamente imposible: vehículo dañado estando "estacionado dentro de garaje cerrado", impacto a "5 km/h con destrucción total", "freno de mano puesto" con vehículo en movimiento, etc.',
    porQueImporta:
      'Si los hechos contados son incompatibles con la física del daño reclamado, el relato es falso o gravemente impreciso. ROJO automático: el caso requiere reconstrucción técnica.',
    queHacer: [
      'Pedir reconstrucción de hechos a un perito independiente.',
      'Cruzar las fotografías del daño con la mecánica descrita.',
      'Entrevistar al conductor con preguntas específicas sobre el momento del impacto.',
      'Si la inconsistencia se confirma → escalar a Unidad Antifraude.',
    ],
  },
  'RF-05': {
    descripcion:
      'Detecta siniestros que ocurren en las primeras 48 horas tras emitir la póliza (anti-selección: contratar póliza con el daño ya producido) o en las 48 horas finales (apurar reclamo antes de cancelación).',
    porQueImporta:
      'Anti-selección es uno de los esquemas más frecuentes. AMARILLO automático: no fuerza ROJO pero exige verificar la línea de tiempo con cuidado.',
    queHacer: [
      'Pedir fotografías con metadatos EXIF (timestamp original).',
      'Cruzar fecha real del daño con el reporte de cámaras o vecinos.',
      'Verificar que la inspección pre-póliza no haya documentado el daño.',
      'Si hay duda sobre la cronología → retener pago hasta validar.',
    ],
  },
  'RF-06': {
    descripcion:
      'Detecta robos donde el asegurado tardó más de 4 días en denunciar. Lo razonable son horas, no días. La demora suele indicar que el evento es inventado o que se intentó resolverlo por fuera primero.',
    porQueImporta:
      'AMARILLO automático. No es prueba de fraude pero la demora atípica es un patrón estadístico fuerte en reclamos no genuinos de robo.',
    queHacer: [
      'Pedir explicación documentada de la demora.',
      'Verificar denuncia policial: fecha, número de parte, oficial responsable.',
      'Cruzar movimientos del asegurado vía redes sociales o reportes adicionales.',
      'Si la justificación es débil → escalar para verificación de campo.',
    ],
  },
  'RF-07': {
    descripcion:
      'Detecta narrativas casi idénticas (similitud > 0.99) a otro reclamo histórico. Usamos embeddings text-embedding-3-large sobre las 40.000 descripciones de la cartera. Cuando dos relatos se parecen tanto, suelen venir del mismo "molde" copiado.',
    porQueImporta:
      'AMARILLO automático. Sugiere posible esquema replicado (mismo asegurador, mismo gestor, misma plantilla) o intento de defraudación serial.',
    queHacer: [
      'Revisar el caso similar (link disponible en sección §06).',
      'Comparar partes involucradas: ¿mismo conductor, mismo taller, misma ciudad?',
      'Revisar si los reclamos comparten patrones temporales sospechosos.',
      'Si los casos están vinculados → consolidar investigación en Antifraude.',
    ],
  },
};

export const SIGNAL_EXPLAIN: Record<number, RuleExplain> = {
  1: {
    descripcion:
      'Reclamo ocurre cerca del inicio o fin de vigencia de la póliza. ≤10 días suma 8 pts; 11-30 días suma 4 pts.',
    porQueImporta:
      'Estadísticamente, los siniestros muy cercanos al borde de vigencia tienen mayor tasa de anti-selección (póliza contratada con el daño ya existente o apurada antes de cancelación).',
    queHacer: [
      'Verificar inspección pre-póliza si existe.',
      'Confirmar fecha real del daño con evidencia independiente (fotos, testigos).',
    ],
  },
  2: {
    descripcion:
      'Aplica solo a cobertura Robo. Tiempo entre ocurrencia y denuncia: >48h suma 8 pts; 24-48h suma 4 pts.',
    porQueImporta:
      'Un robo real se denuncia en horas. Demoras prolongadas sugieren evento inventado o intento de solucionarlo por fuera del seguro primero.',
    queHacer: [
      'Pedir explicación documentada de la demora.',
      'Verificar parte policial y horario de presentación.',
    ],
  },
  3: {
    descripcion:
      'Número de siniestros del mismo asegurado en los últimos 18 meses. ≥3 suma 8 pts; 2 suma 4 pts.',
    porQueImporta:
      'Reclamos repetidos del mismo asegurado en ventana corta son un predictor fuerte de fraude estructural o de "cliente problema".',
    queHacer: [
      'Revisar histórico completo del asegurado en la sección §03.',
      'Cruzar con su historial en otras aseguradoras vía ESIGEF/SBS si aplica.',
    ],
  },
  4: {
    descripcion:
      'Número de siniestros del mismo vehículo en 18 meses. ≥3 suma 6 pts; 2 suma 3 pts.',
    porQueImporta:
      'Un mismo vehículo con múltiples siniestros recientes puede indicar reciclaje de daños (mismo daño reclamado varias veces) o operación comercial irregular.',
    queHacer: [
      'Comparar fotos de daño entre los siniestros previos.',
      'Verificar que las reparaciones previas hayan sido ejecutadas (peritaje post-pago).',
    ],
  },
  5: {
    descripcion:
      'Número de siniestros del mismo conductor en 18 meses. ≥3 suma 8 pts; 2 suma 4 pts.',
    porQueImporta:
      'Conductor con alta frecuencia sugiere conductor profesional no declarado, riesgo elevado real, o uso fraudulento de la cobertura.',
    queHacer: [
      'Validar relación conductor-asegurado (familia, empleado, tercero).',
      'Revisar si el conductor aparece en siniestros de otros vehículos.',
    ],
  },
  6: {
    descripcion:
      'Aplica solo a cobertura Responsabilidad Civil. Eventos previos solo-RC del asegurado: >2 suma 6 pts; 1-2 suma 3 pts.',
    porQueImporta:
      'Patrón "siempre RC" sugiere uso recurrente de RC contra terceros cómplices (acuerdo fraudulento entre partes).',
    queHacer: [
      'Revisar si los terceros de los reclamos previos están vinculados al asegurado.',
      'Cruzar dirección de los terceros con la del asegurado.',
    ],
  },
  7: {
    descripcion:
      'Proveedor en lista restrictiva (10 pts) o proveedor con casos en el percentil 90 del año (5 pts).',
    porQueImporta:
      'Proveedores que concentran muchos casos pueden estar genuinamente bien posicionados o ser parte de un esquema colusorio (sobre-facturación, daños inflados).',
    queHacer: [
      'Pedir cotización paralela con proveedor de red preferente.',
      'Revisar el margen del proveedor vs benchmark de mercado.',
    ],
  },
  8: {
    descripcion:
      'Falta al menos uno de los documentos obligatorios (Denuncia o Factura). Suma 4 pts.',
    porQueImporta:
      'Documentación incompleta puede ser pereza administrativa o evitación deliberada de presentar evidencia que contradiga el reclamo.',
    queHacer: [
      'Solicitar formalmente los documentos faltantes con plazo definido.',
      'Si no se entregan en el plazo → retener pago.',
    ],
  },
  9: {
    descripcion:
      'Descripción del siniestro contiene patrones imposibles ("garaje cerrado", "freno de mano", "5 km/h", "sin marcas") o accidente múltiple en madrugada.',
    porQueImporta:
      'Las palabras clave detectadas son patrones recurrentes en relatos fabricados. En producción esto lo refina GPT-4o con análisis semántico completo.',
    queHacer: [
      'Leer la descripción completa y validar coherencia con las fotos.',
      'Pedir reconstrucción de hechos al perito.',
    ],
  },
  10: {
    descripcion:
      'Daño severo (>30% suma asegurada) cuando el asegurado declara culpa de tercero pero NO hay parte policial. Suma 5 pts.',
    porQueImporta:
      'Daños graves contra terceros deberían tener parte policial sí o sí. Su ausencia sugiere que el "tercero" no existe o que es un acuerdo entre partes.',
    queHacer: [
      'Pedir el parte policial o explicación creíble de por qué no existe.',
      'Verificar datos del tercero: nombre, cédula, vehículo, contacto.',
    ],
  },
  11: {
    descripcion:
      'Algún documento del expediente fue marcado como inconsistente por Azure Document Intelligence (texto editado, fechas incoherentes, sellos sospechosos) o factura con fecha previa al evento. Suma 10 pts.',
    porQueImporta:
      'La señal más pesada del catálogo (10 pts). Una sola inconsistencia documental confirmada por IA suele bastar para forzar el caso a revisión profunda.',
    queHacer: [
      'Revisar el detalle visual del documento marcado en sección §05.',
      'Solicitar el original físico para peritaje documentológico.',
    ],
  },
  12: {
    descripcion:
      'Días entre ocurrencia y reporte (excluyendo Robo, que tiene su propia señal). >7 días suma 5 pts; 4-7 días suma 3 pts.',
    porQueImporta:
      'Reportar tarde suele indicar que el daño se descubrió/inventó después, o que se intentó arreglar primero por fuera del seguro.',
    queHacer: [
      'Validar la cronología con evidencia independiente.',
      'Revisar la consistencia del relato con la fecha declarada.',
    ],
  },
  13: {
    descripcion:
      'Este siniestro está en el TOP-K de pares más similares globalmente (embeddings text-embedding-3-large). Suma 8 pts.',
    porQueImporta:
      'Narrativas casi clonadas sugieren plantillas usadas en esquemas serial o copy-paste entre reclamos. Diferente de RF-07 que requiere sim > 0.99.',
    queHacer: [
      'Revisar el caso pareado en sección §06.',
      'Comparar otros datos: misma ciudad, mismo proveedor, mismo conductor.',
    ],
  },
  14: {
    descripcion:
      'Monto reclamado >95% de la suma asegurada O monto reclamado >150% del promedio del proveedor. Suma 4 pts.',
    porQueImporta:
      'Reclamos que agotan la suma asegurada o que están muy por encima del benchmark del proveedor son típicos de sobre-facturación o reclamación oportunista.',
    queHacer: [
      'Pedir desglose detallado de partidas en la factura.',
      'Comparar contra cotización paralela de proveedor preferente.',
    ],
  },
};

export function getRuleExplain(codigo: string | undefined): RuleExplain | null {
  if (!codigo) return null;
  return RULE_EXPLAIN[codigo] ?? null;
}

export function getSignalExplain(id: number | undefined): RuleExplain | null {
  if (id === undefined || id === null) return null;
  return SIGNAL_EXPLAIN[id] ?? null;
}
