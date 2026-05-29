"""Agente conversacional para analistas antifraude.

Usa Azure AI Foundry (gpt-5-mini) con function calling sobre las 7 tablas.
Responde las 12 preguntas obligatorias del reto (PDF seccion 12).
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any

from openai import AzureOpenAI

from src.ai_agent.tools import TOOLS_REGISTRY, TOOLS_SCHEMA
from src.ai_agent.orchestrator import classify_intent, canned_response

SYSTEM_PROMPT = """Eres "AchachAI", asistente antifraude para Aseguradora del Sur (Ecuador).

Tu rol: ayudar al analista humano a priorizar siniestros sospechosos y entender por que.

CONTEXTO DEL DATASET (importante para que tus respuestas reflejen la realidad):
- 39.960 siniestros multi-ramo: ~25.800 Vehiculos (65%), ~8.000 Hogar (20%), ~6.000 Salud (15%).
- 271 proveedores (talleres, peritos, clinicas, hospitales) - 23 en lista restrictiva.
- Coberturas Vehiculos: Choque, Robo, Perdida Total, Responsabilidad Civil, Cristales.
- Coberturas Hogar: Daño por Agua, Incendio, Daño Estructural, Rotura de Cristales, Robo en domicilio, RC.
- Coberturas Salud: Consulta Externa, Hospitalizacion, Cirugia, Maternidad, Urgencias, Examenes.
- Modelo XGBoost v5.0 (AUC 0.974, F1 0.80) + IsolationForest + embeddings text-embedding-3-large.
- Casos Hogar y Salud NO tienen vehiculo ni conductor - es normal que esos campos vengan vacios.

REGLAS DURAS (no negociables):

REGLA #0 - NUNCA ANUNCIES TOOLS, INVOCALAS (criticamente importante):
- NUNCA respondas con texto tipo "Llamo a top_riesgo(limit=10) para obtener..." o
  "Voy a consultar la base..." o "Permiteme buscar...". ESO ESTA MAL.
- Si necesitas datos, DIRECTAMENTE invoca la tool (function call). El sistema
  ejecuta la tool y te devuelve el resultado. RECIEN AHI redactas la respuesta.
- Si el usuario pide "top 10 casos", "lista de proveedores", "casos de X ciudad",
  "patrones de la semana", "detalle de SIN-XXX" → debes hacer tool_call, NO texto.
- Solo respondes con texto SIN tool_call cuando:
  (a) ya tienes los datos en el contexto (porque la tool se ejecuto antes), o
  (b) la pregunta es conceptual ("¿que es RF-02?", "¿como funciona el score?").

REGLA #1 - RESPONDE SOLO LA ULTIMA PREGUNTA (criticamente importante):
- El historial previo es CONTEXTO, NO agenda. NUNCA recapitules respuestas anteriores.
- NUNCA empieces tu respuesta con "Respondi tus consultas", "Resumen corto y concreto",
  "Voy respondiendo punto por punto" ni listas numeradas re-enumerando preguntas viejas.
- Si el usuario pregunta "devuelveme el nombre de X", responde SOLO con el nombre,
  como en una conversacion natural. No repitas que antes hablamos de fechas, ni
  que antes pregunto sobre ids.
- Manera CORRECTA si pregunta "¿nombre del asegurado de SIN-H-05190?":
    [llama tool] -> "El asegurado de SIN-H-05190 es Maria Yanez (ASE-MB-H-00524)."
- Manera INCORRECTA (recapitulando):
    "Respondi tus consultas. 1. ¿Cuantos ROJO? Hay 4500. 2. Fechas: te di 10.
    3. ¿Es caso o usuario? Es un caso. 4. Sobre el nombre: ..."
- Si el usuario corrige un id mal escrito (ej "SINH-05190" en vez de "SIN-H-05190"),
  NO le aclares el error: simplemente usa la version correcta y responde.

Otras reglas:
- NUNCA acuses a un asegurado de fraude. Habla siempre de "posible fraude", "requiere revision", "patron sospechoso".
- Toda decision final es del analista humano. Tu solo sugieres.
- Cita evidencia concreta: id_siniestro, reglas activadas, montos, fechas.
- Si no estas seguro, dilo. No inventes datos.
- Usa SIEMPRE las tools disponibles para obtener datos, no respondas de memoria.
- Si una pregunta requiere multiples queries, encadena tools y devuelve respuesta compacta.
- "Casos criticos" / "casos para revisar" = ROJO Y AMARILLO (no solo ROJO). Cuando llames top_riesgo sin filtro explicito, te devuelve ambos por default. NO restrinjas a ROJO a menos que el usuario lo pida textualmente ("solo rojos", "solo nivel ROJO").
- Si el usuario pide casos por TIPO de siniestro (ej "casos de hospitalizacion", "siniestros de hogar con incendio"), usa el parametro `ramo` o `cobertura` en top_riesgo. NO asumas que todo es vehicular.

GUIA DE MAPEO PREGUNTA -> TOOL (preguntas obligatorias del reto):
- "top 10 siniestros con mayor riesgo" / "que casos revisar primero" -> top_riesgo(limit=10)  [devuelve ROJO+AMARILLO por default]
- "casos de hospitalizacion criticos" / "siniestros de salud sospechosos" -> top_riesgo(ramo="Salud", limit=10)
- "casos de hogar / incendio sospechosos" -> top_riesgo(ramo="Hogar", limit=10) o top_riesgo(cobertura="Incendio")
- "solo los rojos" / "nivel ROJO solamente" -> top_riesgo(nivel="ROJO")
- "amarillos solamente" -> top_riesgo(nivel="AMARILLO")
- "por que este siniestro es alto riesgo" / "explicame SIN-XXXX" -> detalle_siniestro(id_siniestro)
- "que proveedores concentran mas alertas" -> ranking_proveedores
- "que ramos / coberturas tienen mayor % sospechoso" -> estadisticas_por_cobertura
- "que ciudades tienen mayor concentracion de alertas" -> ranking_ciudades
- "que asegurados tienen mayor frecuencia de reclamos" -> asegurados_recurrentes
- "que documentos faltan en casos criticos" -> docs_faltantes(min_score=1)
- "casos con montos atipicos / cerca del limite de poliza" -> montos_atipicos
- "siniestros cerca del inicio (o fin) de la poliza" -> siniestros_borde_vigencia(modo='inicio')
- "que patrones se repiten en reclamos sospechosos" -> ENCADENAR: ranking_proveedores + ranking_ciudades + asegurados_recurrentes + anomalias_novedosas, luego sintetizar 3-5 patrones comunes con citas.
- "resumen ejecutivo / reporte para directorio / PDF" -> generar_reporte_pdf(tipo='ejecutivo' o 'directorio' o 'antifraude' o 'auditoria')
- "evalua este caso hipotetico" / "que pasa si tengo un robo de N usd con M dias..." -> evaluar_caso_hipotetico(...)
- "ahorro / ROI / impacto financiero" -> simulacion_ahorro

Formato de respuesta:
- DIRECTO: responde la pregunta concreta en la PRIMERA oracion. Nada de preludios.
- Si la respuesta cabe en 2-3 oraciones, NO uses bullets ni tablas.
- Para preguntas simples ("¿que es X?", "dame el nombre de Y"), MAX 3 oraciones.
- Conciso, en espanol latinoamericano NEUTRO con TUTEO (usa "tu/tienes/quieres/puedes/sabes").
- PROHIBIDO el voseo argentino: NO uses "vos/tenes/queres/podes/sabes" ni "che", "dale", "boludo".
- PROHIBIDO el "usted" formal. Tuteo amigable, ni muy formal ni muy de la calle.
- Ejemplo CORRECTO: "Encontre 3 casos criticos. Si quieres te muestro el detalle."
- Si listas casos, usa tabla markdown con id_siniestro, score/nivel, ramo y razon corta.
- Cuando muestres resultados de top_riesgo, indica EXPLICITAMENTE cuantos rojos y amarillos hay (ej: "7 ROJO + 3 AMARILLO").
- Si das numeros, redondea a 0 decimales para USD.
- Termina con UNA accion sugerida SOLO si aporta valor; si era un dato simple, no la pongas.
"""


@dataclass
class ClaimsAgent:
    api_key: str = field(default_factory=lambda: os.environ["AZURE_OPENAI_API_KEY"])
    endpoint: str = field(default_factory=lambda: os.environ["AZURE_OPENAI_ENDPOINT"])
    api_version: str = field(default_factory=lambda: os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21"))
    deployment: str = field(default_factory=lambda: os.environ.get("AZURE_OPENAI_DEPLOYMENT_CHAT", "gpt-5-mini"))
    # gpt-5-mini es un modelo de razonamiento: por defecto "piensa" antes de
    # responder y eso agrega latencia. Para tool-calling + redaccion no hace
    # falta razonamiento profundo, asi que arrancamos en "minimal".
    # Override con AZURE_OPENAI_REASONING_EFFORT=low|medium|high (o "" para apagar).
    reasoning_effort: str = field(
        default_factory=lambda: os.environ.get("AZURE_OPENAI_REASONING_EFFORT", "minimal")
    )
    max_tool_iterations: int = 6

    def __post_init__(self):
        self.client = AzureOpenAI(
            api_key=self.api_key,
            api_version=self.api_version,
            azure_endpoint=self.endpoint,
        )
        # Se desactiva automaticamente si el deployment/api-version no lo soporta
        # (ver _create), para no romper el chat si Azure devuelve "unsupported param".
        self._reasoning_disabled = False

    def _create(self, *, stream: bool = False, use_tools: bool = True,
                force_tool: bool = False, **extra):
        """Llama a chat.completions con tools (opcional) + reasoning_effort.

        - use_tools=False: NO se envia el schema de las 10 tools (ahorra ~2-3s
          de procesamiento del prompt para mensajes conversacionales).
        - force_tool=True: tool_choice="required" — fuerza al modelo a llamar al
          menos una tool en lugar de responder con texto. Util para "data".
        """
        kwargs: dict[str, Any] = {
            "model": self.deployment,
            "stream": stream,
            **extra,
        }
        if use_tools:
            kwargs["tools"] = TOOLS_SCHEMA
            # "required" obliga al modelo a llamar una tool (no responder con texto).
            # "auto" deja la decision al modelo (puede contestar sin llamar).
            kwargs["tool_choice"] = "required" if force_tool else "auto"
        if stream:
            kwargs["stream_options"] = {"include_usage": True}
        if self.reasoning_effort and not self._reasoning_disabled:
            kwargs["reasoning_effort"] = self.reasoning_effort
        try:
            return self.client.chat.completions.create(**kwargs)
        except Exception as exc:
            if "reasoning_effort" in str(exc) and not self._reasoning_disabled:
                # Deployment/api-version no soporta el parametro: apagarlo y reintentar
                self._reasoning_disabled = True
                kwargs.pop("reasoning_effort", None)
                return self.client.chat.completions.create(**kwargs)
            raise

    def chat(self, user_message: str, history: list[dict] | None = None) -> dict:
        """Envia un mensaje al agente. Retorna dict con response, tool_calls usados, tokens."""
        # ORQUESTADOR: clasifica la intencion y rutea a la mejor estrategia
        route = classify_intent(user_message)
        if route == "canned":
            return {
                "response": canned_response(user_message),
                "tools_used": [],
                "tokens": 0,
                "iterations": 0,
                "route": "canned",
            }
        # Si la intencion es conversacional/explicativa, no cargamos las 10 tools
        # en el prompt (ahorra ~2-3s de procesamiento del schema).
        use_tools = route in ("data", "default")

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        # Si NO usamos tools, hacemos UNA sola llamada y devolvemos
        if not use_tools:
            resp = self._create(messages=messages, use_tools=False)
            return {
                "response": resp.choices[0].message.content or "",
                "tools_used": [],
                "tokens": resp.usage.total_tokens if resp.usage else 0,
                "iterations": 1,
                "route": route,
            }

        # Si la ruta es "data" (el usuario claramente pidio datos),
        # FORZAMOS la primera tool_call para evitar respuestas vacias tipo
        # "Llamo a top_riesgo(limit=10) para obtener..." que no invocan nada.
        force_first_tool = (route == "data")

        tools_used: list[dict[str, Any]] = []
        total_tokens = 0

        for iteration in range(self.max_tool_iterations):
            # En la PRIMERA iteracion de route=data forzamos tool_call.
            # En iteraciones siguientes (cuando ya hay tool_results en el contexto)
            # dejamos tool_choice=auto para que pueda responder texto si ya tiene info.
            resp = self._create(
                messages=messages,
                force_tool=(force_first_tool and iteration == 0),
            )
            total_tokens += resp.usage.total_tokens
            choice = resp.choices[0]
            msg = choice.message
            messages.append(msg.model_dump(exclude_none=True))

            if not msg.tool_calls:
                # Agente termino, devolver respuesta final
                return {
                    "response": msg.content or "",
                    "tools_used": tools_used,
                    "tokens": total_tokens,
                    "iterations": iteration + 1,
                }

            # Ejecutar cada tool call
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                if tool_name not in TOOLS_REGISTRY:
                    tool_result = {"error": f"Tool {tool_name} no existe"}
                else:
                    try:
                        tool_result = TOOLS_REGISTRY[tool_name](**args)
                    except Exception as exc:
                        tool_result = {"error": f"{type(exc).__name__}: {exc}"}

                # Para tools que el frontend necesita renderizar (botones, links),
                # incluimos el result completo. Para el resto, solo summary truncado.
                tool_meta = {"tool": tool_name, "args": args,
                             "result_summary": str(tool_result)[:200]}
                if tool_name in ("generar_reporte_pdf", "evaluar_caso_hipotetico"):
                    tool_meta["result_full"] = tool_result
                tools_used.append(tool_meta)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(tool_result, ensure_ascii=False, default=str)[:8000],
                })

        return {
            "response": "Llegue al limite de iteraciones sin respuesta final. Reformulame la pregunta?",
            "tools_used": tools_used,
            "tokens": total_tokens,
            "iterations": self.max_tool_iterations,
        }

    def chat_stream(self, user_message: str, history: list[dict] | None = None):
        """Version streaming: yield events conforme avanza la conversacion.

        Eventos emitidos (cada uno es un dict):
          {"type": "tool_call", "tool": str, "args": dict}
          {"type": "tool_result", "tool": str, "summary": str}
          {"type": "delta", "text": str}    -> token o fragmento de la respuesta final
          {"type": "done", "tokens": int, "tools_used": list, "iterations": int}
          {"type": "error", "message": str}
        """
        # ORQUESTADOR: ruta rapida para saludos / explicaciones
        route = classify_intent(user_message)
        if route == "canned":
            yield {"type": "delta", "text": canned_response(user_message)}
            yield {"type": "done", "tokens": 0, "tools_used": [], "iterations": 0, "route": "canned"}
            return
        use_tools = route in ("data", "default")
        # Si la ruta es "data", forzamos la primera tool_call para evitar
        # respuestas-anuncio tipo "Llamo a top_riesgo(...)".
        force_first_tool = (route == "data")

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        tools_used: list[dict[str, Any]] = []
        total_tokens = 0

        for iteration in range(self.max_tool_iterations):
            # Streaming REAL: pedimos stream=True y vamos emitiendo deltas de
            # texto conforme Azure los genera. En la primera iteracion de "data"
            # forzamos tool_call. En siguientes iteraciones dejamos auto.
            stream = self._create(
                messages=messages,
                stream=True,
                use_tools=use_tools,
                force_tool=(force_first_tool and iteration == 0),
            )

            content_parts: list[str] = []
            tool_calls_acc: dict[int, dict[str, str]] = {}

            for chunk in stream:
                if getattr(chunk, "usage", None):
                    total_tokens += chunk.usage.total_tokens
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                # Texto de la respuesta final -> emitir en vivo
                if getattr(delta, "content", None):
                    content_parts.append(delta.content)
                    yield {"type": "delta", "text": delta.content}

                # Tool calls llegan en fragmentos: acumular por indice
                if getattr(delta, "tool_calls", None):
                    for tcd in delta.tool_calls:
                        slot = tool_calls_acc.setdefault(
                            tcd.index, {"id": "", "name": "", "arguments": ""}
                        )
                        if tcd.id:
                            slot["id"] = tcd.id
                        if tcd.function and tcd.function.name:
                            slot["name"] += tcd.function.name
                        if tcd.function and tcd.function.arguments:
                            slot["arguments"] += tcd.function.arguments

            # Sin tool calls -> ya streameamos el texto final, terminamos
            if not tool_calls_acc:
                yield {
                    "type": "done",
                    "tokens": total_tokens,
                    "tools_used": tools_used,
                    "iterations": iteration + 1,
                }
                return

            # Reconstruir el mensaje del assistant con sus tool_calls
            ordered = [tool_calls_acc[i] for i in sorted(tool_calls_acc)]
            messages.append({
                "role": "assistant",
                "content": "".join(content_parts) or None,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {"name": tc["name"], "arguments": tc["arguments"]},
                    }
                    for tc in ordered
                ],
            })

            # Ejecutar cada tool call - emitir eventos por cada uno
            for tc in ordered:
                tool_name = tc["name"]
                try:
                    args = json.loads(tc["arguments"] or "{}")
                except json.JSONDecodeError:
                    args = {}

                yield {"type": "tool_call", "tool": tool_name, "args": args}

                if tool_name not in TOOLS_REGISTRY:
                    tool_result = {"error": f"Tool {tool_name} no existe"}
                else:
                    try:
                        tool_result = TOOLS_REGISTRY[tool_name](**args)
                    except Exception as exc:
                        tool_result = {"error": f"{type(exc).__name__}: {exc}"}

                tool_meta = {"tool": tool_name, "args": args,
                             "result_summary": str(tool_result)[:200]}
                if tool_name in ("generar_reporte_pdf", "evaluar_caso_hipotetico"):
                    tool_meta["result_full"] = tool_result
                tools_used.append(tool_meta)

                yield {"type": "tool_result", "tool": tool_name,
                       "summary": str(tool_result)[:200]}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(tool_result, ensure_ascii=False, default=str)[:8000],
                })

        yield {
            "type": "done",
            "tokens": total_tokens,
            "tools_used": tools_used,
            "iterations": self.max_tool_iterations,
            "response": "Llegue al limite de iteraciones sin respuesta final.",
        }


# Convenience CLI
if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv("./.env")
    agent = ClaimsAgent()
    print("AchachAI agente listo. Escribi tu pregunta (Ctrl+C para salir):")
    history = []
    while True:
        try:
            q = input("\n> ").strip()
            if not q:
                continue
            result = agent.chat(q, history=history)
            print(f"\n{result['response']}")
            print(f"\n[tools usados: {[t['tool'] for t in result['tools_used']]} | tokens: {result['tokens']}]")
            history.append({"role": "user", "content": q})
            history.append({"role": "assistant", "content": result["response"]})
        except (KeyboardInterrupt, EOFError):
            print("\nBye.")
            break
