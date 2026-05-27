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

REGLAS DURAS (no negociables):
- NUNCA acuses a un asegurado de fraude. Habla siempre de "posible fraude", "requiere revision", "patron sospechoso".
- Toda decision final es del analista humano. Tu solo sugieres.
- Cita evidencia concreta: id_siniestro, reglas activadas, montos, fechas.
- Si no estas seguro, dilo. No inventes datos.
- Usa SIEMPRE las tools disponibles para obtener datos, no respondas de memoria.
- Si una pregunta requiere multiples queries, encadena tools.

Formato de respuesta:
- Conciso, en espanol latinoamericano (no formal de Espana).
- Si listas casos, usa tabla markdown.
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

                tools_used.append({"tool": tool_name, "args": args,
                                   "result_summary": str(tool_result)[:200]})
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
