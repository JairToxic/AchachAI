"""Catalogo de inconsistencias documentales: descripcion humana + por_que_importa + regla RF.

Centraliza las descripciones para que TODO el sistema (analyze_factura,
analyze_parte_policial, analyze_declaracion_accidente, etc.) muestre el mismo
texto pedagogico cuando se detecta un tipo de inconsistencia.

Si un analyzer pone `tipo: "factura_anterior_al_evento"` pero no llena
`descripcion`, `por_que_importa` o `regla_aplicable`, esos campos se
auto-completan desde este catalogo.
"""
from __future__ import annotations

from typing import Any


# ===================== CATALOGO =====================
# Cada entrada tiene:
#   descripcion      → frase corta para mostrar como titulo de la inconsistencia
#   por_que_importa  → explicacion al analista de por que es señal de posible fraude
#   regla_aplicable  → RF-XX (PDF seccion 8) que se mapea, o None si no aplica
#
# Categorias:
#   FACTURA, FECHA/IDENTIDAD, PARTE POLICIAL, DECLARACION, FALLBACKS

CATALOGO: dict[str, dict[str, str | None]] = {
    # ----------------- Factura -----------------
    "factura_anterior_al_evento": {
        "descripcion": "La factura fue emitida ANTES de la fecha del siniestro",
        "por_que_importa": "Una reparación no puede facturarse antes de que ocurra el accidente. Es uno de los indicadores más claros de falsificación documental para inflar el reclamo.",
        "regla_aplicable": "RF-02",
    },
    "total_no_coincide": {
        "descripcion": "El total facturado no cuadra con la suma de subtotal + impuestos",
        "por_que_importa": "Una factura emitida por un sistema contable real no puede tener errores aritméticos. Sugiere alteración manual del documento.",
        "regla_aplicable": "RF-02",
    },
    "falta_ruc": {
        "descripcion": "La factura no incluye el RUC del proveedor",
        "por_que_importa": "En Ecuador, toda factura legal lleva el RUC. Su ausencia sugiere que el documento no fue emitido por un contribuyente registrado en el SRI.",
        "regla_aplicable": "RF-02",
    },
    "falta_numero": {
        "descripcion": "Factura sin número de identificación",
        "por_que_importa": "Sin número de factura el documento no es rastreable en el SRI, no puede validarse su autenticidad ni cruzarse con otros emitidos por el mismo proveedor.",
        "regla_aplicable": "RF-02",
    },

    # ----------------- Fecha / identidad -----------------
    "fecha_no_coincide": {
        "descripcion": "La fecha del documento no coincide con la fecha del siniestro registrada",
        "por_que_importa": "Una discrepancia temporal entre la evidencia y el evento sugiere que el documento corresponde a otro hecho o fue fabricado posteriormente.",
        "regla_aplicable": "RF-02",
    },
    "placa_no_coincide": {
        "descripcion": "La placa del documento es distinta de la registrada para el siniestro",
        "por_que_importa": "El vehículo descrito en el parte policial o la declaración no es el asegurado. Posible suplantación del bien siniestrado.",
        "regla_aplicable": "RF-02",
    },
    "nombre_no_coincide": {
        "descripcion": "El nombre que firma el documento no es el del titular de la póliza",
        "por_que_importa": "Un tercero no autorizado declarando por el asegurado. Verificar autorización formal antes de continuar.",
        "regla_aplicable": "RF-02",
    },
    "numero_parte_no_coincide": {
        "descripcion": "El número de parte policial reportado al sistema no coincide con el del documento",
        "por_que_importa": "Sugiere parte policial fabricado, duplicado o usado en más de un siniestro.",
        "regla_aplicable": "RF-02",
    },
    "lugar_inconsistente": {
        "descripcion": "El lugar del evento declarado no coincide con el registrado",
        "por_que_importa": "Inconsistencia geográfica entre lo declarado y lo registrado. Puede indicar relato fabricado.",
        "regla_aplicable": None,
    },

    # ----------------- Parte policial / Declaracion -----------------
    "documento_no_oficial": {
        "descripcion": "El documento carece de sellos, firmas o formato institucional esperado",
        "por_que_importa": "Un parte o declaración auténtico tiene marcas institucionales. Su ausencia sugiere fabricación fuera del canal oficial.",
        "regla_aplicable": "RF-02",
    },
    "documento_sintetico_ficticio": {
        "descripcion": "El documento presenta marcas características de haber sido generado artificialmente",
        "por_que_importa": "El modelo detectó patrones gráficos o textuales propios de documentos producidos digitalmente (no escaneados de original).",
        "regla_aplicable": "RF-02",
    },
    "relato_formulaico_lenguaje_no_espontaneo": {
        "descripcion": "El lenguaje de la declaración es ensayado, no parece testimonio espontáneo",
        "por_que_importa": "Las declaraciones genuinas suelen tener errores, dudas y orden caótico. Un relato perfecto y ordenado puede indicar copia o pre-redacción.",
        "regla_aplicable": "RF-07",
    },
    "relato_contradice_descripcion": {
        "descripcion": "La narración del asegurado contradice los datos registrados del siniestro",
        "por_que_importa": "El asegurado describe el evento de manera distinta a como fue notificado. Posible cambio de versión.",
        "regla_aplicable": None,
    },
    "intervencion_policial_contradiccion": {
        "descripcion": "Hay contradicción sobre si la policía intervino o no en el evento",
        "por_que_importa": "Si el siniestro indica que hubo parte policial pero la declaración no lo menciona (o viceversa), uno de los dos puede ser falso.",
        "regla_aplicable": None,
    },
    "faltan_datos_testigos_o_contrario": {
        "descripcion": "La declaración omite datos básicos como testigos o tercero involucrado",
        "por_que_importa": "Declaraciones incompletas suelen ocultar información relevante. Pedir ampliación al asegurado.",
        "regla_aplicable": None,
    },

    # ----------------- Forensia visual (GPT-4o Vision) -----------------
    "multiples_tipografias": {
        "descripcion": "El documento usa más de una tipografía en la misma sección",
        "por_que_importa": "Un documento auténtico generado por un sistema único usa una sola fuente por sección. Mezclas de tipografías sugieren texto editado o añadido posteriormente al original.",
        "regla_aplicable": "RF-02",
    },
    "texto_sobrepuesto_o_editado": {
        "descripcion": "Hay texto que parece sobrepuesto, pegado o editado sobre el original",
        "por_que_importa": "Marcas visuales de edición (texto desalineado, espacios irregulares alrededor de campos clave) son señal típica de PDF manipulado.",
        "regla_aplicable": "RF-02",
    },
    "alineacion_irregular": {
        "descripcion": "La alineación de columnas, márgenes o líneas presenta irregularidades",
        "por_que_importa": "Documentos institucionales tienen layout consistente. Quiebres de alineación sugieren campos editados a mano o copy-paste de otro PDF.",
        "regla_aplicable": "RF-02",
    },
    "firma_alterada_o_sospechosa": {
        "descripcion": "La firma o rúbrica muestra signos de alteración o no parece manuscrita auténtica",
        "por_que_importa": "Firma copiada digitalmente o reutilizada en distintos documentos. Verificar contra firma de referencia del titular.",
        "regla_aplicable": "RF-02",
    },
    "marca_agua_sospechosa": {
        "descripcion": "La marca de agua, sello o logo presenta inconsistencias",
        "por_que_importa": "Sellos institucionales reales son consistentes. Marcas alteradas, borrosas o mal posicionadas son indicio de falsificación.",
        "regla_aplicable": "RF-02",
    },
    "calidad_escaneo_inconsistente": {
        "descripcion": "Diferentes secciones del documento tienen calidades de escaneo distintas",
        "por_que_importa": "Si una zona aparece nítida y otra borrosa, puede ser que se haya pegado/escaneado un fragmento de otro documento.",
        "regla_aplicable": "RF-02",
    },
    "colores_fondo_inconsistentes": {
        "descripcion": "El fondo o color del papel cambia entre secciones del documento",
        "por_que_importa": "Un documento auténtico tiene papel uniforme. Cambios de tono o color sugieren collage de varios documentos o edición digital.",
        "regla_aplicable": "RF-02",
    },
    "campos_clave_destacados_visualmente": {
        "descripcion": "Los datos críticos (monto, fecha, nombre) lucen visualmente distintos del resto",
        "por_que_importa": "Si los campos que determinan el reclamo (montos, fechas) tienen apariencia diferente al cuerpo del documento, probablemente fueron editados.",
        "regla_aplicable": "RF-02",
    },

    # ----------------- Fallbacks tecnicos -----------------
    "vacio": {
        "descripcion": "Document Intelligence no logró extraer ningún campo del documento",
        "por_que_importa": "El documento puede ser ilegible, estar dañado, o tener formato no reconocido. Solicitar versión original o mejor calidad.",
        "regla_aplicable": None,
    },
    "ilegible": {
        "descripcion": "El documento está ilegible o tiene calidad insuficiente para análisis",
        "por_que_importa": "Sin OCR claro no se puede verificar autenticidad. Pedir copia certificada o de mejor resolución.",
        "regla_aplicable": None,
    },
    "filtro_contenido": {
        "descripcion": "Azure OpenAI bloqueó el análisis por política de contenido",
        "por_que_importa": "Limitación técnica, no es señal de fraude. Reintentar con un reporte más breve o sin lenguaje sensible.",
        "regla_aplicable": None,
    },
    "respuesta_vacia": {
        "descripcion": "El modelo de visión no devolvió respuesta",
        "por_que_importa": "Limitación técnica del análisis. Reintentar más tarde.",
        "regla_aplicable": None,
    },
    "json_invalido": {
        "descripcion": "El modelo devolvió un formato inválido",
        "por_que_importa": "Limitación técnica. Se reprocesa automáticamente.",
        "regla_aplicable": None,
    },
    "error_modelo": {
        "descripcion": "Error técnico al analizar el documento",
        "por_que_importa": "Reintentar la carga del documento.",
        "regla_aplicable": None,
    },
}


# ===================== Severidad: nivel y color sugeridos =====================
SEVERIDAD_META: dict[str, dict[str, str]] = {
    "CRITICA": {"nivel": "ROJO", "color": "#c5333a", "icono": "🚨",
                "label_corto": "Crítica"},
    "ALTA":    {"nivel": "ROJO", "color": "#d97706", "icono": "🔴",
                "label_corto": "Alta"},
    "MEDIA":   {"nivel": "AMARILLO", "color": "#eab308", "icono": "🟡",
                "label_corto": "Media"},
    "BAJA":    {"nivel": "VERDE", "color": "#65a30d", "icono": "🟢",
                "label_corto": "Baja"},
}


# ===================== API publica =====================
def enrich_inconsistencia(inc: dict) -> dict:
    """Toma una inconsistencia cruda y le agrega los campos pedagogicos.

    Si la inconsistencia ya trae `descripcion`, `por_que_importa` o
    `regla_aplicable`, se respetan. Solo se llenan los faltantes.

    Tambien normaliza la severidad y agrega meta (color, icono).
    """
    if not isinstance(inc, dict):
        return inc

    tipo = str(inc.get("tipo") or "").strip()
    catalogo_entry = CATALOGO.get(tipo, {})

    # Descripcion humana
    if not inc.get("descripcion"):
        inc["descripcion"] = (
            catalogo_entry.get("descripcion")
            or inc.get("evidencia")  # fallback al texto crudo
            or _titulo_desde_tipo(tipo)
        )

    # Por que importa
    if not inc.get("por_que_importa") and catalogo_entry.get("por_que_importa"):
        inc["por_que_importa"] = catalogo_entry["por_que_importa"]

    # Regla aplicable
    if not inc.get("regla_aplicable") and catalogo_entry.get("regla_aplicable"):
        inc["regla_aplicable"] = catalogo_entry["regla_aplicable"]

    # Si no hay evidencia, copiar la descripcion como fallback
    if not inc.get("evidencia"):
        inc["evidencia"] = inc["descripcion"]

    # Severidad meta
    sev = str(inc.get("severidad", "MEDIA")).upper()
    if sev not in SEVERIDAD_META:
        sev = "MEDIA"
    inc["severidad"] = sev
    meta = SEVERIDAD_META[sev]
    inc["severidad_label"] = meta["label_corto"]
    inc["severidad_color"] = meta["color"]
    inc["severidad_icono"] = meta["icono"]
    inc["nivel_riesgo"] = meta["nivel"]

    return inc


def enrich_inconsistencias(incs: list[dict]) -> list[dict]:
    """Enriquece TODA la lista de inconsistencias en-place y la devuelve."""
    return [enrich_inconsistencia(i) for i in (incs or [])]


def _titulo_desde_tipo(tipo: str) -> str:
    """Convierte 'factura_anterior_al_evento' -> 'Factura anterior al evento'."""
    if not tipo:
        return "Inconsistencia detectada"
    palabras = tipo.replace("_", " ").strip()
    return palabras[:1].upper() + palabras[1:]
