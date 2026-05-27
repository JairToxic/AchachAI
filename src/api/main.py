"""FastAPI backend para AchachAI.

Endpoints:
  GET  /health
  GET  /casos                  - bandeja paginada con filtros
  GET  /casos/{id_siniestro}   - detalle + score + reglas + senales + explicacion
  POST /chat                   - agente conversacional gpt-5-mini
  GET  /proveedores/ranking    - top proveedores
  GET  /ciudades/ranking       - top ciudades
  GET  /reportes/ejecutivo     - resumen ejecutivo via agente

Uso:
    uvicorn src.api.main:app --reload --port 8000
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import duckdb
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Cargar .env desde la raiz del proyecto
ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

import sys
sys.path.insert(0, str(ROOT))
from src.ai_agent import ClaimsAgent  # noqa: E402
from src.ai_agent.tools import (  # noqa: E402
    asegurados_recurrentes,
    detalle_siniestro,
    docs_faltantes,
    ranking_ciudades,
    ranking_proveedores,
    top_riesgo,
)
from src.rules import build_contexto, evaluate_siniestro  # noqa: E402
from src.document_analysis import (  # noqa: E402
    analyze_factura,
    analyze_imagen_dano,
    analyze_documento_generico,
)

PROC = ROOT / "data" / "processed"

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
log = logging.getLogger("achachai-api")

app = FastAPI(
    title="AchachAI - Fraud Detection API",
    description="Reto Aseguradora del Sur - hackIAthon 2026",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache global del agente
_agent: ClaimsAgent | None = None


def get_agent() -> ClaimsAgent:
    global _agent
    if _agent is None:
        _agent = ClaimsAgent()
    return _agent


# ===================== Schemas =====================
class ChatRequest(BaseModel):
    message: str
    history: list[dict] | None = None


class ChatResponse(BaseModel):
    response: str
    tools_used: list[dict]
    tokens: int
    iterations: int


# ===================== Endpoints =====================
@app.get("/health")
def health():
    """Healthcheck con estado de Azure OpenAI y archivos de datos."""
    parquet_files = list(PROC.glob("*.parquet"))
    return {
        "status": "ok",
        "data_tables": [f.name for f in parquet_files],
        "azure_openai_configured": bool(os.environ.get("AZURE_OPENAI_API_KEY")),
        "azure_openai_endpoint": os.environ.get("AZURE_OPENAI_ENDPOINT"),
        "azure_openai_deployment": os.environ.get("AZURE_OPENAI_DEPLOYMENT_CHAT"),
        "azure_ml_endpoint_configured": bool(os.environ.get("AZURE_ML_ENDPOINT_URL")),
    }


@app.get("/casos")
def get_casos(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    nivel: str | None = Query(None, regex="^(VERDE|AMARILLO|ROJO)$"),
    ciudad: str | None = None,
    cobertura: str | None = None,
):
    """Bandeja paginada de siniestros. NO calcula score (usar /casos/{id} para eso)."""
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
    where = []
    if ciudad:
        where.append(f"ciudad_evento ILIKE '%{ciudad}%'")
    if cobertura:
        where.append(f"cobertura ILIKE '%{cobertura}%'")
    where_clause = "WHERE " + " AND ".join(where) if where else ""
    total = con.execute(f"SELECT COUNT(*) FROM s {where_clause}").fetchone()[0]
    rows = con.execute(f"""
        SELECT id_siniestro, id_poliza, cobertura, estado, fecha_ocurrencia,
               monto_reclamado_usd, monto_pagado_usd, ciudad_evento,
               documentos_completos, etiqueta_fraude_simulada, caso_inyectado
        FROM s {where_clause}
        ORDER BY fecha_ocurrencia DESC
        LIMIT {limit} OFFSET {offset}
    """).df().to_dict("records")
    return {"total": total, "limit": limit, "offset": offset, "items": rows}


@app.get("/casos/{id_siniestro}")
def get_caso(id_siniestro: str):
    """Detalle completo del siniestro con score + reglas + senales."""
    result = detalle_siniestro(id_siniestro)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@app.get("/proveedores/ranking")
def get_proveedores(top_n: int = 10, solo_lista_restrictiva: bool = False):
    return ranking_proveedores(top_n=top_n, solo_lista_restrictiva=solo_lista_restrictiva)


@app.get("/ciudades/ranking")
def get_ciudades(top_n: int = 10):
    return ranking_ciudades(top_n=top_n)


@app.get("/asegurados/recurrentes")
def get_asegurados(min_siniestros: int = 3, top_n: int = 10):
    return asegurados_recurrentes(min_siniestros=min_siniestros, top_n=top_n)


@app.get("/docs/faltantes")
def get_docs_faltantes(min_score: int = 76):
    return docs_faltantes(min_score=min_score)


@app.get("/top-riesgo")
def get_top_riesgo(limit: int = 10, nivel: str | None = None):
    """Top N siniestros con mayor score (evalua reglas+modelo en vivo)."""
    return top_riesgo(limit=limit, nivel=nivel)


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """Pasa el mensaje al agente gpt-5-mini con function calling."""
    try:
        result = get_agent().chat(req.message, history=req.history)
        return ChatResponse(**result)
    except Exception as exc:
        log.exception("Error en /chat")
        raise HTTPException(500, f"{type(exc).__name__}: {exc}")


@app.get("/reportes/ejecutivo")
def reporte_ejecutivo():
    """Resumen ejecutivo generado por el agente."""
    result = get_agent().chat(
        "Genera un resumen ejecutivo del estado actual de la cartera: "
        "menciona total de casos, cuantos en ROJO/AMARILLO/VERDE, top 3 proveedores "
        "con mas alertas, ciudades con mayor concentracion, y 3 recomendaciones "
        "prioritarias para el analista."
    )
    return result


@app.post("/analyze-document")
async def analyze_document(
    file: UploadFile = File(...),
    tipo: str = Form("factura"),
    fecha_ocurrencia: str | None = Form(None),
    descripcion_siniestro: str | None = Form(None),
):
    """Analiza un documento (factura/imagen/parte) con Azure DI + GPT-4o Vision.

    Body multipart:
      - file: el archivo (.pdf, .jpg, .png)
      - tipo: 'factura' | 'imagen_dano' | 'parte_policial' | 'denuncia' | 'documento'
      - fecha_ocurrencia: ISO date (para validar facturas vs evento)
      - descripcion_siniestro: relato del asegurado (para cruzar con imagen)

    Devuelve DocumentAnalysisResult con score, inconsistencias y explicacion.
    """
    file_bytes = await file.read()
    try:
        if tipo == "factura":
            result = analyze_factura(file_bytes, fecha_ocurrencia=fecha_ocurrencia)
        elif tipo == "imagen_dano":
            if not descripcion_siniestro:
                raise HTTPException(400, "descripcion_siniestro requerida para imagen_dano")
            result = analyze_imagen_dano(file_bytes, descripcion_siniestro)
        else:
            result = analyze_documento_generico(
                file_bytes, tipo=tipo,
                contexto_siniestro={"fecha_ocurrencia": fecha_ocurrencia,
                                    "descripcion": descripcion_siniestro}
                if fecha_ocurrencia or descripcion_siniestro else None,
            )
        return result.to_dict()
    except Exception as exc:
        log.exception("Error en /analyze-document")
        raise HTTPException(500, f"{type(exc).__name__}: {exc}")


@app.get("/kpis")
def get_kpis():
    """KPIs basicos para el dashboard."""
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW p AS SELECT * FROM '{(PROC / 'proveedores.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW d AS SELECT * FROM '{(PROC / 'documentos.parquet').as_posix()}'")

    total = con.execute("SELECT COUNT(*) FROM s").fetchone()[0]
    fraudes = con.execute("SELECT SUM(etiqueta_fraude_simulada) FROM s").fetchone()[0]
    monto_total = con.execute("SELECT SUM(monto_reclamado_usd) FROM s").fetchone()[0]
    monto_fraudes = con.execute("SELECT SUM(monto_reclamado_usd) FROM s WHERE etiqueta_fraude_simulada=1").fetchone()[0]
    prov_restrict = con.execute("SELECT COUNT(*) FROM p WHERE lista_restrictiva = true").fetchone()[0]
    n_docs = con.execute("SELECT COUNT(*) FROM d").fetchone()[0]
    n_inconsist = con.execute("SELECT COUNT(*) FROM d WHERE inconsistencia_detectada = true").fetchone()[0]

    cob = con.execute("SELECT cobertura, COUNT(*) AS n FROM s GROUP BY cobertura ORDER BY n DESC").df().to_dict("records")
    estado = con.execute("SELECT estado, COUNT(*) AS n FROM s GROUP BY estado ORDER BY n DESC").df().to_dict("records")

    return {
        "totales": {
            "siniestros": int(total),
            "fraudes_simulados": int(fraudes or 0),
            "tasa_fraude_simulada": float((fraudes or 0) / max(total, 1)),
            "monto_reclamado_total_usd": float(monto_total or 0),
            "monto_reclamado_fraudes_usd": float(monto_fraudes or 0),
            "proveedores_lista_restrictiva": int(prov_restrict),
            "documentos_totales": int(n_docs),
            "documentos_inconsistentes": int(n_inconsist),
        },
        "distribucion_cobertura": cob,
        "distribucion_estado": estado,
    }
