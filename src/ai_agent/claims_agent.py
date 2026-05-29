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
- NUNCA acuses a un asegurado de fraude. Habla siempre de "posible fraude", "requiere revision", "patron sospechoso".
- Toda decision final es del analista humano. Tu solo sugieres.
- Cita evidencia concreta: id_siniestro, reglas activadas, montos, fechas.
- Si no estas seguro, dilo. No inventes datos.
- Usa SIEMPRE las tools disponibles para obtener datos, no respondas de memoria.
- Si una pregunta requiere multiples queries, encadena tools.
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
- Conciso, en espanol latinoamericano (no formal de Espana).
- Si listas casos, usa tabla markdown con id_siniestro, score/nivel, ramo y una razon corta.
- Cuando muestres resultados de top_riesgo, indica EXPLICITAMENTE cuantos rojos y cuantos amarillos hay (ej: "encontre 7 ROJO + 3 AMARILLO").
- Si das numeros, redondea a 0 decimales para USD.
- Termina con UNA accion sugerida (1-2 lineas) para el analista.
"""


@dataclass
class ClaimsAgent:
    api_key: str = field(default_factory=lambda: os.environ["AZURE_OPENAI_API_KEY"])
    endpoint: str = field(default_factory=lambda: os.environ["AZURE_OPENAI_ENDPOINT"])
    api_version: str = field(default_factory=lambda: os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21"))
    deployment: str = field(default_factory=lambda: os.environ.get("AZURE_OPENAI_DEPLOYMENT_CHAT", "gpt-5-mini"))
    max_tool_iterations: int = 6

    def __post_init__(self):
        self.client = AzureOpenAI(
            api_key=self.api_key,
            api_version=self.api_version,
            azure_endpoint=self.endpoint,
        )

    def chat(self, user_message: str, history: list[dict] | None = None) -> dict:
        """Envia un mensaje al agente. Retorna dict con response, tool_calls usados, tokens."""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        tools_used: list[dict[str, Any]] = []
        total_tokens = 0

        for iteration in range(self.max_tool_iterations):
            resp = self.client.chat.completions.create(
                model=self.deployment,
                messages=messages,
                tools=TOOLS_SCHEMA,
                tool_choice="auto",
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
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        tools_used: list[dict[str, Any]] = []
        total_tokens = 0

        for iteration in range(self.max_tool_iterations):
            # Llamada NO streaming primero: necesitamos saber si hay tool_calls.
            # Si la respuesta es directa (sin tools), reemitimos como deltas
            # para mantener la UX consistente. Si hay tools, las procesamos
            # y en la siguiente iteracion el LLM puede o no streamear.
            resp = self.client.chat.completions.create(
                model=self.deployment,
                messages=messages,
                tools=TOOLS_SCHEMA,
                tool_choice="auto",
            )
            if resp.usage:
                total_tokens += resp.usage.total_tokens
            choice = resp.choices[0]
            msg = choice.message
            messages.append(msg.model_dump(exclude_none=True))

            if not msg.tool_calls:
                # Respuesta final - emitir el texto en chunks para que se sienta streaming
                text = msg.content or ""
                chunk_size = 12  # caracteres por chunk (~3-4 palabras)
                for i in range(0, len(text), chunk_size):
                    yield {"type": "delta", "text": text[i:i + chunk_size]}
                yield {
                    "type": "done",
                    "tokens": total_tokens,
                    "tools_used": tools_used,
                    "iterations": iteration + 1,
                }
                return

            # Procesar tool calls - emitir eventos por cada uno
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                try:
                    args = json.loads(tc.function.arguments or "{}")
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
                    "tool_call_id": tc.id,
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
