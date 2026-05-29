"""Orquestador / router del agente: clasifica la intencion del mensaje
y elige la mejor estrategia de respuesta.

Por que existe:
  - "Hola" no necesita cargar las 10 tools en el prompt (es ~2-3s de schema).
  - "Gracias" no necesita ni siquiera ir a Azure OpenAI (latencia 0ms).
  - "Que es X" se beneficia de NO tener tools (responde mas rapido).
  - "Cuantos casos rojos hay" claramente necesita tools.

Rutas:
  canned       -> respuesta hardcoded local (0ms), saludos / cortesias / despedidas / meta
  explanation  -> LLM SIN tools (responde 2-4s), preguntas conceptuales
  data         -> LLM CON tools (5-10s con cache caliente), queries que requieren datos
  default      -> LLM CON tools, fallback seguro para ambiguos
"""
from __future__ import annotations

import random
import re
import time
from typing import Literal

Route = Literal["canned", "explanation", "data", "default"]


# ===================== Patrones canned (regex case-insensitive) =====================
_GREETING = re.compile(r"^\s*(hola+|holi+|buenas+|buen[oa]s?\s*(d[ií]as?|tardes?|noches?)|hey|hi|hello|saludos?|que onda|que tal)\W*$", re.I)
_THANKS = re.compile(r"^\s*(gracias\b|muchas\s+gracias|thx|thanks|thank you|mil\s+gracias|te\s+pasaste|genial+|excelente|perfecto+|joya|de\s+pana)\W*$", re.I)
_FAREWELL = re.compile(r"^\s*(chao|chau|adios|adi[oó]s|hasta\s+(luego|pronto|ma[nñ]ana)|nos\s+vemos|bye|good\s*bye)\W*$", re.I)
_ACK = re.compile(r"^\s*(ok|okay|vale|listo|dale|claro|si\s+gracias|entendido|bien)\W*$", re.I)
_META = re.compile(
    r"("
    # quien eres / que eres / que sos
    r"qui[eé]n\s+(eres|sos)|qu[eé]\s+(eres|sos)|"
    # que puedes hacer / podes hacer / sabes hacer / haces — con tolerancia a typos comunes
    r"qu[eé]\s+(puede[ns]?|peude[ns]?|podes|pueds|sabes|sabe[ns]|haces?|hace[ns])\s+(hacer|hacer\s+por\s+m[ií])?|"
    # ayuda / como funcionas / como me ayudas
    r"c[oó]mo\s+funcion[ao]s|c[oó]mo\s+(me\s+)?ayuda[ns]?|"
    # para qué sirves / cuáles son tus capacidades / dame tus capacidades
    r"para\s+qu[eé]\s+(sirves|eres|funciona[sn]?)|"
    r"(tus|sus)\s+capacidades|capacidades|"
    # presentate / preséntate / quién es achachai
    r"pres[eé]ntate|present[aá]te|que\s+es\s+achachai|qu[eé]\s+es\s+esto|qu[eé]\s+es\s+achachai|"
    # ayuda / help
    r"^\s*(ayuda|help|\?)\s*$"
    r")",
    re.I,
)

_CANNED_GREETING = [
    "Hola. ¿Qué querés revisar hoy? Puedo darte el top de casos críticos, explicarte un siniestro, o hacer una evaluación en vivo.",
    "Hola. Estoy listo. ¿Por dónde arrancamos: bandeja, un caso puntual, o un proveedor?",
    "Hola. ¿Empezamos por los rojos del día o tenés un caso específico?",
]
_CANNED_THANKS = [
    "De nada. ¿Algo más que quieras revisar?",
    "Cuando quieras. Si necesitás otro corte, decime.",
]
_CANNED_FAREWELL = [
    "Hasta luego. El cóndor sigue vigilando la cartera.",
    "Chau. Cuando vuelvas, te paso el resumen del día.",
]
_CANNED_ACK = [
    "Listo. ¿Querés que profundice en algo?",
    "Bien. Decime si querés avanzar con otra consulta.",
]
_CANNED_META = (
    "Soy **AchachAI**, el cóndor antifraude de Aseguradora del Sur. Sobrevuelo "
    "**39.960 siniestros multi-ramo** (Vehículos, Hogar, Salud) y **271 proveedores** "
    "(23 en lista restrictiva).\n\n"
    "### Esto es lo que puedo hacer por ti\n\n"
    "📋 **Priorizar tu día**\n"
    "• \"dame los 10 casos más críticos de hoy\"\n"
    "• \"qué casos rojos hay en Quito esta semana\"\n"
    "• \"casos de hospitalización sospechosos\"\n\n"
    "🔍 **Investigar un caso a fondo**\n"
    "• \"explicame SIN-H-04393\"\n"
    "• \"por qué este siniestro es alto riesgo\"\n"
    "• \"qué reglas se activaron en SIN-S-03039\"\n\n"
    "🕸️ **Detectar redes y patrones**\n"
    "• \"qué proveedores concentran más alertas\"\n"
    "• \"qué patrones se repiten en los rojos\"\n"
    "• \"asegurados con más reclamos\"\n\n"
    "📄 **Analizar documentos (multimodal)**\n"
    "• Subir factura, parte policial o foto del daño\n"
    "• Detecto falsificación documental que el OCR no ve "
    "(cambios de tipografía, texto sobrepuesto, firmas alteradas)\n\n"
    "📊 **Generar reportes**\n"
    "• \"resumen ejecutivo de los críticos de hoy\"\n"
    "• \"reporte para el comité antifraude\"\n"
    "• \"impacto económico estimado\"\n\n"
    "⚖️ **Reglas que aplico**: las 7 reglas críticas RF-01..07 del manual + "
    "14 señales ponderadas + XGBoost (AUC 0.974) + IsolationForest.\n\n"
    "Nunca acuso a un asegurado, solo alerto al analista con evidencia. "
    "**Decime por dónde empezamos.**"
)


# ===================== Keywords para clasificar data vs explanation =====================
# Si aparece cualquiera de estas palabras → casi seguro necesita TOOLS
_DATA_KEYWORDS = re.compile(
    r"\b("
    r"caso|casos|siniestro|siniestros|expediente|expedientes|"
    r"proveedor|proveedores|asegurado|asegurados|cliente|clientes|"
    r"score|nivel|rojo|amarillo|verde|critic[oa]|sospechos[oa]|fraude|"
    r"top|ranking|mas|mayor|menor|"
    r"hoy|esta\s+semana|este\s+mes|ultimos|ultima|recientes?|nuevos?|"
    r"ciudad|sucursal|cobertura|ramo|hogar|salud|vehiculo|vehiculos|"
    r"reporte|informe|csv|pdf|exportar|generar|"
    r"sin-|prv-|ase-|rf-|"
    r"monto|montos|usd|dolar|atipico|"
    r"historial|frecuencia|patron|patrones|"
    r"detalle|investigar|profundo|revisar|"
    r"hospitalizacion|incendio|robo|choque|"
    r"watchlist|alertas|tempranas|prevencion"
    r")\b",
    re.I,
)
# Palabras que típicamente indican "explicación conceptual" (no necesita datos)
_EXPLAIN_KEYWORDS = re.compile(
    r"\b("
    r"explicame|explica|expl[ií]came|c[oó]mo\s+funciona|que\s+es|qu[eé]\s+significa|"
    r"diferenc[ai]|por\s+qu[eé]|en\s+qu[eé]\s+consiste|defin[ie]"
    r")\b",
    re.I,
)


def classify_intent(user_message: str) -> Route:
    """Clasifica el mensaje en una de las 4 rutas. Reglas en orden de prioridad."""
    if not user_message or not user_message.strip():
        return "canned"
    txt = user_message.strip()

    # 1) Meta-preguntas ("que puedes hacer", "quien eres", etc.) → canned con presentacion
    if _META.search(txt):
        return "canned"
    # 2) Saludos / gracias / despedidas / acks → canned cortos
    if _GREETING.match(txt) or _THANKS.match(txt) or _FAREWELL.match(txt) or _ACK.match(txt):
        return "canned"

    # 3) Detecta señales de "explicación conceptual" sin ids ni keywords de datos
    has_explain = bool(_EXPLAIN_KEYWORDS.search(txt))
    has_data = bool(_DATA_KEYWORDS.search(txt))
    has_id = bool(re.search(r"\b(SIN-[SH]?-?\d+|PRV-[A-Z0-9-]+|RF-0?[1-7])\b", txt, re.I))

    if has_id or has_data:
        return "data"
    if has_explain:
        return "explanation"

    # 4) Mensajes ultracortos ambiguos -> los mandamos a explanation (LLM SIN tools, ~2s)
    # En lugar de canned generico, dejamos que el LLM responda contextualmente.
    if len(txt) <= 30:
        return "explanation"

    # 5) Por defecto: pasar por agente con tools (mas seguro que perderse algo)
    return "default"


def canned_response(user_message: str) -> str:
    """Genera una respuesta inmediata (0ms) para mensajes triviales.

    NOTA: este helper solo se llama cuando classify_intent retorno "canned".
    Si no matchea ningun patron, devuelve la presentacion completa como
    ultima opcion (el clasificador ya garantiza que sea un mensaje
    conversacional / meta / chitchat corto).
    """
    txt = user_message.strip()
    if _META.search(txt):
        return _CANNED_META
    if _GREETING.match(txt):
        return random.choice(_CANNED_GREETING)
    if _THANKS.match(txt):
        return random.choice(_CANNED_THANKS)
    if _FAREWELL.match(txt):
        return random.choice(_CANNED_FAREWELL)
    if _ACK.match(txt):
        return random.choice(_CANNED_ACK)
    # Si no matchea ningun patron especifico pero classify_intent decidio
    # que era canned (ej. mensaje ultracorto), mostramos la presentacion completa.
    return _CANNED_META
