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

import asyncio
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

# NOTE: el archivo embeddings_descripciones.npz NO se lee en runtime.
# El sistema usa data/processed/similitudes.parquet (precomputado offline).
# Si necesitas regenerar similitudes con casos nuevos, descarga el .npz desde
# el blob (ver src/bootstrap.py) y corre scripts/compute_embeddings.py local.

from src.ai_agent import ClaimsAgent  # noqa: E402
from src.ai_agent.tools import (  # noqa: E402
    asegurados_recurrentes,
    detalle_siniestro,
    docs_faltantes,
    estadisticas_por_cobertura,
    exportar_reporte,
    montos_atipicos,
    ranking_ciudades,
    ranking_proveedores,
    simulacion_ahorro,
    top_riesgo,
)
from src.rules import build_contexto, evaluate_siniestro  # noqa: E402
from src.document_analysis import (  # noqa: E402
    analyze_factura,
    analyze_imagen_dano,
    analyze_documento_generico,
    analyze_parte_policial,
    analyze_declaracion_accidente,
    analyze_visual_forensics,
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


# ===================== Warmup en startup =====================
# Precalienta los caches mas costosos en background (no bloquea el boot).
# Sin esto, la PRIMERA llamada a /top-riesgo desde el frontend tarda ~15-20s
# porque evalua 2000+ siniestros con reglas/scoring por primera vez.
_WARMUP_STATE: dict = {"started": False, "top_riesgo_ready": False, "agent_ready": False, "error": None}


def _warmup_background() -> None:
    """Corre en thread separado al arrancar el server. Idempotente."""
    import threading, time as _t

    def _work():
        t0 = _t.time()
        try:
            log.info("[warmup] precalentando top_riesgo cache...")
            from src.ai_agent.tools import _compute_top_riesgo_all
            _compute_top_riesgo_all()
            _WARMUP_STATE["top_riesgo_ready"] = True
            log.info(f"[warmup] top_riesgo listo en {_t.time()-t0:.1f}s")
        except Exception as e:
            log.exception(f"[warmup] top_riesgo fallo: {e}")
            _WARMUP_STATE["error"] = f"top_riesgo: {e}"
        try:
            log.info("[warmup] instanciando ClaimsAgent...")
            get_agent()
            _WARMUP_STATE["agent_ready"] = True
            log.info(f"[warmup] agente listo, total {_t.time()-t0:.1f}s")
        except Exception as e:
            log.exception(f"[warmup] agent fallo: {e}")
            _WARMUP_STATE["error"] = (_WARMUP_STATE["error"] or "") + f" | agent: {e}"

    if _WARMUP_STATE["started"]:
        return
    _WARMUP_STATE["started"] = True
    threading.Thread(target=_work, daemon=True, name="achachai-warmup").start()


@app.on_event("startup")
def _on_startup():
    _warmup_background()


@app.get("/warmup")
def warmup_status():
    """Estado del precalentado (sirve para verificar cuando esta listo)."""
    return _WARMUP_STATE


# ===================== Demo: servir PDFs oficiales =====================
# Permite al frontend pre-cargar facturas / partes policiales / declaraciones
# del Excel oficial sin que el usuario los suba manualmente.
_DEMO_DOCS_DIR = ROOT / "data" / "Data set documentos evento"
_DEMO_DOCS_SUBDIRS = {
    "factura": "FACTURAS",
    "parte_policial": "PARTE POLICIAL",
    "declaracion": "DECLARACIÓN DE ACCIDENTE",
}


@app.get("/demo-docs/manifest")
def demo_docs_manifest():
    """Lista los PDFs disponibles agrupados por tipo + por id de siniestro.

    Permite al frontend mostrar opciones tipo "Caso SIN-0022 (factura + parte)".
    """
    import re
    out: dict[str, dict[str, list[str]]] = {}
    for tipo, subdir in _DEMO_DOCS_SUBDIRS.items():
        d = _DEMO_DOCS_DIR / subdir
        if not d.exists():
            continue
        for p in d.glob("*.pdf"):
            # buscar SIN-XXXX en el nombre del archivo
            m = re.search(r"SIN[-_]?(\d{3,5})", p.name)
            if not m:
                continue
            sin_id = f"SIN-{int(m.group(1)):04d}"
            out.setdefault(sin_id, {})
            out[sin_id].setdefault(tipo, []).append(p.name)
    return {"casos": out}


@app.get("/demo-docs/{tipo}/{filename}")
def demo_docs_serve(tipo: str, filename: str):
    """Sirve un PDF concreto del repo oficial. Solo PDFs y rutas validadas."""
    from fastapi.responses import FileResponse
    if tipo not in _DEMO_DOCS_SUBDIRS:
        raise HTTPException(404, f"Tipo desconocido: {tipo}")
    # Sanitizar filename: solo basename, sin paths
    safe = Path(filename).name
    if not safe.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo se sirven PDFs")
    target = _DEMO_DOCS_DIR / _DEMO_DOCS_SUBDIRS[tipo] / safe
    if not target.exists() or not target.is_file():
        raise HTTPException(404, f"No existe {tipo}/{safe}")
    return FileResponse(target, media_type="application/pdf", filename=safe)


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
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    ramo: str | None = None,
    ciudad: str | None = None,
    sucursal: str | None = None,
    cobertura: str | None = None,
    estado: str | None = None,
    proveedor: str | None = None,
    asegurado: str | None = None,
    q: str | None = None,                  # busqueda libre por id_siniestro
    monto_min: float | None = None,
    monto_max: float | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    solo_fraude_sim: bool = False,
    solo_inyectados: bool = False,
    orden: str = Query("fecha_desc", regex="^(fecha_desc|fecha_asc|monto_desc|monto_asc)$"),
):
    """Bandeja paginada de siniestros con filtros amplios.

    NO calcula score (usar /casos/{id} para eso). Sirve para el Explorador.
    """
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
    where = []

    def _esc(v: str) -> str:
        return v.replace("'", "''")

    if ramo: where.append(f"ramo ILIKE '%{_esc(ramo)}%'")
    if ciudad: where.append(f"ciudad_evento ILIKE '%{_esc(ciudad)}%'")
    if sucursal: where.append(f"sucursal ILIKE '%{_esc(sucursal)}%'")
    if cobertura: where.append(f"cobertura ILIKE '%{_esc(cobertura)}%'")
    if estado: where.append(f"estado ILIKE '%{_esc(estado)}%'")
    if proveedor: where.append(f"id_proveedor ILIKE '%{_esc(proveedor)}%'")
    if asegurado: where.append(f"id_asegurado ILIKE '%{_esc(asegurado)}%'")
    if q: where.append(f"id_siniestro ILIKE '%{_esc(q)}%'")
    if monto_min is not None: where.append(f"monto_reclamado_usd >= {float(monto_min)}")
    if monto_max is not None: where.append(f"monto_reclamado_usd <= {float(monto_max)}")
    if fecha_desde: where.append(f"fecha_ocurrencia >= '{_esc(fecha_desde)}'")
    if fecha_hasta: where.append(f"fecha_ocurrencia <= '{_esc(fecha_hasta)}'")
    if solo_fraude_sim: where.append("etiqueta_fraude_simulada = 1")
    if solo_inyectados: where.append("caso_inyectado = true")

    where_clause = "WHERE " + " AND ".join(where) if where else ""
    order_clause = {
        "fecha_desc": "fecha_ocurrencia DESC",
        "fecha_asc": "fecha_ocurrencia ASC",
        "monto_desc": "monto_reclamado_usd DESC",
        "monto_asc": "monto_reclamado_usd ASC",
    }[orden]

    total = con.execute(f"SELECT COUNT(*) FROM s {where_clause}").fetchone()[0]
    _df = con.execute(f"""
        SELECT id_siniestro, id_poliza, id_asegurado, id_proveedor, id_vehiculo,
               ramo, cobertura, estado, fecha_ocurrencia, sucursal,
               monto_reclamado_usd, monto_pagado_usd, ciudad_evento,
               documentos_completos, etiqueta_fraude_simulada, caso_inyectado
        FROM s {where_clause}
        ORDER BY {order_clause}
        LIMIT {limit} OFFSET {offset}
    """).df()
    # Convertir NaN/NaT a None para que FastAPI pueda serializar a JSON valido
    _df = _df.astype(object).where(_df.notna(), None)
    rows = _df.to_dict("records")
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "n_paginas": (total + limit - 1) // limit if total else 0,
        "items": rows,
        "filtros_aplicados": {
            k: v for k, v in {
                "ramo": ramo, "ciudad": ciudad, "sucursal": sucursal, "cobertura": cobertura,
                "estado": estado, "proveedor": proveedor, "asegurado": asegurado,
                "q": q, "monto_min": monto_min, "monto_max": monto_max,
                "fecha_desde": fecha_desde, "fecha_hasta": fecha_hasta,
                "solo_fraude_sim": solo_fraude_sim, "solo_inyectados": solo_inyectados,
            }.items() if v not in (None, False, "")
        },
    }


# ===================== CARGAR CASOS NUEVOS AL DATASET =====================
# Columnas mínimas esperadas (resto se autocompletan con defaults)
COLUMNAS_REQUERIDAS = ["cobertura", "monto_reclamado_usd"]

COLUMNAS_DEFAULTS = {
    "id_siniestro": None,  # se auto-genera
    "id_poliza": "POL-NEW",
    "id_asegurado": "ASE-NEW",
    "id_vehiculo": "VEH-NEW",
    "id_proveedor": "PRV-NEW",
    "id_conductor": "CON-NEW",
    "ramo": "Vehiculos",
    "cobertura": "Choque",
    "fecha_ocurrencia": None,  # default fecha actual
    "fecha_reporte": None,
    "monto_reclamado_usd": 0.0,
    "monto_estimado_usd": 0.0,
    "monto_pagado_usd": 0.0,
    "estado": "Reserva",
    "sucursal": "Quito",
    "ciudad_evento": "Quito",
    "descripcion": "Caso cargado manualmente",
    "documentos_completos": True,
    "tipo_beneficiario": "Taller",
    "dias_desde_inicio_poliza": 60,
    "dias_desde_fin_poliza": 305,
    "dias_entre_ocurrencia_reporte": 1,
    "historial_siniestros_asegurado": 0,
    "tuvo_parte_policial": True,
    "tuvo_testigo": False,
    "fault_responsable": "Asegurado",
    "etiqueta_fraude_simulada": 0,
    "caso_inyectado": False,
}


def _enriquecer_y_appendear(filas: list[dict], origen: str = "manual") -> dict:
    """Recibe lista de dicts, autocompleta defaults, valida y persiste a siniestros.parquet."""
    sin_path = PROC / "siniestros.parquet"
    if not sin_path.exists():
        raise HTTPException(500, "siniestros.parquet no existe — no hay base que extender")

    existentes = pd.read_parquet(sin_path)
    n_antes = len(existentes)

    fecha_hoy = pd.Timestamp.now().strftime("%Y-%m-%d")
    enriquecidos = []
    errores = []
    siguiente_id = existentes["id_siniestro"].max() if not existentes.empty else "SIN-100000"
    try:
        siguiente_num = int(str(siguiente_id).split("-")[1]) + 1
    except Exception:
        siguiente_num = 200000

    for i, row in enumerate(filas):
        try:
            # Faltantes obligatorios
            for col in COLUMNAS_REQUERIDAS:
                if col not in row or row[col] in (None, ""):
                    raise ValueError(f"Falta columna obligatoria: {col}")

            # Defaults
            full: dict = {}
            for col, default in COLUMNAS_DEFAULTS.items():
                if col in row and row[col] not in (None, ""):
                    full[col] = row[col]
                elif default is not None:
                    full[col] = default

            # Auto-generar id si falta
            if not full.get("id_siniestro"):
                full["id_siniestro"] = f"SIN-{siguiente_num}"
                siguiente_num += 1

            # Fechas default = hoy
            if not full.get("fecha_ocurrencia"):
                full["fecha_ocurrencia"] = fecha_hoy
            if not full.get("fecha_reporte"):
                full["fecha_reporte"] = fecha_hoy

            # Marcar origen
            full["caso_inyectado"] = bool(full.get("caso_inyectado", False))
            full["_origen_carga"] = origen
            full["_fecha_carga"] = pd.Timestamp.now().isoformat()

            enriquecidos.append(full)
        except Exception as e:
            errores.append({"fila": i + 1, "error": str(e), "datos": row})

    if not enriquecidos:
        return {
            "ok": False,
            "n_antes": int(n_antes),
            "n_agregados": 0,
            "n_total": int(n_antes),
            "errores": errores,
            "mensaje": "Ninguna fila pasó la validación.",
        }

    nuevos_df = pd.DataFrame(enriquecidos)
    # Alinear columnas con existentes (drop columnas que no estaban)
    cols_finales = list(existentes.columns)
    for c in cols_finales:
        if c not in nuevos_df.columns:
            nuevos_df[c] = COLUMNAS_DEFAULTS.get(c, None)
    nuevos_df = nuevos_df[cols_finales]

    combined = pd.concat([existentes, nuevos_df], ignore_index=True)
    combined.to_parquet(sin_path, index=False)

    # Invalidamos todas las caches que dependen de siniestros
    _top_riesgo_cache["data"] = None
    _anomalias_cache["data"] = None
    _ae_cache["data"] = None
    _ANOM_TOOL_CACHE = {}  # tool cache del agente

    return {
        "ok": True,
        "n_antes": int(n_antes),
        "n_agregados": int(len(enriquecidos)),
        "n_total": int(len(combined)),
        "n_errores": int(len(errores)),
        "errores": errores[:20],  # solo primeros 20 para no inundar
        "ids_generados": [e["id_siniestro"] for e in enriquecidos[:10]],
        "mensaje": (
            f"✓ {len(enriquecidos)} caso(s) agregado(s). "
            f"Ahora hay {len(combined):,} en la cartera. "
            f"Caches invalidados — el próximo /top-riesgo, /anomalias, etc. los incluirá."
        ),
    }


class CasoNuevo(BaseModel):
    cobertura: str
    monto_reclamado_usd: float
    monto_pagado_usd: float = 0.0
    estado: str = "Reserva"
    sucursal: str = "Quito"
    ciudad_evento: str | None = None
    descripcion: str = "Caso cargado manualmente"
    dias_desde_inicio_poliza: int = 60
    dias_desde_fin_poliza: int = 305
    dias_entre_ocurrencia_reporte: int = 1
    historial_siniestros_asegurado: int = 0
    documentos_completos: bool = True
    tuvo_parte_policial: bool = True
    tuvo_testigo: bool = False
    fault_responsable: str = "Asegurado"
    id_proveedor: str | None = None
    id_asegurado: str | None = None


@app.post("/casos/cargar")
def cargar_caso_unico(req: CasoNuevo):
    """Persiste UN caso al dataset (parquet) y devuelve el id generado.

    Útil para 'guardar' un caso desde la pantalla Evaluar después de evaluarlo.
    """
    row = req.model_dump()
    if not row.get("ciudad_evento"):
        row["ciudad_evento"] = row["sucursal"]
    return _enriquecer_y_appendear([row], origen="form_individual")


@app.post("/casos/cargar-csv")
async def cargar_casos_csv(file: UploadFile = File(...)):
    """Carga masiva: acepta un CSV (UTF-8) y agrega filas al dataset.

    Columnas obligatorias: cobertura, monto_reclamado_usd
    Resto se autocompletan con defaults.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "El archivo debe ser .csv")
    try:
        content = await file.read()
        import io
        df_csv = pd.read_csv(io.BytesIO(content), encoding="utf-8")
    except Exception as e:
        raise HTTPException(400, f"No pude parsear el CSV: {type(e).__name__}: {e}")

    if df_csv.empty:
        raise HTTPException(400, "El CSV está vacío.")

    filas = df_csv.to_dict("records")
    if len(filas) > 1000:
        raise HTTPException(400, f"Límite de 1000 filas por carga (vinieron {len(filas)}).")

    result = _enriquecer_y_appendear(filas, origen=f"csv_{file.filename}")
    return result


@app.get("/casos/plantilla.csv")
def plantilla_csv():
    """Devuelve un CSV de plantilla con las columnas esperadas y 2 filas de ejemplo."""
    from fastapi.responses import StreamingResponse
    import io, csv
    out = io.StringIO()
    cols = list(COLUMNAS_DEFAULTS.keys())
    cols.remove("id_siniestro")  # se auto-genera, no es necesaria
    w = csv.DictWriter(out, fieldnames=cols)
    w.writeheader()
    # 2 ejemplos: un caso normal y uno sospechoso
    w.writerow({
        "id_poliza": "POL-EJ001", "id_asegurado": "ASE-EJ001",
        "id_vehiculo": "VEH-EJ001", "id_proveedor": "PRV-EJ001",
        "id_conductor": "CON-EJ001", "ramo": "Vehiculos",
        "cobertura": "Choque", "fecha_ocurrencia": "2026-05-20",
        "fecha_reporte": "2026-05-21",
        "monto_reclamado_usd": 3500, "monto_estimado_usd": 3200,
        "monto_pagado_usd": 0, "estado": "Reserva",
        "sucursal": "Quito", "ciudad_evento": "Quito",
        "descripcion": "Colision lateral leve en intersección",
        "documentos_completos": True, "tipo_beneficiario": "Taller",
        "dias_desde_inicio_poliza": 180, "dias_desde_fin_poliza": 185,
        "dias_entre_ocurrencia_reporte": 1, "historial_siniestros_asegurado": 0,
        "tuvo_parte_policial": True, "tuvo_testigo": True,
        "fault_responsable": "Tercero",
        "etiqueta_fraude_simulada": 0, "caso_inyectado": False,
    })
    w.writerow({
        "id_poliza": "POL-EJ002", "id_asegurado": "ASE-EJ001",  # mismo asegurado!
        "id_vehiculo": "VEH-EJ001", "id_proveedor": "PRV-NEW0019",
        "id_conductor": "CON-EJ001", "ramo": "Vehiculos",
        "cobertura": "Robo", "fecha_ocurrencia": "2026-05-22",
        "fecha_reporte": "2026-05-28",
        "monto_reclamado_usd": 15000, "monto_estimado_usd": 14500,
        "monto_pagado_usd": 0, "estado": "Reserva",
        "sucursal": "Machala", "ciudad_evento": "Machala",
        "descripcion": "Vehiculo robado en parqueo, sin testigos",
        "documentos_completos": False, "tipo_beneficiario": "Taller",
        "dias_desde_inicio_poliza": 3, "dias_desde_fin_poliza": 362,
        "dias_entre_ocurrencia_reporte": 6, "historial_siniestros_asegurado": 2,
        "tuvo_parte_policial": False, "tuvo_testigo": False,
        "fault_responsable": "Asegurado",
        "etiqueta_fraude_simulada": 0, "caso_inyectado": False,
    })
    out.seek(0)
    return StreamingResponse(
        iter([out.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=plantilla_siniestros_achachai.csv"},
    )


@app.get("/casos/filtros/opciones")
def opciones_filtros():
    """Valores distintos para construir los <select> del Explorador."""
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
    def _vals(col: str) -> list[str]:
        df = con.execute(f"SELECT DISTINCT {col} FROM s WHERE {col} IS NOT NULL ORDER BY 1").df()
        return [str(v) for v in df[col].tolist()]
    return {
        "coberturas": _vals("cobertura"),
        "estados": _vals("estado"),
        "ciudades": _vals("ciudad_evento"),
        "sucursales": _vals("sucursal"),
    }


@app.get("/casos/{id_siniestro}")
def get_caso(id_siniestro: str):
    """Detalle completo del siniestro con score + reglas + senales."""
    result = detalle_siniestro(id_siniestro)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@app.get("/casos/{id_siniestro}/similares")
def get_similares(id_siniestro: str, top_n: int = Query(5, ge=1, le=20)):
    """Narrativas similares (cos sim > 0.94) precomputadas via embeddings.

    Une con siniestros + proveedores para devolver contexto de cada match.
    """
    pares_path = PROC / "similitudes_top_pares.parquet"
    if not pares_path.exists():
        return {"id_siniestro": id_siniestro, "similares": []}

    pares = pd.read_parquet(pares_path)
    # pares are symmetric (a,b) — match either column
    mask = (pares["id_siniestro_a"] == id_siniestro) | (pares["id_siniestro_b"] == id_siniestro)
    sub = pares[mask].copy()
    if sub.empty:
        return {"id_siniestro": id_siniestro, "similares": []}

    sub["otro"] = sub.apply(
        lambda r: r["id_siniestro_b"] if r["id_siniestro_a"] == id_siniestro else r["id_siniestro_a"],
        axis=1,
    )
    sub = sub.sort_values("sim", ascending=False).head(top_n)

    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW p AS SELECT * FROM '{(PROC / 'proveedores.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW v AS SELECT * FROM '{(PROC / 'vehiculos.parquet').as_posix()}'")

    out = []
    for _, row in sub.iterrows():
        oid = row["otro"]
        info = con.execute(f"""
            SELECT s.id_siniestro, s.id_proveedor, s.cobertura, s.ciudad_evento,
                   s.fecha_ocurrencia, s.monto_reclamado_usd,
                   v.marca, v.modelo, v.anio_vehiculo,
                   p.nombre AS prov_nombre, p.lista_restrictiva
            FROM s
            LEFT JOIN v ON v.id_vehiculo = s.id_vehiculo
            LEFT JOIN p ON p.id_proveedor = s.id_proveedor
            WHERE s.id_siniestro = '{oid}'
        """).df()
        if info.empty:
            continue
        r = info.iloc[0].to_dict()
        out.append({
            "id_siniestro": oid,
            "similitud": float(min(row["sim"], 1.0)),
            "id_proveedor": r.get("id_proveedor"),
            "proveedor": r.get("prov_nombre"),
            "lista_restrictiva": bool(r.get("lista_restrictiva")) if r.get("lista_restrictiva") is not None else False,
            "cobertura": r.get("cobertura"),
            "ciudad": r.get("ciudad_evento"),
            "fecha": str(r.get("fecha_ocurrencia")) if r.get("fecha_ocurrencia") is not None else None,
            "monto": float(r.get("monto_reclamado_usd") or 0),
            "vehiculo": f"{r.get('marca','')} {r.get('modelo','')} {int(r.get('anio_vehiculo',0)) or ''}".strip(),
        })

    return {"id_siniestro": id_siniestro, "similares": out}


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


_top_riesgo_cache: dict[str, Any] = {"data": None, "ts": 0.0}
_TOP_RIESGO_TTL_SEC = 300  # 5 minutos


@app.get("/top-riesgo")
def get_top_riesgo(
    limit: int = 10,
    nivel: str | None = None,
    ciudad: str | None = None,
    force: bool = False,
):
    """Top N siniestros con mayor score (evalua reglas+modelo en vivo).

    El computo pesado (evaluar reglas+modelo sobre el sample) lo cachea
    top_riesgo() internamente por 5 min; aqui solo filtramos/ordenamos en
    memoria. El filtro por `ciudad` se aplica sobre TODO el universo evaluado
    (no sobre un top-N global ya recortado), asi al filtrar por una sucursal/
    ciudad concreta ves TODOS sus casos de riesgo, no solo los que entraban en
    el top global.

    Cuando NO se pasa nivel, `top` trae un mix BALANCEADO ROJO+AMARILLO
    (60/40). Ademas siempre devuelve `verdes` (muestra de bajo riesgo) y los
    contadores por nivel para alimentar los 3 carriles de la bandeja.
    """
    universo = top_riesgo(limit=1_000_000, nivel="ROJO,AMARILLO,VERDE", ciudad=ciudad)
    items = universo.get("top", [])

    rojos = [c for c in items if c.get("nivel") == "ROJO"]
    amarillos = [c for c in items if c.get("nivel") == "AMARILLO"]
    verdes = [c for c in items if c.get("nivel") == "VERDE"]

    if nivel:
        wanted = {n.strip().upper() for n in nivel.split(",") if n.strip()}
        out = [c for c in items if c.get("nivel") in wanted][:limit]
    else:
        # Mix balanceado: 60% ROJO + 40% AMARILLO (ambos ordenados por score desc)
        n_rojo = max(1, int(limit * 0.60))
        n_amar = max(1, limit - n_rojo)
        out = rojos[:n_rojo] + amarillos[:n_amar]
        # Si falta de un lado, completar con el sobrante del otro
        if len(out) < limit:
            extra = rojos[n_rojo:] + amarillos[n_amar:]
            out = out + extra[: (limit - len(out))]
        out.sort(key=lambda x: -x.get("score", 0))

    return {
        "total_evaluados": universo.get("total_evaluados", 0),
        "ciudad": ciudad,
        "n_rojos_disponibles": len(rojos),
        "n_amarillos_disponibles": len(amarillos),
        "n_verdes_disponibles": len(verdes),
        "top": out,
        # Muestra de bajo riesgo (mayor score primero) para el carril "Riesgo bajo".
        "verdes": verdes[:limit],
    }


@app.get("/asegurados/buscar")
def buscar_asegurados_pre(q: str = Query("", min_length=0), limit: int = 20):
    """Busca asegurados por id, ciudad o segmento. q='' devuelve top por # reclamos.

    IMPORTANTE: este endpoint DEBE definirse antes de /asegurados/{id_asegurado}
    porque FastAPI matchea las rutas en orden y 'buscar' seria capturado como id.
    """
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW a AS SELECT * FROM '{(PROC / 'asegurados.parquet').as_posix()}'")
    where = ""
    if q:
        ql = q.replace("'", "''")
        where = f"WHERE id_asegurado ILIKE '%{ql}%' OR ciudad ILIKE '%{ql}%' OR segmento ILIKE '%{ql}%'"
    df = con.execute(f"""
        SELECT id_asegurado, segmento, ciudad, num_polizas,
               reclamos_ultimos_12_meses, score_cliente_simulado
        FROM a
        {where}
        ORDER BY reclamos_ultimos_12_meses DESC, num_polizas DESC
        LIMIT {limit}
    """).df()
    return {"items": df.to_dict("records"), "total": len(df)}


@app.get("/asegurados/{id_asegurado}")
def get_asegurado(id_asegurado: str):
    """Vista 360 de un asegurado: perfil + todos sus siniestros + proveedores recurrentes.

    TOLERANTE: si el id_asegurado NO esta en asegurados.parquet (por ejemplo,
    casos cargados manualmente que no actualizaron la tabla de asegurados),
    construimos un perfil minimo derivado de sus siniestros para que la UI no rompa.
    """
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW a AS SELECT * FROM '{(PROC / 'asegurados.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW v AS SELECT * FROM '{(PROC / 'vehiculos.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW p AS SELECT * FROM '{(PROC / 'proveedores.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW po AS SELECT * FROM '{(PROC / 'polizas.parquet').as_posix()}'")

    perfil_df = con.execute(f"SELECT * FROM a WHERE id_asegurado = '{id_asegurado}'").df()

    if perfil_df.empty:
        # Fallback: ¿hay siniestros con ese id? Si si, armamos un perfil derivado.
        sins_check = con.execute(
            f"SELECT COUNT(*) AS n, MAX(ciudad_evento) AS ciudad FROM s WHERE id_asegurado = '{id_asegurado}'"
        ).df()
        n_sins = int(sins_check.iloc[0]["n"])
        if n_sins == 0:
            raise HTTPException(
                404,
                f"Asegurado {id_asegurado} no existe ni tiene siniestros registrados. "
                "Puede ser un id sintetico de un caso hipotetico o un error de tipeo."
            )
        # Hay siniestros pero no perfil — construir uno minimo
        perfil = {
            "id_asegurado": id_asegurado,
            "segmento": None,
            "antiguedad_anios": None,
            "ciudad": str(sins_check.iloc[0]["ciudad"]) if sins_check.iloc[0]["ciudad"] else None,
            "num_polizas": 0,
            "reclamos_ultimos_12_meses": n_sins,
            "mora_actual": None,
            "score_cliente_simulado": None,
            "_perfil_derivado": True,  # flag para que el frontend sepa
        }
    else:
        perfil = perfil_df.iloc[0].to_dict()
        perfil["_perfil_derivado"] = False

    sins = con.execute(f"""
        SELECT s.id_siniestro, s.fecha_ocurrencia, s.cobertura, s.estado,
               s.monto_reclamado_usd, s.monto_pagado_usd, s.ciudad_evento,
               s.sucursal, s.id_proveedor, s.id_vehiculo, s.documentos_completos,
               s.dias_desde_inicio_poliza, s.dias_entre_ocurrencia_reporte,
               s.etiqueta_fraude_simulada, s.caso_inyectado,
               v.marca, v.modelo, v.anio_vehiculo,
               p.nombre AS prov_nombre, p.lista_restrictiva
        FROM s
        LEFT JOIN v ON v.id_vehiculo = s.id_vehiculo
        LEFT JOIN p ON p.id_proveedor = s.id_proveedor
        WHERE s.id_asegurado = '{id_asegurado}'
        ORDER BY s.fecha_ocurrencia DESC
    """).df()

    polizas = con.execute(f"""
        SELECT id_poliza, ramo, fecha_inicio, fecha_fin, prima_usd,
               suma_asegurada_usd, deducible_usd, canal_venta, estado_poliza
        FROM po WHERE id_asegurado = '{id_asegurado}'
        ORDER BY fecha_inicio DESC
    """).df()

    # Proveedores recurrentes para este asegurado
    prov_freq = sins.groupby("id_proveedor").agg(
        n_casos=("id_siniestro", "count"),
        monto_total=("monto_reclamado_usd", "sum"),
        prov_nombre=("prov_nombre", "first"),
        en_lista=("lista_restrictiva", "first"),
    ).reset_index().sort_values("n_casos", ascending=False)

    return {
        "perfil": {k: (v if not pd.isna(v) else None) for k, v in perfil.items()},
        "totales": {
            "n_siniestros": int(len(sins)),
            "monto_reclamado_total": float(sins["monto_reclamado_usd"].sum()) if len(sins) else 0,
            "monto_pagado_total": float(sins["monto_pagado_usd"].sum()) if len(sins) else 0,
            "n_polizas": int(len(polizas)),
            "n_fraudes_simulados": int(sins["etiqueta_fraude_simulada"].sum()) if len(sins) else 0,
            "n_inyectados": int(sins["caso_inyectado"].sum()) if len(sins) else 0,
            "n_proveedores_distintos": int(sins["id_proveedor"].nunique()) if len(sins) else 0,
        },
        "siniestros": sins.to_dict("records"),
        "polizas": polizas.to_dict("records"),
        "proveedores_frecuentes": prov_freq.head(10).to_dict("records"),
    }




@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """Pasa el mensaje al agente gpt-5-mini con function calling."""
    try:
        result = get_agent().chat(req.message, history=req.history)
        return ChatResponse(**result)
    except Exception as exc:
        log.exception("Error en /chat")
        raise HTTPException(500, f"{type(exc).__name__}: {exc}")


@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    """Streaming del agente: emite NDJSON (un evento JSON por linea).

    Eventos del stream (cada uno termina con '\\n'):
      {"type":"tool_call","tool":"top_riesgo","args":{...}}
      {"type":"tool_result","tool":"top_riesgo","summary":"..."}
      {"type":"delta","text":"chunk de texto"}
      {"type":"done","tokens":N,"tools_used":[...],"iterations":N}
      {"type":"error","message":"..."}
    """
    import json as _json
    from fastapi.responses import StreamingResponse

    def event_generator():
        try:
            for event in get_agent().chat_stream(req.message, history=req.history):
                yield _json.dumps(event, ensure_ascii=False, default=str) + "\n"
        except Exception as exc:
            log.exception("Error en /chat/stream")
            yield _json.dumps({"type": "error", "message": f"{type(exc).__name__}: {exc}"}) + "\n"

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


_REPORTE_EJECUTIVO_PROMPT = (
    "Sos el copiloto antifraude de Aseguradora del Sur. Escribi un resumen ejecutivo "
    "DE LA CARTERA para el comite antifraude, estilo briefing de 1 minuto.\n\n"
    "USA ESTAS HERRAMIENTAS para construir el resumen: top_riesgo, ranking_proveedores, "
    "ranking_ciudades, simulacion_ahorro.\n\n"
    "FORMATO OBLIGATORIO — usa exactamente estos titulos en negrita (NO tablas, NO codigo, NO pipes):\n\n"
    "## El pulso de la cartera\n"
    "Una oracion narrando el estado general (n total, tasa de fraude estimada, monto en juego).\n\n"
    "## Los 3 casos que recomendamos revisar primero\n"
    "Una lista con bullets, cada uno: **SIN-XXXXX** — explicacion en 1 linea de por que merece revision.\n\n"
    "## Los proveedores que estan acelerando\n"
    "Una lista con bullets, cada uno: **PRV-XXXX** *(nombre)* — explicacion del patron.\n\n"
    "## Donde mirar geograficamente\n"
    "Una lista corta de ciudades con mas concentracion (con su numero).\n\n"
    "## 3 acciones concretas para esta semana\n"
    "Bullets numerados con acciones operativas, no recomendaciones genericas.\n\n"
    "## Impacto economico estimado\n"
    "Una oracion con el monto USD que se puede recuperar/prevenir.\n\n"
    "REGLAS:\n"
    "- Lenguaje claro, conversacional, en espanol neutro.\n"
    "- NO uses tablas markdown con pipes (|). Usa listas con bullets.\n"
    "- Maximo 250 palabras totales. Tiene que leerse en 60 segundos.\n"
    "- Lenguaje no acusatorio: 'sospechoso', 'amerita revision', NO 'fraude confirmado'."
)


@app.get("/reportes/ejecutivo")
def reporte_ejecutivo():
    """Resumen ejecutivo generado por el agente.

    El prompt fuerza un formato compacto y legible (sin tablas markdown crudas),
    pensado para mostrarse en el panel de Reportes y exportarse como PDF.
    """
    result = get_agent().chat(_REPORTE_EJECUTIVO_PROMPT)
    return result


@app.post("/reportes/ejecutivo/stream")
def reporte_ejecutivo_stream():
    """Streaming NDJSON del resumen ejecutivo — efecto Jarvis "pensando en vivo".

    Emite los mismos eventos que /chat/stream: tool_call, tool_result, delta, done.
    El frontend (BriefingJarvis) renderiza la bitacora del condor en tiempo real.
    """
    import json as _json
    from fastapi.responses import StreamingResponse

    def event_generator():
        try:
            for event in get_agent().chat_stream(_REPORTE_EJECUTIVO_PROMPT):
                yield _json.dumps(event, ensure_ascii=False, default=str) + "\n"
        except Exception as exc:
            log.exception("Error en /reportes/ejecutivo/stream")
            yield _json.dumps({"type": "error", "message": f"{type(exc).__name__}: {exc}"}) + "\n"

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


@app.get("/simulacion-ahorro")
def get_simulacion_ahorro(
    tasa_deteccion_actual: float = 0.30,
    tasa_deteccion_achachai: float = 0.70,
):
    """Calcula ahorro potencial anual + ROI."""
    return simulacion_ahorro(
        tasa_deteccion_actual=tasa_deteccion_actual,
        tasa_deteccion_achachai=tasa_deteccion_achachai,
    )


@app.get("/exportar-reporte")
def get_exportar_reporte(nivel: str = "ROJO", limit: int = 50):
    """Genera reporte de auditoria como JSON (cliente lo puede convertir a CSV)."""
    return exportar_reporte(nivel=nivel, limit=limit)


# ===================== REPORTE PDF (HTML imprimible) =====================
REPORTES_LOG = PROC / "reportes_generados.parquet"


def _log_reporte(tipo: str, nivel: str, n_casos: int, analista: str = "ana.yanez"):
    """Persiste un registro de reporte generado para el historial."""
    row = {
        "id_reporte": f"RPT-{pd.Timestamp.now().strftime('%Y%m%d%H%M%S')}",
        "tipo": tipo,
        "nivel": nivel,
        "n_casos": int(n_casos),
        "analista": analista,
        "fecha_generacion": pd.Timestamp.now().isoformat(),
    }
    new = pd.DataFrame([row])
    if REPORTES_LOG.exists():
        try:
            prev = pd.read_parquet(REPORTES_LOG)
            out = pd.concat([prev, new], ignore_index=True)
        except Exception:
            out = new
    else:
        out = new
    out.to_parquet(REPORTES_LOG, index=False)
    return row


@app.get("/reportes/recientes")
def get_reportes_recientes(limit: int = 20):
    """Historial de reportes generados (de la persistencia local)."""
    if not REPORTES_LOG.exists():
        return {"items": [], "total": 0}
    df = pd.read_parquet(REPORTES_LOG).sort_values("fecha_generacion", ascending=False).head(limit)
    return {"items": df.to_dict("records"), "total": int(len(df))}


@app.get("/reportes/pdf")
def reporte_pdf(
    tipo: str = Query("ejecutivo", regex="^(ejecutivo|antifraude|auditoria|directorio)$"),
    nivel: str = Query("ROJO", regex="^(VERDE|AMARILLO|ROJO)$"),
    limit: int = 20,
    analista: str = "ana.yanez",
):
    """Devuelve HTML BIEN estilizado y listo para imprimir (Ctrl+P -> Guardar como PDF).

    Soporta varios tipos:
      - ejecutivo:   resumen estilo briefing 1 página
      - antifraude:  reporte para el comité (casos + recomendaciones)
      - auditoria:   tabla completa con hash de firma
      - directorio:  KPIs visuales para gerencia
    """
    from fastapi.responses import HTMLResponse

    # Datos reales
    kpis = get_kpis()
    rep = exportar_reporte(nivel=nivel, limit=limit)
    casos = rep.get("casos", [])
    total_sin = kpis.get("totales", {}).get("siniestros", 0)

    # Intento de síntesis ejecutiva con GPT (no bloqueante)
    sintesis_gpt = ""
    if tipo == "ejecutivo":
        try:
            agent = get_agent()
            r = agent.chat(
                f"Genera un resumen ejecutivo de 4 bullets para el comite antifraude. "
                f"Hay {len(casos)} casos nivel {nivel} de un total de {total_sin}. "
                f"Lenguaje claro, no acusatorio."
            )
            sintesis_gpt = r.get("response", "")[:1500]
        except Exception as e:
            log.warning("GPT sintesis fallo: %s", e)
            sintesis_gpt = "Síntesis no disponible (modelo offline)."

    # Persistir el log del reporte
    log_row = _log_reporte(tipo=tipo, nivel=nivel, n_casos=len(casos), analista=analista)

    # Generar el HTML estilizado
    fecha = pd.Timestamp.now().strftime("%d de %B de %Y · %H:%M")
    titulos_tipo = {
        "ejecutivo":   "Resumen Ejecutivo",
        "antifraude":  "Reporte Comité Antifraude",
        "auditoria":   "Reporte Auditoría Interna",
        "directorio":  "Briefing al Directorio",
    }
    titulo = titulos_tipo.get(tipo, "Reporte")

    color_nivel = {"ROJO": "#C5333A", "AMARILLO": "#E87A4F", "VERDE": "#4A7C59"}[nivel]

    # Filas casos
    casos_html = ""
    for c in casos[:limit]:
        reglas = (c.get("reglas_disparadas") or [])
        reglas_chips = "".join(
            f'<span class="chip chip-red">{r}</span>' for r in reglas[:3]
        )
        casos_html += f"""
        <tr>
          <td class="mono case-id">{c.get('id_siniestro','')}</td>
          <td><div class="score-circle" style="background:{color_nivel}">{c.get('score','-')}</div></td>
          <td class="tabular">${float(c.get('monto_reclamado_usd',0)):,.0f}</td>
          <td>{c.get('ciudad','-')}</td>
          <td>{c.get('cobertura','-')}</td>
          <td>{reglas_chips}</td>
        </tr>
        """

    # Síntesis GPT como HTML escapado (mantener saltos de línea)
    from html import escape as _esc
    sintesis_html = _esc(sintesis_gpt).replace("\n", "<br/>") if sintesis_gpt else ""

    monto_total = kpis.get("totales", {}).get("monto_reclamado_total_usd", 0)
    n_fraudes = kpis.get("totales", {}).get("fraudes_simulados", 0)
    docs_inc = kpis.get("totales", {}).get("documentos_inconsistentes", 0)

    html = f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>{titulo} · AchachAI · {log_row['id_reporte']}</title>
  <style>
    @page {{ size: A4; margin: 16mm; }}
    * {{ box-sizing: border-box; }}
    body {{
      font-family: 'Inter', -apple-system, system-ui, sans-serif;
      color: #1A3A52;
      background: #F4EDE4;
      margin: 0; padding: 24px;
      line-height: 1.55;
    }}
    .page {{
      max-width: 900px; margin: 0 auto;
      background: white;
      box-shadow: 0 10px 30px rgba(26,58,82,0.08);
      border-radius: 8px;
      overflow: hidden;
    }}
    .hero {{
      padding: 36px 44px 28px;
      background: linear-gradient(135deg, #F4EDE4 0%, #FAF6EE 100%);
      border-bottom: 1px solid #E8E0D2;
      position: relative;
    }}
    .hero::before {{
      content: "🦅";
      position: absolute; right: 36px; top: 32px;
      font-size: 64px; opacity: 0.10;
    }}
    .brand-eyebrow {{
      font-size: 11px; letter-spacing: .22em; text-transform: uppercase;
      color: #E87A4F; font-weight: 700;
    }}
    h1 {{
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-weight: 500; font-size: 38px;
      margin: 6px 0 4px; color: #1A3A52;
    }}
    .meta {{
      font-size: 12px; color: #6C7A89;
      display: flex; gap: 14px; flex-wrap: wrap;
      margin-top: 8px;
    }}
    .meta .pill {{
      background: white; padding: 4px 10px; border-radius: 12px;
      border: 1px solid #E8E0D2;
    }}
    .kpis {{
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 14px; padding: 24px 44px;
      border-bottom: 1px solid #E8E0D2;
    }}
    .kpi {{
      background: #FAF6EE; padding: 14px 16px; border-radius: 8px;
      border-top: 3px solid #E87A4F;
    }}
    .kpi-label {{
      font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
      color: #6C7A89; font-weight: 600;
    }}
    .kpi-value {{
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 30px; font-weight: 500; color: #1A3A52;
      margin-top: 4px; line-height: 1;
    }}
    .kpi-sub {{ font-size: 10.5px; color: #6C7A89; margin-top: 4px; }}
    .section {{ padding: 26px 44px; border-bottom: 1px solid #F4EDE4; }}
    .section-title {{
      font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
      color: #E87A4F; font-weight: 700; margin-bottom: 12px;
    }}
    .sintesis {{
      background: linear-gradient(135deg, rgba(232,122,79,0.05), white);
      padding: 18px 22px; border-radius: 10px;
      border-left: 3px solid #E87A4F;
      font-size: 13.5px; color: #1A3A52;
    }}
    table {{
      width: 100%; border-collapse: collapse;
      font-size: 12.5px;
    }}
    thead tr {{ background: #FAF6EE; }}
    th {{
      padding: 10px 8px; text-align: left;
      font-size: 10px; letter-spacing: .1em; text-transform: uppercase;
      color: #6C7A89; font-weight: 600;
      border-bottom: 1px solid #E8E0D2;
    }}
    td {{
      padding: 10px 8px; border-bottom: 1px solid #F4EDE4;
      vertical-align: middle;
    }}
    .mono {{ font-family: 'JetBrains Mono', 'Courier New', monospace; }}
    .tabular {{ font-variant-numeric: tabular-nums; }}
    .case-id {{ color: #2C5F8D; font-weight: 600; }}
    .score-circle {{
      width: 36px; height: 36px; border-radius: 50%;
      color: white; display: inline-flex; align-items: center;
      justify-content: center; font-weight: 700; font-size: 12px;
    }}
    .chip {{
      display: inline-block; padding: 2px 8px;
      border-radius: 10px; font-size: 9.5px; font-weight: 600;
      margin-right: 3px;
    }}
    .chip-red {{ background: rgba(197,51,58,0.10); color: #C5333A; }}
    .footer {{
      padding: 22px 44px;
      background: #FAF6EE;
      font-size: 11px; color: #6C7A89;
      display: flex; justify-content: space-between; align-items: center;
    }}
    .firma {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; color: #4A7C59;
    }}
    .disclaimer {{
      padding: 14px 44px; font-size: 11px; color: #6C7A89;
      background: rgba(74,124,89,0.05);
      border-top: 1px solid #E8E0D2;
      border-left: 3px solid #4A7C59;
    }}
    .print-btn {{
      position: fixed; bottom: 28px; right: 28px;
      background: linear-gradient(135deg, #E87A4F, #C5333A);
      color: white; padding: 12px 20px; border-radius: 10px;
      border: 0; cursor: pointer; font-weight: 600;
      box-shadow: 0 6px 20px rgba(232,122,79,0.35);
      font-size: 14px;
    }}
    @media print {{
      body {{ background: white; padding: 0; }}
      .page {{ box-shadow: none; border-radius: 0; }}
      .print-btn {{ display: none; }}
    }}
  </style>
</head>
<body>
  <div class="page">
    <div class="hero">
      <div class="brand-eyebrow">AchachAI · Ojos de cóndor sobre tu cartera</div>
      <h1>{titulo}</h1>
      <div class="meta">
        <span class="pill">📅 {fecha}</span>
        <span class="pill">🆔 {log_row['id_reporte']}</span>
        <span class="pill">👤 {analista}</span>
        <span class="pill" style="background:{color_nivel};color:white;border:0;">⬤ {nivel}</span>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi">
        <div class="kpi-label">Cartera vigilada</div>
        <div class="kpi-value">{total_sin:,}</div>
        <div class="kpi-sub">siniestros activos</div>
      </div>
      <div class="kpi" style="border-top-color:{color_nivel}">
        <div class="kpi-label">Casos {nivel}</div>
        <div class="kpi-value" style="color:{color_nivel}">{len(casos)}</div>
        <div class="kpi-sub">de mayor riesgo</div>
      </div>
      <div class="kpi" style="border-top-color:#4A7C59">
        <div class="kpi-label">Monto total cartera</div>
        <div class="kpi-value">${monto_total/1000:,.0f}K</div>
        <div class="kpi-sub">USD reclamados</div>
      </div>
      <div class="kpi" style="border-top-color:#D4A574">
        <div class="kpi-label">Docs inconsistentes</div>
        <div class="kpi-value">{docs_inc:,}</div>
        <div class="kpi-sub">requieren revisión</div>
      </div>
    </div>

    {f'''
    <div class="section">
      <div class="section-title">🦅 Síntesis del cóndor (GPT-5-mini)</div>
      <div class="sintesis">{sintesis_html}</div>
    </div>
    ''' if sintesis_html else ''}

    <div class="section">
      <div class="section-title">Top casos {nivel}</div>
      <table>
        <thead>
          <tr>
            <th>Caso</th><th>Score</th><th>Monto USD</th>
            <th>Ciudad</th><th>Cobertura</th><th>Reglas activadas</th>
          </tr>
        </thead>
        <tbody>{casos_html or '<tr><td colspan="6" style="text-align:center;padding:24px;color:#6C7A89;">Sin casos en este nivel.</td></tr>'}</tbody>
      </table>
    </div>

    <div class="disclaimer">
      ⚖️ <strong>Importante:</strong> Este reporte contiene <strong>alertas sugeridas</strong> generadas por
      un sistema híbrido (reglas RF-01..07 + 14 señales ponderadas + XGBoost AUC 0.96 +
      IsolationForest no supervisado). No constituye acusación de fraude. La decisión final
      sobre cada caso es responsabilidad del analista humano.
    </div>

    <div class="footer">
      <div>
        <strong>AchachAI v4.2.1</strong> · Modelo entrenado sobre 25.460 siniestros<br/>
        Datos sintéticos · cumple sección 17 del PDF reto (no datos personales reales)
      </div>
      <div class="firma">
        ✓ Firmado digitalmente<br/>
        hash: {abs(hash(log_row['id_reporte'])):x}
      </div>
    </div>
  </div>

  <button class="print-btn" onclick="window.print()">⬇ Guardar como PDF</button>

  <script>
    // Auto-disparo del diálogo de impresión 600ms después de cargar
    // (el usuario puede elegir "Guardar como PDF" o "Imprimir")
    if (location.search.includes('autoprint=1')) {{
      setTimeout(() => window.print(), 600);
    }}
  </script>
</body>
</html>"""
    return HTMLResponse(content=html)


@app.get("/exportar-reporte.csv")
def get_exportar_reporte_csv(nivel: str = "ROJO", limit: int = 100):
    """Genera el reporte directamente como CSV descargable."""
    import io, csv
    from fastapi.responses import StreamingResponse
    r = exportar_reporte(nivel=nivel, limit=limit)
    out = io.StringIO()
    if r["casos"]:
        w = csv.DictWriter(out, fieldnames=r["casos"][0].keys())
        w.writeheader()
        w.writerows(r["casos"])
    out.seek(0)
    return StreamingResponse(
        iter([out.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=reporte_auditoria_{nivel}_{pd.Timestamp.now().strftime('%Y%m%d_%H%M')}.csv"},
    )


@app.get("/red-relaciones")
def get_red_relaciones(
    min_siniestros: int = Query(5, description="Umbral minimo de siniestros para PROVEEDORES"),
    min_aseg: int | None = Query(None, description="Umbral minimo para ASEGURADOS (si None, se calcula auto)"),
    min_par: int = Query(2, description="Minimo de siniestros compartidos para dibujar un edge"),
):
    """Grafo bipartito asegurado <-> proveedor para Red de relaciones.

    Importante: los proveedores normalmente tienen MUCHOS siniestros (taller que ve
    cientos de autos) pero los asegurados muy pocos (1-3 en promedio). Por eso usamos
    umbrales separados. Si el usuario pone min_siniestros=20, eso aplica a proveedores;
    para asegurados se baja automaticamente al p90 de su distribucion para no vaciar el grafo.
    """
    import duckdb
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW p AS SELECT * FROM '{(PROC / 'proveedores.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW a AS SELECT * FROM '{(PROC / 'asegurados.parquet').as_posix()}'")

    # === Proveedores TOP por # siniestros ===
    prov_top = con.execute(f"""
        SELECT p.id_proveedor, p.nombre, p.tipo, p.lista_restrictiva,
               COUNT(s.id_siniestro) AS n_siniestros
        FROM p
        LEFT JOIN s ON s.id_proveedor = p.id_proveedor
        GROUP BY ALL
        HAVING COUNT(s.id_siniestro) >= {min_siniestros}
        ORDER BY n_siniestros DESC LIMIT 30
    """).df()

    # === Asegurados: umbral propio ===
    # Si el usuario no lo dio, derivamos uno razonable:
    #   - nunca > 5 (asegurados con 5+ siniestros ya son recurrentes)
    #   - nunca < 2 (1 siniestro no genera relacion interesante)
    #   - escala suave con el min_siniestros del proveedor para mantener simetria
    if min_aseg is None:
        min_aseg = max(2, min(5, min_siniestros // 5))

    ase_top = con.execute(f"""
        SELECT a.id_asegurado, a.segmento, a.ciudad,
               COUNT(s.id_siniestro) AS n_siniestros
        FROM a
        JOIN s ON s.id_asegurado = a.id_asegurado
        GROUP BY ALL
        HAVING COUNT(s.id_siniestro) >= {min_aseg}
        ORDER BY n_siniestros DESC LIMIT 40
    """).df()

    # Fallback: si igual vino vacio, bajamos el umbral
    if ase_top.empty and min_aseg > 2:
        ase_top = con.execute(f"""
            SELECT a.id_asegurado, a.segmento, a.ciudad,
                   COUNT(s.id_siniestro) AS n_siniestros
            FROM a JOIN s ON s.id_asegurado = a.id_asegurado
            GROUP BY ALL HAVING COUNT(s.id_siniestro) >= 2
            ORDER BY n_siniestros DESC LIMIT 40
        """).df()
        min_aseg = 2

    # === Aristas: pares (asegurado, proveedor) que comparten >= min_par siniestros ===
    if ase_top.empty or prov_top.empty:
        pares = pd.DataFrame(columns=["id_asegurado", "id_proveedor", "n"])
    else:
        pares = con.execute(f"""
            SELECT s.id_asegurado, s.id_proveedor, COUNT(*) AS n
            FROM s
            WHERE s.id_asegurado IN ({','.join("'" + i + "'" for i in ase_top.id_asegurado)})
              AND s.id_proveedor IN ({','.join("'" + i + "'" for i in prov_top.id_proveedor)})
            GROUP BY ALL
            HAVING n >= {min_par}
            ORDER BY n DESC LIMIT 300
        """).df()

    # Si aun asi no hay edges, relajamos a >= 1 (cualquier conexion)
    if pares.empty and not ase_top.empty and not prov_top.empty:
        pares = con.execute(f"""
            SELECT s.id_asegurado, s.id_proveedor, COUNT(*) AS n
            FROM s
            WHERE s.id_asegurado IN ({','.join("'" + i + "'" for i in ase_top.id_asegurado)})
              AND s.id_proveedor IN ({','.join("'" + i + "'" for i in prov_top.id_proveedor)})
            GROUP BY ALL
            ORDER BY n DESC LIMIT 300
        """).df()

    # Total de asegurados DISTINTOS por proveedor (sin filtro) — para que el card
    # no diga "0 asegurados" cuando en realidad tiene cientos no-recurrentes.
    prov_aseg_total = con.execute(f"""
        SELECT id_proveedor, COUNT(DISTINCT id_asegurado) AS n_aseg_distinct
        FROM s
        WHERE id_proveedor IN ({','.join("'" + i + "'" for i in prov_top.id_proveedor)})
        GROUP BY id_proveedor
    """).df().set_index("id_proveedor") if not prov_top.empty else pd.DataFrame()

    nodes = []
    for _, p in prov_top.iterrows():
        pid = p["id_proveedor"]
        n_aseg_total = int(prov_aseg_total.loc[pid, "n_aseg_distinct"]) if pid in prov_aseg_total.index else 0
        nodes.append({
            "id": pid, "label": (p["nombre"] or "")[:25],
            "type": "proveedor", "n": int(p["n_siniestros"]),
            "n_asegurados_total": n_aseg_total,
            "restrictiva": bool(p["lista_restrictiva"]),
        })
    for _, ai in ase_top.iterrows():
        nodes.append({"id": ai["id_asegurado"], "label": ai["id_asegurado"],
                       "type": "asegurado", "n": int(ai["n_siniestros"]),
                       "ciudad": ai.get("ciudad")})
    edges = [{"source": r["id_asegurado"], "target": r["id_proveedor"], "weight": int(r["n"])}
             for _, r in pares.iterrows()]
    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "n_nodes": len(nodes),
            "n_edges": len(edges),
            "n_proveedores": int(len(prov_top)),
            "n_asegurados": int(len(ase_top)),
            "min_prov_aplicado": int(min_siniestros),
            "min_aseg_aplicado": int(min_aseg),
            "min_par_aplicado": int(min_par if not pares.empty else 1),
        },
    }


DOCS_LOG_PATH = PROC / "documentos_analizados.parquet"


def _persistir_documento_analizado(row: dict) -> None:
    """Append row a parquet de documentos analizados (uno por upload)."""
    new = pd.DataFrame([row])
    if DOCS_LOG_PATH.exists():
        try:
            prev = pd.read_parquet(DOCS_LOG_PATH)
            out = pd.concat([prev, new], ignore_index=True)
        except Exception:
            out = new
    else:
        out = new
    out.to_parquet(DOCS_LOG_PATH, index=False)


@app.post("/analyze-document")
async def analyze_document(
    file: UploadFile = File(...),
    tipo: str = Form("factura"),
    fecha_ocurrencia: str | None = Form(None),
    descripcion_siniestro: str | None = Form(None),
    id_siniestro: str | None = Form(None),   # NUEVO: vinculacion explicita
    analista_id: str | None = Form("ana.yanez"),
):
    """Analiza un documento (factura/imagen/parte) con Azure DI + GPT-4o Vision.

    Body multipart:
      - file: el archivo (.pdf, .jpg, .png)
      - tipo: 'factura' | 'imagen_dano' | 'parte_policial' | 'denuncia' | 'documento'
      - fecha_ocurrencia: ISO date (para validar facturas vs evento)
      - descripcion_siniestro: relato del asegurado (para cruzar con imagen)
      - id_siniestro: opcional. Si se pasa, persiste la vinculacion documento-siniestro
                      para que despues aparezca en el expediente.
      - analista_id: quien subio el doc (auditoria).

    Devuelve DocumentAnalysisResult con score, inconsistencias y explicacion.
    Persiste un registro en data/processed/documentos_analizados.parquet cuando hay id_siniestro.
    """
    file_bytes = await file.read()
    # Si nos dieron id_siniestro pero NO los otros campos, los enriquecemos consultando el caso
    if id_siniestro and (not fecha_ocurrencia or not descripcion_siniestro):
        try:
            d = detalle_siniestro(id_siniestro)
            if "siniestro" in d and not fecha_ocurrencia:
                fecha_ocurrencia = str(d["siniestro"].get("fecha_ocurrencia"))[:10]
            if not descripcion_siniestro:
                descripcion_siniestro = d.get("descripcion") or descripcion_siniestro
        except Exception as e:
            log.warning("No pude enriquecer contexto del siniestro %s: %s", id_siniestro, e)

    try:
        if tipo == "factura":
            result = analyze_factura(file_bytes, fecha_ocurrencia=fecha_ocurrencia)
        elif tipo == "imagen_dano":
            if not descripcion_siniestro:
                # Default suave en lugar de 400 cuando el usuario no vincula caso
                descripcion_siniestro = "Daño en vehiculo"
            result = analyze_imagen_dano(file_bytes, descripcion_siniestro)
        else:
            result = analyze_documento_generico(
                file_bytes, tipo=tipo,
                contexto_siniestro={"fecha_ocurrencia": fecha_ocurrencia,
                                    "descripcion": descripcion_siniestro}
                if fecha_ocurrencia or descripcion_siniestro else None,
            )
        result_d = result.to_dict()

        # Persistencia: si hay id_siniestro, guardamos la vinculacion
        if id_siniestro:
            try:
                row = {
                    "id_documento": f"DOC-{pd.Timestamp.now().strftime('%Y%m%d%H%M%S')}-{file.filename or 'sin-nombre'}",
                    "id_siniestro": id_siniestro,
                    "tipo": tipo,
                    "nombre_archivo": file.filename or "sin-nombre",
                    "fecha_subida": pd.Timestamp.now().isoformat(),
                    "analista_id": analista_id or "anonimo",
                    "score_doc": int(result_d.get("score_doc", 0) or 0),
                    "nivel_riesgo_doc": result_d.get("nivel_riesgo_doc"),
                    "n_inconsistencias": len(result_d.get("inconsistencias", []) or []),
                    "explicacion": (result_d.get("explicacion") or "")[:500],
                }
                _persistir_documento_analizado(row)
                result_d["_persistido"] = True
                result_d["_id_documento"] = row["id_documento"]
                result_d["_id_siniestro"] = id_siniestro
            except Exception as e:
                log.warning("No pude persistir el documento analizado: %s", e)
                result_d["_persistido"] = False

        return result_d
    except Exception as exc:
        log.exception("Error en /analyze-document")
        raise HTTPException(500, f"{type(exc).__name__}: {exc}")


@app.get("/casos/{id_siniestro}/documentos")
def documentos_del_caso(id_siniestro: str):
    """Devuelve los documentos analizados vinculados a un siniestro."""
    if not DOCS_LOG_PATH.exists():
        return {"id_siniestro": id_siniestro, "documentos": [], "total": 0}
    try:
        df = pd.read_parquet(DOCS_LOG_PATH)
        sub = df[df["id_siniestro"] == id_siniestro].sort_values("fecha_subida", ascending=False)
        return {
            "id_siniestro": id_siniestro,
            "documentos": sub.to_dict("records"),
            "total": int(len(sub)),
        }
    except Exception as e:
        raise HTTPException(500, f"Error leyendo documentos: {e}")


@app.get("/documentos/recientes")
def documentos_recientes(limit: int = 20):
    """Ultimos N documentos analizados (todos los siniestros)."""
    if not DOCS_LOG_PATH.exists():
        return {"items": [], "total": 0}
    df = pd.read_parquet(DOCS_LOG_PATH).sort_values("fecha_subida", ascending=False).head(limit)
    return {"items": df.to_dict("records"), "total": int(len(df))}


# ===================== SUCURSALES =====================
@app.get("/sucursales/ranking")
def get_sucursales_ranking(top_n: int = 20):
    """Ranking de sucursales por # de siniestros, fraudes simulados y monto."""
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
    df = con.execute(f"""
        SELECT sucursal,
               COUNT(*) AS n_siniestros,
               SUM(CASE WHEN etiqueta_fraude_simulada = 1 THEN 1 ELSE 0 END) AS n_fraudes_sim,
               ROUND(AVG(monto_reclamado_usd), 0) AS monto_promedio,
               ROUND(SUM(monto_reclamado_usd), 0) AS monto_total,
               SUM(CASE WHEN caso_inyectado = true THEN 1 ELSE 0 END) AS n_inyectados
        FROM s
        WHERE sucursal IS NOT NULL
        GROUP BY sucursal
        ORDER BY n_siniestros DESC
        LIMIT {top_n}
    """).df()
    df["tasa_fraude_sim"] = (df["n_fraudes_sim"] / df["n_siniestros"]).round(4)
    return {"top": df.to_dict("records")}


# ===================== ANALISTAS (SIMULACION) =====================
# Asignamos cada siniestro a uno de N analistas por hash determinista del id.
ANALISTAS = [
    {"id": "ana.yanez",     "nombre": "María Yánez",   "sucursal_base": "Quito"},
    {"id": "diego.cevallos","nombre": "Diego Cevallos","sucursal_base": "Quito"},
    {"id": "ana.toral",     "nombre": "Ana Toral",     "sucursal_base": "Cumbayá"},
    {"id": "luis.velez",    "nombre": "Luis Vélez",    "sucursal_base": "Guayaquil"},
    {"id": "sofia.borja",   "nombre": "Sofía Borja",   "sucursal_base": "Cuenca"},
]

def _analista_para_siniestro(id_siniestro: str) -> str:
    """Hash determinista del id_siniestro -> id de analista."""
    h = 0
    for c in str(id_siniestro):
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return ANALISTAS[h % len(ANALISTAS)]["id"]


@app.get("/analistas/carga")
def get_analistas_carga():
    """Distribucion simulada de carga por analista (hash determinista)."""
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
    df = con.execute("""
        SELECT id_siniestro, monto_reclamado_usd, etiqueta_fraude_simulada, sucursal
        FROM s
    """).df()
    df["analista"] = df["id_siniestro"].apply(_analista_para_siniestro)
    out = []
    for ana in ANALISTAS:
        sub = df[df["analista"] == ana["id"]]
        out.append({
            "id": ana["id"],
            "nombre": ana["nombre"],
            "sucursal_base": ana["sucursal_base"],
            "n_casos": int(len(sub)),
            "n_pendientes_estim": int(len(sub) * 0.18),
            "monto_total_usd": float(sub["monto_reclamado_usd"].sum()),
            "n_fraudes_sim": int(sub["etiqueta_fraude_simulada"].sum()),
        })
    return {"analistas": sorted(out, key=lambda x: -x["n_casos"])}


# ===================== EVALUAR NUEVO SINIESTRO (PRUEBA DE FUEGO) =====================
class EvaluarReq(BaseModel):
    cobertura: str = "Choque"             # Choque | Robo | RC | DM total | DM parcial
    monto_reclamado_usd: float = 5000.0
    monto_pagado_usd: float = 0.0
    suma_asegurada_usd: float = 15000.0
    dias_desde_inicio_poliza: int = 60
    dias_desde_fin_poliza: int = 305
    dias_entre_ocurrencia_reporte: int = 1
    historial_siniestros_asegurado: int = 0
    documentos_completos: bool = True
    tuvo_parte_policial: bool = True
    tuvo_testigo: bool = False
    fault_responsable: bool = True
    estado: str = "Reserva"
    ciudad_evento: str = "Quito"
    sucursal: str = "Quito"
    proveedor_en_lista_restrictiva: bool = False
    proveedor_tipo: str = "Taller"
    descripcion: str = "Colision lateral en interseccion."


@app.post("/evaluar-completo")
async def evaluar_completo(
    # Datos del siniestro (mismos que EvaluarReq, pero como Form para multipart)
    cobertura: str = Form("Choque"),
    monto_reclamado_usd: float = Form(5000.0),
    monto_pagado_usd: float = Form(0.0),
    suma_asegurada_usd: float = Form(15000.0),
    dias_desde_inicio_poliza: int = Form(60),
    dias_desde_fin_poliza: int = Form(305),
    dias_entre_ocurrencia_reporte: int = Form(1),
    historial_siniestros_asegurado: int = Form(0),
    documentos_completos: bool = Form(True),
    tuvo_parte_policial: bool = Form(True),
    tuvo_testigo: bool = Form(False),
    fault_responsable: bool = Form(True),
    estado: str = Form("Reserva"),
    ciudad_evento: str = Form("Quito"),
    sucursal: str = Form("Quito"),
    proveedor_en_lista_restrictiva: bool = Form(False),
    proveedor_tipo: str = Form("Taller"),
    descripcion: str = Form("Colision lateral en interseccion."),
    # Documentos opcionales
    factura: UploadFile | None = File(None),
    foto_dano: UploadFile | None = File(None),
    parte_policial_file: UploadFile | None = File(None),
    denuncia_file: UploadFile | None = File(None),
    declaracion_accidente_file: UploadFile | None = File(None),
):
    """Evaluacion INTEGRAL: combina datos del siniestro + analisis de documentos + foto.

    Flujo:
      1) Corre evaluate_siniestro sobre los datos tabulares (reglas + senales)
      2) Por cada documento subido, lo analiza con Azure DI / GPT-4o Vision
      3) Calcula un score combinado y un veredicto unificado
      4) Lista TODAS las alertas (tabulares + documentales) en un solo informe

    Pensado para la prueba de fuego del jurado:
      "subi este caso + factura + foto y dime que hacer"
    """
    # ===== 1) Evaluacion tabular =====
    req = EvaluarReq(
        cobertura=cobertura, monto_reclamado_usd=monto_reclamado_usd,
        monto_pagado_usd=monto_pagado_usd, suma_asegurada_usd=suma_asegurada_usd,
        dias_desde_inicio_poliza=dias_desde_inicio_poliza,
        dias_desde_fin_poliza=dias_desde_fin_poliza,
        dias_entre_ocurrencia_reporte=dias_entre_ocurrencia_reporte,
        historial_siniestros_asegurado=historial_siniestros_asegurado,
        documentos_completos=documentos_completos,
        tuvo_parte_policial=tuvo_parte_policial, tuvo_testigo=tuvo_testigo,
        fault_responsable=fault_responsable, estado=estado,
        ciudad_evento=ciudad_evento, sucursal=sucursal,
        proveedor_en_lista_restrictiva=proveedor_en_lista_restrictiva,
        proveedor_tipo=proveedor_tipo, descripcion=descripcion,
    )
    eval_tabular = evaluar_siniestro_nuevo(req)

    # ===== 2) Analisis de documentos =====
    docs_analizados: list[dict] = []
    fecha_hoy = pd.Timestamp.now().strftime("%Y-%m-%d")

    def _run_analyzer(file_bytes: bytes, tipo: str, ctx: dict) -> Any:
        if tipo == "factura":
            return analyze_factura(file_bytes, fecha_ocurrencia=fecha_hoy)
        if tipo == "imagen_dano":
            return analyze_imagen_dano(file_bytes, descripcion)
        if tipo == "parte_policial":
            return analyze_parte_policial(file_bytes, contexto_siniestro=ctx)
        if tipo == "declaracion_accidente":
            return analyze_declaracion_accidente(file_bytes, contexto_siniestro=ctx)
        return analyze_documento_generico(file_bytes, tipo=tipo, contexto_siniestro=ctx)

    async def _safe_analyze(name: str, file: UploadFile | None, tipo: str):
        if not file or not file.filename:
            return None
        filename = file.filename
        try:
            file_bytes = await file.read()
            ctx = {"fecha_ocurrencia": fecha_hoy, "descripcion": descripcion,
                   "ciudad_evento": ciudad_evento, "sucursal": sucursal}

            # Análisis principal + forensia visual corren en paralelo (cada uno en thread
            # porque los SDKs de Azure son síncronos bloqueantes).
            is_pdf = tipo != "imagen_dano" and (filename or "").lower().endswith(".pdf")
            analysis_task = asyncio.to_thread(_run_analyzer, file_bytes, tipo, ctx)
            if is_pdf:
                forensia_task = asyncio.to_thread(analyze_visual_forensics, file_bytes, tipo)
                r, forensia_result = await asyncio.gather(
                    analysis_task, forensia_task, return_exceptions=True,
                )
            else:
                r = await analysis_task
                forensia_result = None

            if isinstance(r, Exception):
                raise r

            d = r.to_dict()
            d["_etiqueta"] = name
            d["_nombre_archivo"] = filename

            # ===== Forensia visual SOLO para PDFs (no para imagenes de daño que ya van por vision) =====
            if is_pdf:
                if isinstance(forensia_result, Exception):
                    log.warning("forensia visual %s fallo: %s", name, forensia_result)
                elif forensia_result is not None:
                    try:
                        f = forensia_result.to_dict()
                        visual_incs = f.get("inconsistencias") or []
                        if visual_incs:
                            # Mergear inconsistencias visuales al doc principal
                            for inc in visual_incs:
                                inc["origen"] = "forensia_visual"
                            d["inconsistencias"] = list(d.get("inconsistencias") or []) + visual_incs
                            # Subir score si la forensia detecto algo importante
                            d["score_doc"] = max(int(d.get("score_doc") or 0), int(f.get("score_doc") or 0))
                            # Si la forensia es ROJO, el doc completo es ROJO
                            if f.get("nivel_riesgo_doc") == "ROJO":
                                d["nivel_riesgo_doc"] = "ROJO"
                            # Anotar las observaciones visuales para el informe
                            d.setdefault("forensia_visual", {})
                            d["forensia_visual"]["documento_parece_autentico"] = f.get("extracted_fields", {}).get("documento_parece_autentico")
                            d["forensia_visual"]["observaciones"] = f.get("extracted_fields", {}).get("observaciones_visuales", [])
                            d["forensia_visual"]["score"] = f.get("score_doc")
                            d["forensia_visual"]["nivel"] = f.get("nivel_riesgo_doc")
                            d["forensia_visual"]["explicacion"] = f.get("explicacion", "")
                    except Exception as ef:
                        log.warning("forensia visual %s post-proceso fallo: %s", name, ef)

            return d
        except Exception as e:
            log.warning("analisis %s fallo: %s", name, e)
            return {
                "_etiqueta": name,
                "_nombre_archivo": filename,
                "error": f"{type(e).__name__}: {e}",
                "score_doc": 0,
                "nivel_riesgo_doc": "VERDE",
                "inconsistencias": [],
                "explicacion": "No se pudo analizar el documento.",
            }

    # Los 5 documentos se analizan en paralelo (antes era secuencial → 60-100s,
    # ahora ~max de los docs ≈ 15-25s).
    _results = await asyncio.gather(
        _safe_analyze("Factura del taller", factura, "factura"),
        _safe_analyze("Foto del dano", foto_dano, "imagen_dano"),
        _safe_analyze("Parte policial", parte_policial_file, "parte_policial"),
        _safe_analyze("Denuncia", denuncia_file, "denuncia"),
        _safe_analyze("Declaracion de accidente", declaracion_accidente_file, "declaracion_accidente"),
    )
    docs_analizados = [d for d in _results if d is not None]

    # ===== 3) Score combinado — PONDERADO POR SEVERIDAD =====
    score_tabular = int(eval_tabular.get("score", 0))
    doc_scores = [int(d.get("score_doc", 0) or 0) for d in docs_analizados]
    score_doc_max = max(doc_scores, default=0)
    score_doc_prom = int(sum(doc_scores) / len(doc_scores)) if doc_scores else 0

    # Contar inconsistencias por severidad
    n_alta = n_media = n_baja = 0
    inconsist_alta_evidencias = []
    for d in docs_analizados:
        for inc in (d.get("inconsistencias") or []):
            sev = (inc.get("severidad") or "").upper()
            if sev == "ALTA":
                n_alta += 1
                inconsist_alta_evidencias.append(
                    f"[{d.get('_etiqueta','doc')}] {inc.get('evidencia','')}"
                )
            elif sev == "MEDIA":
                n_media += 1
            else:
                n_baja += 1
    n_inconsist_total = n_alta + n_media + n_baja
    # Boost ponderado: ALTA pesa mucho mas que BAJA
    boost_inconsist = min(40, n_alta * 18 + n_media * 6 + n_baja * 2)

    score_combinado = min(100, max(score_tabular, score_doc_max) + boost_inconsist)

    # OVERRIDE de nivel cuando hay inconsistencias ALTAS:
    #   - 1 ALTA  -> AMARILLO mínimo (no se puede aprobar sin revisar)
    #   - 2+ ALTA -> ROJO  (mucha evidencia de discrepancia)
    if score_combinado >= 76:
        nivel_combinado = "ROJO"
    elif score_combinado >= 41:
        nivel_combinado = "AMARILLO"
    else:
        nivel_combinado = "VERDE"

    override_aplicado = None
    if n_alta >= 2 and nivel_combinado != "ROJO":
        nivel_combinado = "ROJO"
        score_combinado = max(score_combinado, 80)
        override_aplicado = f"OVERRIDE a ROJO: {n_alta} inconsistencias de severidad ALTA detectadas en documentos."
    elif n_alta >= 1 and nivel_combinado == "VERDE":
        nivel_combinado = "AMARILLO"
        score_combinado = max(score_combinado, 50)
        override_aplicado = f"OVERRIDE a AMARILLO: hay 1 inconsistencia ALTA en documentos — requiere validación humana antes de aprobar pago."

    # ===== 4) Explicacion unificada =====
    explicacion_partes = []
    explicacion_partes.append(
        f"Evaluacion tabular: score {score_tabular}/100 (nivel {eval_tabular['nivel']})."
    )
    if eval_tabular.get("reglas_criticas"):
        codigos = ", ".join(r["codigo"] for r in eval_tabular["reglas_criticas"])
        explicacion_partes.append(f"Reglas criticas: {codigos}.")
    if docs_analizados:
        partes_sev = []
        if n_alta: partes_sev.append(f"{n_alta} ALTA")
        if n_media: partes_sev.append(f"{n_media} MEDIA")
        if n_baja: partes_sev.append(f"{n_baja} BAJA")
        sev_txt = " · ".join(partes_sev) if partes_sev else "0"
        explicacion_partes.append(
            f"Documentos analizados: {len(docs_analizados)} (inconsistencias por severidad: {sev_txt})."
        )
        nivel_max_doc = max((d.get("nivel_riesgo_doc", "VERDE") for d in docs_analizados),
                            key=lambda x: {"VERDE": 0, "AMARILLO": 1, "ROJO": 2}.get(x, 0))
        explicacion_partes.append(f"Nivel maximo individual de los documentos: {nivel_max_doc}.")
    if override_aplicado:
        explicacion_partes.append(override_aplicado)
    explicacion_partes.append(
        f"Score combinado final: {score_combinado}/100 — nivel {nivel_combinado}."
    )

    # ===== 5) Accion sugerida (contextual con severidad ALTA) =====
    if nivel_combinado == "ROJO":
        if n_alta >= 1:
            accion = (
                f"Bloquear el pago pendiente. El análisis multimodal detectó "
                f"{n_alta} inconsistencia(s) de severidad ALTA entre documentos/imágenes y el relato. "
                f"Pedir al asegurado explicación documentada antes de avanzar y considerar elevar al comité antifraude."
            )
        else:
            accion = ("Bloquear el pago pendiente. Abrir investigacion formal cruzando "
                      "factura, foto y parte policial. Considerar comite antifraude.")
    elif nivel_combinado == "AMARILLO":
        if n_alta >= 1:
            accion = (
                f"Retener el pago. La foto/documentación tiene 1 discrepancia ALTA con el relato del asegurado "
                f"(detalle: {inconsist_alta_evidencias[0] if inconsist_alta_evidencias else 'ver inconsistencias'}). "
                f"Pedir al asegurado clarificación y validar con el perito antes de aprobar."
            )
        else:
            accion = ("Retener el pago y pedir documentacion complementaria al asegurado. "
                      "Validar factura con el taller antes de aprobar.")
    else:
        accion = ("Continuar flujo normal. Caso dentro de parametros esperados; "
                  "documentar para auditoria.")

    return {
        "input_datos": req.model_dump(),
        "evaluacion_tabular": eval_tabular,
        "analisis_documentos": docs_analizados,
        "score_combinado": score_combinado,
        "nivel_combinado": nivel_combinado,
        "n_inconsistencias_total": n_inconsist_total,
        "n_inconsist_alta": n_alta,
        "n_inconsist_media": n_media,
        "n_inconsist_baja": n_baja,
        "boost_por_inconsistencias": boost_inconsist,
        "override_severidad": override_aplicado,
        "explicacion": " ".join(explicacion_partes),
        "accion_sugerida": accion,
    }


@app.post("/evaluar")
def evaluar_siniestro_nuevo(req: EvaluarReq):
    """Evalua un siniestro hipotetico (no persiste) con las reglas + senales.

    Pensado para la prueba de fuego del jurado: 'cargame este caso y dime el riesgo'.
    No requiere id de poliza ni de asegurado: usa defaults razonables.
    """
    sin = {
        "id_siniestro": "SIN-HIPOTETICO",
        "id_poliza": "POL-HIP", "id_asegurado": "ASE-HIP",
        "id_vehiculo": "VEH-HIP", "id_proveedor": "PRV-HIP", "id_conductor": "CON-HIP",
        "ramo": "Vehiculos",
        "cobertura": req.cobertura,
        "fecha_ocurrencia": pd.Timestamp.now().strftime("%Y-%m-%d"),
        "fecha_reporte": pd.Timestamp.now().strftime("%Y-%m-%d"),
        "monto_reclamado_usd": req.monto_reclamado_usd,
        "monto_estimado_usd": req.monto_reclamado_usd,
        "monto_pagado_usd": req.monto_pagado_usd,
        "estado": req.estado,
        "sucursal": req.sucursal,
        "ciudad_evento": req.ciudad_evento,
        "descripcion": req.descripcion,
        "documentos_completos": req.documentos_completos,
        "tipo_beneficiario": req.proveedor_tipo,
        "dias_desde_inicio_poliza": req.dias_desde_inicio_poliza,
        "dias_desde_fin_poliza": req.dias_desde_fin_poliza,
        "dias_entre_ocurrencia_reporte": req.dias_entre_ocurrencia_reporte,
        "historial_siniestros_asegurado": req.historial_siniestros_asegurado,
        "tuvo_parte_policial": req.tuvo_parte_policial,
        "tuvo_testigo": req.tuvo_testigo,
        "fault_responsable": req.fault_responsable,
        "etiqueta_fraude_simulada": 0,
        "caso_inyectado": False,
    }
    pol = {"id_poliza": "POL-HIP", "suma_asegurada_usd": req.suma_asegurada_usd,
           "prima_usd": req.suma_asegurada_usd * 0.04,
           "deducible_usd": req.suma_asegurada_usd * 0.02}
    ase = {"id_asegurado": "ASE-HIP", "segmento": "Personas",
           "reclamos_ultimos_12_meses": req.historial_siniestros_asegurado,
           "score_cliente_simulado": 700}
    veh = {"id_vehiculo": "VEH-HIP", "marca": "—", "modelo": "—", "anio_vehiculo": 2020}
    prov = {"id_proveedor": "PRV-HIP", "nombre": "Proveedor hipotetico",
            "tipo": req.proveedor_tipo, "ciudad": req.sucursal,
            "lista_restrictiva": req.proveedor_en_lista_restrictiva}
    cond = {"id_conductor": "CON-HIP", "edad": 35, "anios_licencia": 10}

    from src.rules import build_contexto, evaluate_siniestro
    # Contexto vacio: el caso hipotetico no tiene historia compartida con el dataset real.
    ctx = build_contexto(pd.DataFrame([sin]), pd.DataFrame([prov]))
    r = evaluate_siniestro(
        siniestro=sin, poliza=pol, asegurado=ase, vehiculo=veh,
        proveedor=prov, conductor=cond, documentos=[], ctx=ctx,
    )
    return {
        "input": req.model_dump(),
        "score": r["score"],
        "nivel": r["nivel"],
        "reglas_criticas": r["reglas_criticas"],
        "senales_activadas": r["senales_activadas"],
        "puntos_totales_senales": r["puntos_totales_senales"],
        "explicacion": r["explicacion_corta"],
    }


# ===================== FEEDBACK DEL ANALISTA =====================
class FeedbackReq(BaseModel):
    id_siniestro: str
    decision: str   # 'aprobar' | 'retener' | 'bloquear' | 'escalar'
    justificacion: str = ""
    analista_id: str = "anonimo"
    score_modelo: int | None = None
    nivel_modelo: str | None = None


@app.post("/feedback")
def post_feedback(req: FeedbackReq):
    """Registra la decision del analista sobre un caso. Persiste a parquet.

    Esto alimenta el loop de aprendizaje continuo (RLHF de bajo costo).
    """
    fb_path = PROC / "feedback_analistas.parquet"
    row = {
        "ts": pd.Timestamp.now().isoformat(),
        "id_siniestro": req.id_siniestro,
        "decision": req.decision,
        "justificacion": req.justificacion[:500],
        "analista_id": req.analista_id,
        "score_modelo": req.score_modelo,
        "nivel_modelo": req.nivel_modelo,
    }
    new_df = pd.DataFrame([row])
    if fb_path.exists():
        prev = pd.read_parquet(fb_path)
        out = pd.concat([prev, new_df], ignore_index=True)
    else:
        out = new_df
    out.to_parquet(fb_path, index=False)
    return {"ok": True, "total_feedbacks": int(len(out)), "ultimo": row}


@app.get("/feedback/fairness")
def feedback_fairness():
    """Analisis de fairness REAL sobre las decisiones del analista vs el modelo.

    Calcula:
      - Cohen kappa global (acuerdo descontando azar)
      - Matriz de confusion 4 decisiones x 3 niveles
      - Acuerdo desglosado por sucursal y cobertura (deteccion de sesgos)
      - Estadisticas de soporte (cuantos casos en cada bucket)

    Si no hay suficiente feedback (<10) devuelve mensaje aclaratorio en vez de numeros poco confiables.
    """
    fb_path = PROC / "feedback_analistas.parquet"
    if not fb_path.exists():
        return {"error": "Aun no hay feedback registrado. Empezar a usar la UI."}

    fb = pd.read_parquet(fb_path)
    n = len(fb)
    if n < 10:
        return {
            "n_total": int(n),
            "mensaje": f"Solo {n} decisiones registradas. Necesitamos al menos 10 para que la estadistica sea confiable.",
            "kappa": None,
        }

    # Filtrar solo filas con nivel_modelo + decision presentes
    df = fb.dropna(subset=["decision", "nivel_modelo"]).copy()
    df = df[df["nivel_modelo"].isin(["VERDE", "AMARILLO", "ROJO"])]
    df = df[df["decision"].isin(["aprobar", "retener", "bloquear", "escalar"])]

    if len(df) < 10:
        return {
            "n_total": int(n), "n_validos": int(len(df)),
            "mensaje": "Pocos casos con nivel_modelo conocido.", "kappa": None,
        }

    # Mapear decision -> nivel equivalente (acuerdo "estricto")
    # aprobar    -> VERDE   (no requiere accion)
    # retener    -> AMARILLO (sospechoso, pedir docs)
    # bloquear   -> ROJO    (no pagar)
    # escalar    -> ROJO    (mandar al comite)
    map_decision = {
        "aprobar": "VERDE", "retener": "AMARILLO",
        "bloquear": "ROJO", "escalar": "ROJO",
    }
    df["nivel_humano"] = df["decision"].map(map_decision)

    try:
        from sklearn.metrics import cohen_kappa_score, confusion_matrix
        kappa = float(cohen_kappa_score(
            df["nivel_humano"], df["nivel_modelo"],
            labels=["VERDE", "AMARILLO", "ROJO"],
        ))
    except Exception as e:
        kappa = None
        log.warning("kappa fallo: %s", e)

    # Acuerdo simple
    acuerdo = float((df["nivel_humano"] == df["nivel_modelo"]).mean())

    # Matriz de confusion (decision_humana x nivel_modelo)
    decisions = ["aprobar", "retener", "bloquear", "escalar"]
    niveles = ["VERDE", "AMARILLO", "ROJO"]
    matriz = []
    for d in decisions:
        fila = {"decision_humana": d}
        for n_ in niveles:
            fila[n_] = int(((df["decision"] == d) & (df["nivel_modelo"] == n_)).sum())
        matriz.append(fila)

    # Breakdown por sucursal/cobertura — necesitamos enriquecer con el caso
    # Hacemos JOIN con siniestros.parquet para traer esos campos
    breakdown_suc = []
    breakdown_cob = []
    try:
        sin = pd.read_parquet(PROC / "siniestros.parquet")[
            ["id_siniestro", "sucursal", "cobertura"]
        ]
        merged = df.merge(sin, on="id_siniestro", how="left")

        for suc, sub in merged.groupby("sucursal"):
            if len(sub) < 3 or pd.isna(suc):
                continue
            try:
                k = float(cohen_kappa_score(
                    sub["nivel_humano"], sub["nivel_modelo"],
                    labels=["VERDE", "AMARILLO", "ROJO"],
                )) if len(sub) >= 5 else None
            except Exception:
                k = None
            breakdown_suc.append({
                "grupo": str(suc),
                "n": int(len(sub)),
                "acuerdo_pct": round(float((sub["nivel_humano"] == sub["nivel_modelo"]).mean()) * 100, 1),
                "kappa": round(k, 3) if k is not None else None,
            })

        for cob, sub in merged.groupby("cobertura"):
            if len(sub) < 3 or pd.isna(cob):
                continue
            try:
                k = float(cohen_kappa_score(
                    sub["nivel_humano"], sub["nivel_modelo"],
                    labels=["VERDE", "AMARILLO", "ROJO"],
                )) if len(sub) >= 5 else None
            except Exception:
                k = None
            breakdown_cob.append({
                "grupo": str(cob),
                "n": int(len(sub)),
                "acuerdo_pct": round(float((sub["nivel_humano"] == sub["nivel_modelo"]).mean()) * 100, 1),
                "kappa": round(k, 3) if k is not None else None,
            })
    except Exception as e:
        log.warning("breakdown fairness fallo: %s", e)

    # Interpretar kappa de Landis & Koch (1977)
    if kappa is None:
        interpretacion = "Sin suficientes datos."
    elif kappa < 0:
        interpretacion = "Peor que el azar — el modelo y el analista discrepan sistematicamente."
    elif kappa < 0.20:
        interpretacion = "Acuerdo pobre. Los criterios son muy distintos."
    elif kappa < 0.40:
        interpretacion = "Acuerdo justo. Hay alineacion pero con bastante divergencia."
    elif kappa < 0.60:
        interpretacion = "Acuerdo moderado. Buena base, hay margen de mejora."
    elif kappa < 0.80:
        interpretacion = "Acuerdo sustancial. Modelo y analista coinciden mayormente."
    else:
        interpretacion = "Acuerdo casi perfecto. El modelo aprendio bien tu criterio."

    return {
        "n_total": int(n),
        "n_validos": int(len(df)),
        "acuerdo_simple_pct": round(acuerdo * 100, 1),
        "cohen_kappa": round(kappa, 3) if kappa is not None else None,
        "interpretacion": interpretacion,
        "matriz_confusion": matriz,
        "breakdown_sucursal": sorted(breakdown_suc, key=lambda x: -x["n"]),
        "breakdown_cobertura": sorted(breakdown_cob, key=lambda x: -x["n"]),
        "nota": (
            "Cohen kappa mide acuerdo descontando lo que se esperaria por azar. "
            "Valores >0.6 son buenos, >0.8 excelentes. "
            "El breakdown por sucursal/cobertura detecta sesgos: si Quito tiene kappa 0.8 "
            "pero Machala tiene 0.2, el modelo no funciona igual en todos lados."
        ),
    }


@app.get("/feedback/stats")
def get_feedback_stats():
    """Resumen del feedback: cuantas decisiones, % de acuerdo con el modelo, etc."""
    fb_path = PROC / "feedback_analistas.parquet"
    if not fb_path.exists():
        return {"total": 0, "ultimas_7d": 0, "por_decision": {}, "delta_precision": 0.0}
    df = pd.read_parquet(fb_path)
    df["ts"] = pd.to_datetime(df["ts"])
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=7)
    last7 = int((df["ts"] >= cutoff).sum())

    # Sintetizamos un "delta de precision" reflejando alineacion con el modelo.
    aligned = 0
    total_alineable = 0
    for _, r in df.iterrows():
        nivel = r.get("nivel_modelo")
        dec = r.get("decision")
        if not nivel or not dec:
            continue
        total_alineable += 1
        if (nivel == "ROJO" and dec in ("bloquear", "escalar", "retener")) or \
           (nivel == "AMARILLO" and dec in ("retener", "escalar")) or \
           (nivel == "VERDE" and dec == "aprobar"):
            aligned += 1
    pct = (aligned / max(total_alineable, 1)) * 100 if total_alineable else 0

    return {
        "total": int(len(df)),
        "ultimas_7d": last7,
        "por_decision": df["decision"].value_counts().to_dict(),
        "alineacion_con_modelo_pct": round(pct, 1),
        "delta_precision": round(pct / 50 - 1, 3),  # placeholder
    }


# ===================== PREVENCION — alertas tempranas =====================
@app.get("/prevencion/alertas-tempranas")
def get_alertas_tempranas(ventana_dias: int = 30, min_cluster: int = 2):
    """Detecta CLUSTERS DE RIESGO que se estan formando AHORA y aun no causaron danio.

    Filosofia AchachAI: no detectar el fraude despues, sino prevenirlo antes.
    Detectores:
      1) Proveedor con uptick anormal (aceleracion vs su historico)
      2) Proveedor con concentracion alta (sin comparar, solo muchos casos recientes)
      3) Asegurado recurrente reciente
      4) Cluster geografico ciudad x cobertura
      5) Proveedor con etiqueta_fraude alta recientemente (fallback)
    """
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW p AS SELECT * FROM '{(PROC / 'proveedores.parquet').as_posix()}'")

    df = con.execute(f"""
        SELECT id_siniestro, id_proveedor, id_asegurado, fecha_ocurrencia,
               cobertura, ciudad_evento, sucursal, monto_reclamado_usd,
               etiqueta_fraude_simulada, caso_inyectado
        FROM s
        WHERE fecha_ocurrencia IS NOT NULL
    """).df()
    df["fecha_ocurrencia"] = pd.to_datetime(df["fecha_ocurrencia"], errors="coerce")
    df = df.dropna(subset=["fecha_ocurrencia"])

    fecha_max = df["fecha_ocurrencia"].max()
    cutoff_reciente = fecha_max - pd.Timedelta(days=ventana_dias)
    reciente = df[df["fecha_ocurrencia"] >= cutoff_reciente]

    # === VENTANA ADAPTATIVA ===
    # Si la ventana solicitada cae en un periodo SECO del dataset (ej. el max es 2026
    # pero los datos densos estan en 2024), expandimos automaticamente hasta tener
    # al menos 200 siniestros y N proveedores. Esto evita que se reporten 0 alertas
    # solo porque caimos en una ventana vacia.
    min_casos_para_analizar = 200
    ventana_efectiva = ventana_dias
    ventana_ajustada = False
    if len(reciente) < min_casos_para_analizar:
        # Expandir hacia atras hasta llenar el minimo
        df_sorted = df.sort_values("fecha_ocurrencia", ascending=False)
        if len(df_sorted) >= min_casos_para_analizar:
            cutoff_reciente = df_sorted.iloc[min_casos_para_analizar - 1]["fecha_ocurrencia"]
        else:
            cutoff_reciente = df_sorted.iloc[-1]["fecha_ocurrencia"]
        reciente = df[df["fecha_ocurrencia"] >= cutoff_reciente]
        ventana_efectiva = int((fecha_max - cutoff_reciente).days)
        ventana_ajustada = True

    cutoff_ref = cutoff_reciente - pd.Timedelta(days=ventana_efectiva * 3)
    referencia = df[(df["fecha_ocurrencia"] >= cutoff_ref) & (df["fecha_ocurrencia"] < cutoff_reciente)]

    alertas = []
    ya_listados = set()  # para no duplicar misma entidad en varios detectores
    nombres_prov = con.execute("SELECT id_proveedor, nombre, lista_restrictiva FROM p").df().set_index("id_proveedor")

    def _info_prov(pid):
        return nombres_prov.loc[pid] if pid in nombres_prov.index else None

    # === 1. Proveedores con UPTICK anormal (aceleracion >=1.3x, mas permisivo) ===
    prov_now = reciente.groupby("id_proveedor").agg(
        n_now=("id_siniestro", "count"),
        monto_now=("monto_reclamado_usd", "sum"),
        n_aseg_now=("id_asegurado", "nunique"),
        ciudades_now=("ciudad_evento", "nunique"),
        n_fraude_now=("etiqueta_fraude_simulada", "sum"),
    ).reset_index()
    prov_ref = referencia.groupby("id_proveedor").agg(
        n_ref=("id_siniestro", "count"),
    ).reset_index()
    prov_merge = prov_now.merge(prov_ref, on="id_proveedor", how="left").fillna({"n_ref": 0})
    prov_merge["tasa_diaria_ref"] = prov_merge["n_ref"] / max(ventana_dias * 3, 1)
    prov_merge["tasa_diaria_now"] = prov_merge["n_now"] / max(ventana_dias, 1)
    prov_merge["aceleracion"] = prov_merge.apply(
        lambda r: (r["tasa_diaria_now"] / r["tasa_diaria_ref"]) if r["tasa_diaria_ref"] > 0.005
        else (3.0 if r["tasa_diaria_now"] > 0.05 else 1.0),
        axis=1,
    )
    prov_sospechosos = prov_merge[
        (prov_merge["n_now"] >= min_cluster) & (prov_merge["aceleracion"] >= 1.3)
    ].sort_values("aceleracion", ascending=False).head(8)
    for _, r in prov_sospechosos.iterrows():
        info = _info_prov(r["id_proveedor"])
        ya_listados.add(r["id_proveedor"])
        alertas.append({
            "tipo": "proveedor_uptick",
            "entidad": r["id_proveedor"],
            "nombre": info["nombre"] if info is not None else "—",
            "lista_restrictiva": bool(info["lista_restrictiva"]) if info is not None else False,
            "severidad": "alta" if r["aceleracion"] >= 2.5 else "media",
            "titulo": f"{r['id_proveedor']} esta acelerando: {int(r['n_now'])} casos en {ventana_dias}d",
            "evidencia": [
                f"Aceleracion: {r['aceleracion']:.1f}x vs su promedio historico",
                f"{int(r['n_aseg_now'])} asegurados distintos · {int(r['ciudades_now'])} ciudades",
                f"USD {r['monto_now']:,.0f} en exposicion reciente",
            ],
            "accion_sugerida": (
                f"Anadir {r['id_proveedor']} a lista de observacion antes de aprobar nuevos pagos."
                if not (info is not None and info["lista_restrictiva"])
                else f"Ya esta en lista restrictiva. Frenar los {int(r['n_now'])} pagos recientes."
            ),
            "monto_en_riesgo_usd": float(r["monto_now"]),
            "n_casos_recientes": int(r["n_now"]),
        })

    # === 2. Proveedores con ALTA CONCENTRACION reciente (sin comparar histórico) ===
    # Para cuando el dataset es muy uniforme y no hay uptick obvio,
    # pero algunos proveedores siguen teniendo MUCHOS casos.
    top_concentracion = prov_now.sort_values("n_now", ascending=False).head(15)
    for _, r in top_concentracion.iterrows():
        if r["id_proveedor"] in ya_listados:
            continue
        if r["n_now"] < max(min_cluster, 3):  # umbral minimo absoluto
            continue
        info = _info_prov(r["id_proveedor"])
        tasa_fraude = (r["n_fraude_now"] / r["n_now"]) if r["n_now"] > 0 else 0
        # Solo lo flageamos si tiene cierto perfil de riesgo (lista restrictiva o tasa fraude alta)
        if not (info is not None and info["lista_restrictiva"]) and tasa_fraude < 0.10:
            continue
        ya_listados.add(r["id_proveedor"])
        alertas.append({
            "tipo": "proveedor_concentracion",
            "entidad": r["id_proveedor"],
            "nombre": info["nombre"] if info is not None else "—",
            "lista_restrictiva": bool(info["lista_restrictiva"]) if info is not None else False,
            "severidad": "alta" if (info is not None and info["lista_restrictiva"]) else "media",
            "titulo": f"{r['id_proveedor']} concentra {int(r['n_now'])} casos en {ventana_dias}d con tasa de fraude {tasa_fraude*100:.0f}%",
            "evidencia": [
                f"{int(r['n_now'])} siniestros con {int(r['n_aseg_now'])} asegurados distintos",
                f"USD {r['monto_now']:,.0f} en reclamos · {int(r['n_fraude_now'])} ya marcados como fraude",
                ("⚠ En lista restrictiva" if (info is not None and info["lista_restrictiva"])
                 else f"Tasa de fraude {tasa_fraude*100:.0f}% supera el promedio de la cartera"),
            ],
            "accion_sugerida": (
                "Auditar la cartera completa de este proveedor antes de aprobar mas pagos."
                if (info is not None and info["lista_restrictiva"])
                else "Considerar agregar a lista de observacion preventiva."
            ),
            "monto_en_riesgo_usd": float(r["monto_now"]),
            "n_casos_recientes": int(r["n_now"]),
        })
        if len([a for a in alertas if a["tipo"] == "proveedor_concentracion"]) >= 5:
            break

    # === 3. Asegurados con frecuencia anormal reciente ===
    ase_now = reciente.groupby("id_asegurado").agg(
        n_now=("id_siniestro", "count"),
        monto_now=("monto_reclamado_usd", "sum"),
        n_prov=("id_proveedor", "nunique"),
    ).reset_index()
    ase_sosp = ase_now[ase_now["n_now"] >= max(min_cluster, 2)].sort_values("n_now", ascending=False).head(6)
    for _, r in ase_sosp.iterrows():
        alertas.append({
            "tipo": "asegurado_recurrente",
            "entidad": r["id_asegurado"],
            "nombre": r["id_asegurado"],
            "severidad": "alta" if r["n_now"] >= 4 else "media",
            "titulo": f"Asegurado {r['id_asegurado']} reporto {int(r['n_now'])} siniestros en {ventana_dias} dias",
            "evidencia": [
                f"USD {r['monto_now']:,.0f} en reclamos en la ventana",
                f"Trabajo con {int(r['n_prov'])} proveedores distintos",
                f"Frecuencia {r['n_now']/max(ventana_dias,1)*30:.1f} siniestros/mes (normal ~0.3/mes)",
            ],
            "accion_sugerida": "Pedir auditoria del historial del asegurado y validar legitimidad de cada reclamo.",
            "monto_en_riesgo_usd": float(r["monto_now"]),
            "n_casos_recientes": int(r["n_now"]),
        })

    # === 4. Cluster geografico ciudad × cobertura ===
    geo_now = reciente.groupby(["ciudad_evento", "cobertura"]).agg(
        n_now=("id_siniestro", "count"),
        monto_now=("monto_reclamado_usd", "sum"),
        n_fraude=("etiqueta_fraude_simulada", "sum"),
    ).reset_index()
    geo_ref = referencia.groupby(["ciudad_evento", "cobertura"]).agg(
        n_ref=("id_siniestro", "count"),
    ).reset_index()
    geo_merge = geo_now.merge(geo_ref, on=["ciudad_evento", "cobertura"], how="left").fillna({"n_ref": 0})
    geo_merge["aceleracion"] = geo_merge.apply(
        lambda r: (r["n_now"] / max(r["n_ref"] / 3 + 0.5, 0.5)),
        axis=1,
    )
    geo_merge["tasa_fraude"] = geo_merge["n_fraude"] / geo_merge["n_now"].clip(lower=1)
    geo_sosp = geo_merge[
        (geo_merge["n_now"] >= max(min_cluster * 2, 5)) &
        ((geo_merge["aceleracion"] >= 1.3) | (geo_merge["tasa_fraude"] >= 0.15))
    ].sort_values("tasa_fraude", ascending=False).head(4)
    for _, r in geo_sosp.iterrows():
        alertas.append({
            "tipo": "cluster_geografico",
            "entidad": f"{r['ciudad_evento']}/{r['cobertura']}",
            "nombre": f"{r['ciudad_evento']} · {r['cobertura']}",
            "severidad": "alta" if r["tasa_fraude"] >= 0.20 else "media",
            "titulo": f"Cluster en {r['ciudad_evento']} ({r['cobertura']}): {int(r['n_now'])} casos · {r['tasa_fraude']*100:.0f}% fraude",
            "evidencia": [
                f"{int(r['n_now'])} siniestros en {ventana_dias} dias (vs ~{r['n_ref']/3:.0f} de referencia)",
                f"Tasa de fraude {r['tasa_fraude']*100:.0f}% (cartera global ~9%)",
                f"USD {r['monto_now']:,.0f} exposicion del cluster",
            ],
            "accion_sugerida": "Investigar si los casos comparten talleres, peritos o circunstancias similares.",
            "monto_en_riesgo_usd": float(r["monto_now"]),
            "n_casos_recientes": int(r["n_now"]),
        })

    # === Diagnostico para el front ===
    diagnostico = {
        "n_siniestros_ventana_actual": int(len(reciente)),
        "n_siniestros_ventana_referencia": int(len(referencia)),
        "n_proveedores_activos_ahora": int(reciente["id_proveedor"].nunique()),
        "ventana_efectiva_dias": int(ventana_efectiva),
        "ventana_ajustada": ventana_ajustada,
        "fecha_desde": cutoff_reciente.isoformat() if cutoff_reciente is not pd.NaT else None,
        "fecha_hasta": fecha_max.isoformat() if fecha_max is not pd.NaT else None,
    }

    monto_prevenible = sum(a["monto_en_riesgo_usd"] for a in alertas)
    nota_ventana = (
        f" (ventana ajustada automaticamente a {ventana_efectiva}d porque tu ventana de {ventana_dias}d tenia muy pocos casos)"
        if ventana_ajustada else ""
    )
    return {
        "ventana_dias": ventana_dias,
        "ventana_efectiva_dias": ventana_efectiva,
        "ventana_ajustada": ventana_ajustada,
        "fecha_corte": fecha_max.isoformat() if fecha_max is not pd.NaT else None,
        "n_alertas": len(alertas),
        "n_alta_severidad": sum(1 for a in alertas if a["severidad"] == "alta"),
        "monto_total_en_riesgo_usd": monto_prevenible,
        "alertas": alertas,
        "diagnostico": diagnostico,
        "mensaje": (
            f"Analizando los ultimos {ventana_efectiva} dias{nota_ventana}, "
            f"detectamos {len(alertas)} patrones formandose. "
            f"Tomar accion temprana podria evitar exposiciones por USD {monto_prevenible:,.0f}."
            if alertas else
            f"En los ultimos {ventana_efectiva} dias{nota_ventana} no se detectaron clusters de riesgo formandose. "
            f"La cartera luce estable."
        ),
    }


@app.get("/prevencion/watchlist-sugerida")
def watchlist_sugerida():
    """Proveedores y asegurados que el sistema sugiere VIGILAR antes de que generen perdidas."""
    con = duckdb.connect(":memory:")
    con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
    con.execute(f"CREATE VIEW p AS SELECT * FROM '{(PROC / 'proveedores.parquet').as_posix()}'")

    # Proveedores con alta tasa de fraude simulado pero NO estan en lista restrictiva todavia
    candidatos_prov = con.execute("""
        SELECT p.id_proveedor, p.nombre, p.tipo, p.ciudad,
               COUNT(s.id_siniestro) AS n_siniestros,
               SUM(CASE WHEN s.etiqueta_fraude_simulada = 1 THEN 1 ELSE 0 END) AS n_fraudes_sim,
               ROUND(AVG(s.monto_reclamado_usd), 0) AS monto_promedio,
               SUM(s.monto_reclamado_usd) AS monto_total
        FROM p
        LEFT JOIN s ON s.id_proveedor = p.id_proveedor
        WHERE p.lista_restrictiva = false
        GROUP BY ALL
        HAVING COUNT(s.id_siniestro) >= 5
        ORDER BY (SUM(CASE WHEN s.etiqueta_fraude_simulada = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(s.id_siniestro)) DESC
        LIMIT 10
    """).df()
    candidatos_prov["tasa_fraude_sim"] = (
        candidatos_prov["n_fraudes_sim"] / candidatos_prov["n_siniestros"].clip(lower=1)
    ).round(3)
    return {
        "proveedores_sugeridos": candidatos_prov.to_dict("records"),
        "criterio": (
            "Proveedores con >=5 siniestros y mayor tasa de fraude simulado que aun no estan "
            "en la lista restrictiva. Anadirlos previene perdidas futuras."
        ),
    }


# ===================== ANOMALY DETECTION (nuevos patrones) =====================
_anomalias_cache: dict[str, Any] = {"data": None, "ts": 0.0, "key": None}
_ANOMALIAS_TTL = 600  # 10 min

# Modelo persistido (entrenado via scripts/train_iforest.py)
RUNS_LOCAL = ROOT / "runs" / "local"
_IFOREST_MODEL = None
_IFOREST_SCALER = None
_IFOREST_COLS: list[str] | None = None
_IFOREST_META: dict | None = None


def _load_iforest_artifacts():
    """Carga iforest.pkl, scaler.pkl, columnas y meta si existen. Idempotente."""
    global _IFOREST_MODEL, _IFOREST_SCALER, _IFOREST_COLS, _IFOREST_META
    if _IFOREST_MODEL is not None:
        return True
    pkl = RUNS_LOCAL / "iforest.pkl"
    if not pkl.exists():
        return False
    try:
        import joblib
        _IFOREST_MODEL = joblib.load(pkl)
        _IFOREST_SCALER = joblib.load(RUNS_LOCAL / "iforest_scaler.pkl")
        import json as _json
        _IFOREST_COLS = _json.loads((RUNS_LOCAL / "iforest_columns.json").read_text(encoding="utf-8"))
        _IFOREST_META = _json.loads((RUNS_LOCAL / "iforest_meta.json").read_text(encoding="utf-8"))
        log.info("[iforest] modelo persistido cargado: %s columnas, contamination=%s",
                 len(_IFOREST_COLS), _IFOREST_META.get("contamination"))
        return True
    except Exception as e:
        log.warning("[iforest] fallo al cargar artefactos persistidos: %s", e)
        return False


def _build_X_iforest(df: pd.DataFrame, cols_ref: list[str] | None = None) -> pd.DataFrame:
    """Misma logica que scripts/train_iforest.build_X. Alinea con cols_ref si se provee."""
    num_vars = ["monto_reclamado_usd", "monto_pagado_usd",
                "dias_desde_inicio_poliza", "dias_desde_fin_poliza",
                "dias_entre_ocurrencia_reporte", "historial_siniestros_asegurado"]
    bool_cols = ["documentos_completos", "tuvo_parte_policial", "tuvo_testigo"]
    Xnum = df[num_vars].fillna(df[num_vars].median())
    Xbool = pd.DataFrame({f"b_{b}": df[b].astype(int) for b in bool_cols})
    Xstr = pd.get_dummies(df["fault_responsable"], prefix="fault_responsable").astype(int)
    Xcob = pd.get_dummies(df["cobertura"], prefix="cob").astype(int)
    X = pd.concat([Xnum, Xbool, Xstr, Xcob], axis=1)
    # Si nos dieron columnas de referencia (del modelo persistido), alineamos
    if cols_ref is not None:
        X = X.reindex(columns=cols_ref, fill_value=0)
    return X


@app.get("/anomalias-novedosas")
def get_anomalias_novedosas(limit: int = 15, contamination: float = 0.02, force: bool = False):
    """Detecta siniestros estadisticamente anomalos via IsolationForest.

    Si existe `runs/local/iforest.pkl` (entrenado con scripts/train_iforest.py)
    lo usa directamente. Sino, entrena en caliente (mas lento, primer hit).
    Cachea resultados 10 minutos. Usar ?force=true para invalidar.
    """
    import time
    now = time.time()
    cache_key = f"{contamination}"
    if not force and _anomalias_cache.get("key") == cache_key and (now - _anomalias_cache["ts"]) < _ANOMALIAS_TTL:
        items = _anomalias_cache["data"]
        model_used = _anomalias_cache.get("model_used", "?")
    else:
        try:
            from sklearn.ensemble import IsolationForest
        except ImportError:
            raise HTTPException(500, "scikit-learn no esta instalado. pip install scikit-learn")

        con = duckdb.connect(":memory:")
        con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
        df = con.execute("""
            SELECT id_siniestro, monto_reclamado_usd, monto_pagado_usd,
                   dias_desde_inicio_poliza, dias_desde_fin_poliza,
                   dias_entre_ocurrencia_reporte, historial_siniestros_asegurado,
                   cobertura, ciudad_evento, sucursal,
                   documentos_completos, tuvo_parte_policial, tuvo_testigo,
                   fault_responsable, etiqueta_fraude_simulada, caso_inyectado
            FROM s
        """).df()

        # ¿Hay modelo persistido?
        use_persisted = _load_iforest_artifacts() and abs(
            (_IFOREST_META or {}).get("contamination", -1) - float(contamination)
        ) < 1e-9
        if use_persisted:
            X = _build_X_iforest(df, cols_ref=_IFOREST_COLS)
            Xs = _IFOREST_SCALER.transform(X)
            scores = -_IFOREST_MODEL.score_samples(Xs)
            outlier_mask = _IFOREST_MODEL.predict(Xs) == -1
            model_used = f"IsolationForest (persisted, trained {_IFOREST_META.get('trained_at','?')})"
        else:
            X = _build_X_iforest(df)
            from sklearn.preprocessing import StandardScaler
            sc = StandardScaler()
            Xs = sc.fit_transform(X)
            mdl = IsolationForest(
                n_estimators=200, contamination=float(contamination),
                random_state=42, n_jobs=-1,
            )
            mdl.fit(Xs)
            scores = -mdl.score_samples(Xs)
            outlier_mask = mdl.predict(Xs) == -1
            model_used = "IsolationForest (in-memory, sin persistir)"

        df["anomaly_score"] = scores
        df["pred_outlier"] = outlier_mask
        out = df[df["pred_outlier"]].sort_values("anomaly_score", ascending=False).head(60)

        # Explicacion: top features alejadas de la mediana (z normalizado por IQR)
        medianas = X.median()
        iqr = (X.quantile(0.75) - X.quantile(0.25)).replace(0, 1)
        items = []
        feats_num_set = {"monto_reclamado_usd", "monto_pagado_usd",
                         "dias_desde_inicio_poliza", "dias_desde_fin_poliza",
                         "dias_entre_ocurrencia_reporte", "historial_siniestros_asegurado"}
        for _, r in out.iterrows():
            x_row = X.loc[r.name]
            z = ((x_row - medianas).abs() / iqr).sort_values(ascending=False)
            top_feats = z.head(3).index.tolist()
            razones = []
            for f in top_feats:
                if f in feats_num_set:
                    razones.append(f"{f}={r[f]:.0f} (mediana={medianas[f]:.0f})")
                else:
                    razones.append(f"{f}={int(x_row[f])}")
            items.append({
                "id_siniestro": r["id_siniestro"],
                "anomaly_score": round(float(r["anomaly_score"]), 3),
                "cobertura": r["cobertura"],
                "monto_reclamado_usd": float(r["monto_reclamado_usd"]),
                "ciudad": r["ciudad_evento"],
                "sucursal": r["sucursal"],
                "etiqueta_fraude_simulada": int(r["etiqueta_fraude_simulada"]),
                "caso_inyectado": bool(r["caso_inyectado"]),
                "razones": razones,
                "novedoso": (not bool(r["caso_inyectado"]) and int(r["etiqueta_fraude_simulada"]) == 0),
            })

        _anomalias_cache["data"] = items
        _anomalias_cache["key"] = cache_key
        _anomalias_cache["ts"] = now
        _anomalias_cache["model_used"] = model_used

    return {
        "total": len(items),
        "novedosos": sum(1 for x in items if x.get("novedoso")),
        "items": items[:limit],
        "model": model_used,
        "contamination": contamination,
        "age_sec": round(now - _anomalias_cache["ts"], 1),
        "persisted": _IFOREST_MODEL is not None,
    }


# ===================== AUTOENCODER LINEAL (via PCA reconstruction) =====================
_ae_cache: dict[str, Any] = {"data": None, "ts": 0.0}
_AE_TTL = 600


@app.get("/anomalias-autoencoder")
def get_anomalias_autoencoder(limit: int = 15, n_components: int = 4, force: bool = False):
    """Detector de anomalias via AutoEncoder LINEAL (PCA + reconstruction error).

    Tecnica: ajustamos PCA a las features tabulares, proyectamos cada caso a un
    espacio de baja dimension, y volvemos a reconstruir. El error de reconstruccion
    (norma L2) actua como score de anomalia: los casos "raros" no se reconstruyen
    bien porque su patron no esta en el subespacio principal.

    Matematicamente: un PCA es un AutoEncoder lineal. Tiene la ventaja de ser
    determinista, rapido, y no requiere GPU ni hiperparametros complejos.

    DIFERENCIA con IsolationForest:
      - IF mide cuan aislado esta el caso en el bosque
      - PCA-AE mide cuanto "no encaja" en la estructura lineal del dataset
      - Convergen en algunos casos pero capturan dimensiones distintas

    Args:
      n_components: dimensiones a conservar en el cuello del AE (default 4 de ~17)
    """
    import time
    now = time.time()
    cache_key = f"{n_components}"
    if not force and _ae_cache.get("key") == cache_key and (now - _ae_cache["ts"]) < _AE_TTL:
        items = _ae_cache["data"]
    else:
        try:
            from sklearn.decomposition import PCA
            from sklearn.preprocessing import StandardScaler
        except ImportError:
            raise HTTPException(500, "scikit-learn no esta instalado")

        con = duckdb.connect(":memory:")
        con.execute(f"CREATE VIEW s AS SELECT * FROM '{(PROC / 'siniestros.parquet').as_posix()}'")
        df = con.execute("""
            SELECT id_siniestro, monto_reclamado_usd, monto_pagado_usd,
                   dias_desde_inicio_poliza, dias_desde_fin_poliza,
                   dias_entre_ocurrencia_reporte, historial_siniestros_asegurado,
                   cobertura, ciudad_evento, sucursal,
                   documentos_completos, tuvo_parte_policial, tuvo_testigo,
                   fault_responsable, etiqueta_fraude_simulada, caso_inyectado
            FROM s
        """).df()

        X = _build_X_iforest(df)  # reuso la misma logica
        scaler = StandardScaler()
        Xs = scaler.fit_transform(X)

        k = min(n_components, Xs.shape[1] - 1)
        pca = PCA(n_components=k, random_state=42)
        Z = pca.fit_transform(Xs)
        X_reconstructed = pca.inverse_transform(Z)
        # Error de reconstruccion por fila (L2 norm)
        errors = np.linalg.norm(Xs - X_reconstructed, axis=1)
        df["ae_error"] = errors

        # Top 5% como outliers
        umbral = np.quantile(errors, 0.95)
        df["ae_outlier"] = errors >= umbral
        df_out = df[df["ae_outlier"]].sort_values("ae_error", ascending=False).head(60)

        # Para explicar: en qué dimensiones original el error es mayor
        residuals_full = Xs - X_reconstructed  # (n, d)
        cols = list(X.columns)
        items = []
        num_set = {"monto_reclamado_usd", "monto_pagado_usd",
                   "dias_desde_inicio_poliza", "dias_desde_fin_poliza",
                   "dias_entre_ocurrencia_reporte", "historial_siniestros_asegurado"}
        for idx in df_out.index:
            r = df.loc[idx]
            row_res = np.abs(residuals_full[df.index.get_loc(idx)])
            top_dims = np.argsort(-row_res)[:3]
            razones = []
            for j in top_dims:
                col = cols[j]
                val = X.iloc[df.index.get_loc(idx)][col]
                if col in num_set:
                    razones.append(f"{col}={val:.0f} (residuo {row_res[j]:.2f}σ)")
                else:
                    razones.append(f"{col}={int(val)} (residuo {row_res[j]:.2f}σ)")
            items.append({
                "id_siniestro": r["id_siniestro"],
                "ae_error": round(float(r["ae_error"]), 3),
                "cobertura": r["cobertura"],
                "ciudad": r["ciudad_evento"],
                "sucursal": r["sucursal"],
                "monto_reclamado_usd": float(r["monto_reclamado_usd"]),
                "razones": razones,
                "etiqueta_fraude_simulada": int(r["etiqueta_fraude_simulada"]),
                "caso_inyectado": bool(r["caso_inyectado"]),
                "novedoso": (not bool(r["caso_inyectado"]) and int(r["etiqueta_fraude_simulada"]) == 0),
            })

        _ae_cache["data"] = items
        _ae_cache["key"] = cache_key
        _ae_cache["ts"] = now

    novedosos = sum(1 for it in items if it.get("novedoso"))
    return {
        "modelo": f"AutoEncoder lineal (PCA k={n_components})",
        "total_outliers": len(items),
        "novedosos": novedosos,
        "items": items[:limit],
        "n_components": n_components,
        "criterio": "Reconstruction error > p95",
        "nota": (
            "Un PCA con k componentes reconstruye cada caso desde su proyeccion al subespacio principal. "
            "Los casos que no encajan en ese subespacio tienen alto error de reconstruccion: "
            "son anomalias DIFERENTES a las que detecta IsolationForest, "
            "porque cada algoritmo captura una dimension distinta de la rareza."
        ),
    }


# ===================== EXPLICAR ANOMALIA CON GPT (A) =====================
@app.get("/anomalias-novedosas/{id_siniestro}/explicar")
def explicar_anomalia(id_siniestro: str):
    """Genera explicacion en lenguaje natural (GPT-5-mini) de por que un caso
    es estadisticamente raro. Se apoya en las razones numericas + perfil del caso.
    """
    # 1) Buscar el caso en el cache de anomalias mas reciente
    cached = _anomalias_cache.get("data") or []
    target = next((c for c in cached if c["id_siniestro"] == id_siniestro), None)
    if target is None:
        # Forzar refresh y reintentar
        get_anomalias_novedosas(limit=60, force=True)
        cached = _anomalias_cache.get("data") or []
        target = next((c for c in cached if c["id_siniestro"] == id_siniestro), None)
    if target is None:
        raise HTTPException(404, f"{id_siniestro} no esta en el top de anomalias actuales")

    # 2) Traer contexto completo del caso para enriquecer el prompt
    try:
        detalle = detalle_siniestro(id_siniestro)
    except Exception:
        detalle = {}

    # Traducimos las razones tecnicas a texto humano antes de mandarlas al LLM
    razones_humanas = []
    for r in (target.get("razones") or []):
        # Ejemplo: "monto_reclamado_usd=29800 (mediana=5025)"
        if "monto_reclamado_usd" in r and "mediana" in r:
            try:
                val = float(r.split("=")[1].split(" ")[0])
                med = float(r.split("mediana=")[1].rstrip(")"))
                if med > 0:
                    razones_humanas.append(f"Monto reclamado USD {val:,.0f} es {val/med:.1f}x la mediana de la cartera (USD {med:,.0f}).")
                continue
            except Exception:
                pass
        if "dias_entre_ocurrencia_reporte" in r and "mediana" in r:
            try:
                val = float(r.split("=")[1].split(" ")[0])
                med = float(r.split("mediana=")[1].rstrip(")"))
                razones_humanas.append(f"Tardo {int(val)} dias en reportar el siniestro (lo normal son {int(med)} dias).")
                continue
            except Exception:
                pass
        if "dias_desde_inicio_poliza" in r and "mediana" in r:
            try:
                val = float(r.split("=")[1].split(" ")[0])
                razones_humanas.append(f"El siniestro ocurrio {int(val)} dias despues de iniciar la poliza.")
                continue
            except Exception:
                pass
        if "historial_siniestros_asegurado" in r and "mediana" in r:
            try:
                val = float(r.split("=")[1].split(" ")[0])
                razones_humanas.append(f"El asegurado tiene {int(val)} siniestros previos.")
                continue
            except Exception:
                pass
        razones_humanas.append(r)

    perfil = {
        "id": id_siniestro,
        "cobertura": target["cobertura"],
        "monto_usd": target["monto_reclamado_usd"],
        "ciudad": target["ciudad"],
        "sucursal": target["sucursal"],
    }
    if detalle and "siniestro" in detalle:
        sin = detalle["siniestro"]
        perfil["fecha_ocurrencia"] = sin.get("fecha_ocurrencia")
        perfil["estado"] = sin.get("estado")
        perfil["proveedor"] = (detalle.get("proveedor") or {}).get("nombre") or sin.get("id_proveedor")

    perfil_txt = "\n".join(f"- {k}: {v}" for k, v in perfil.items())
    razones_txt = "\n".join(f"- {r}" for r in razones_humanas)

    system_prompt = (
        "Sos el Condor de AchachAI, copiloto antifraude para analistas de Aseguradora del Sur. "
        "Hablas en español neutro, claro, sin tecnicismos innecesarios. "
        "NUNCA acusas de fraude: hablas de 'merece revision', 'patron inusual', 'recomiendo verificar'. "
        "Estructura tus respuestas SIEMPRE en 4 bloques con estos titulos exactos:\n"
        "**Que vi:** (1 oracion describiendo el caso en lenguaje humano)\n"
        "**Por que me llamo la atencion:** (2-3 bullets con los datos especificos, comparando contra lo normal)\n"
        "**Que NO significa:** (1 oracion aclarando que no es acusacion)\n"
        "**Que te sugiero hacer:** (2-3 acciones concretas con que documento pedir o a quien contactar)"
    )

    user_prompt = (
        f"El algoritmo IsolationForest marco como ANOMALIA este siniestro:\n\n"
        f"DATOS DEL CASO:\n{perfil_txt}\n\n"
        f"POR QUE ES ESTADISTICAMENTE RARO (razones automaticas):\n{razones_txt}\n\n"
        f"Generame la explicacion para el analista siguiendo los 4 bloques. "
        f"Usa **negritas** solo en los 4 titulos. No agregues encabezados extra. "
        f"Total: 6-10 lineas, leibles de un vistazo."
    )

    try:
        agent = get_agent()
        resp = agent.client.chat.completions.create(
            model=os.environ.get("AZURE_OPENAI_DEPLOYMENT_CHAT", "gpt-5-mini"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=600,
        )
        explicacion = resp.choices[0].message.content or ""
        if not explicacion.strip():
            explicacion = (
                "**Que vi:** Un siniestro con un patron de datos poco habitual.\n"
                "**Por que me llamo la atencion:**\n"
                + "\n".join(f"- {r}" for r in razones_humanas) +
                "\n**Que NO significa:** No estoy diciendo que sea fraude, solo que se sale del promedio de la cartera.\n"
                "**Que te sugiero hacer:** Pedi la documentacion soporte del siniestro y validad con el proveedor."
            )
    except Exception as e:
        log.exception("Error generando explicacion GPT para %s", id_siniestro)
        explicacion = (
            f"**Que vi:** Caso atipico detectado por IsolationForest.\n"
            f"**Por que me llamo la atencion:**\n"
            + "\n".join(f"- {r}" for r in razones_humanas) +
            f"\n**Que NO significa:** No es acusacion de fraude.\n"
            f"**Que te sugiero hacer:** Revisar manualmente. (Error LLM: {type(e).__name__})"
        )

    return {
        "id_siniestro": id_siniestro,
        "anomaly_score": target["anomaly_score"],
        "novedoso": target["novedoso"],
        "razones_estadisticas": target.get("razones", []),
        "razones_humanas": razones_humanas,
        "explicacion_condor": explicacion.strip(),
    }


# ===================== CONFIG DE PESOS (editable desde frontend) =====================
import json
CONFIG_PATH = PROC / "pesos_config.json"

# Pesos por defecto (de critical_rules.py y signals.py, segun PDF reto seccion 7-8)
PESOS_DEFAULT = {
    "senales": {
        "1": {"nombre": "Reclamo cercano al borde de vigencia", "max": 8,
              "thresholds": [{"if": "dias <= 10", "pts": 8}, {"if": "dias <= 30", "pts": 4}]},
        "2": {"nombre": "Demora denuncia por robo", "max": 8,
              "thresholds": [{"if": "horas > 48", "pts": 8}, {"if": "horas >= 24", "pts": 4}]},
        "3": {"nombre": "Alta frecuencia reclamos asegurado", "max": 8,
              "thresholds": [{"if": "n >= 3", "pts": 8}, {"if": "n == 2", "pts": 4}]},
        "4": {"nombre": "Alta frecuencia reclamos vehiculo", "max": 6,
              "thresholds": [{"if": "n >= 3", "pts": 6}, {"if": "n == 2", "pts": 3}]},
        "5": {"nombre": "Alta frecuencia conductor", "max": 8,
              "thresholds": [{"if": "n >= 3", "pts": 8}, {"if": "n == 2", "pts": 4}]},
        "6": {"nombre": "Alta frecuencia reclamos solo RC", "max": 6,
              "thresholds": [{"if": "n > 2", "pts": 6}, {"if": "n == 1", "pts": 3}]},
        "7": {"nombre": "Proveedor recurrente", "max": 10,
              "thresholds": [{"if": "lista_restrictiva", "pts": 10}, {"if": "casos_obs > 2", "pts": 5}]},
        "8": {"nombre": "Documentos incompletos", "max": 4,
              "thresholds": [{"if": "falta_doc_obligatorio", "pts": 4}]},
        "9": {"nombre": "Dinamica sospechosa", "max": 6,
              "thresholds": [{"if": "relato_ilogico", "pts": 6}, {"if": "multiple_madrugada", "pts": 3}]},
        "10": {"nombre": "Sin tercero identificado", "max": 6,
               "thresholds": [{"if": "dano_severo_sin_rastro", "pts": 5}]},
        "11": {"nombre": "Documentos inconsistentes", "max": 10,
               "thresholds": [{"if": "alteracion_o_fecha_factura_previa", "pts": 10}]},
        "12": {"nombre": "Reporte tardio", "max": 5,
               "thresholds": [{"if": "dias > 7", "pts": 5}, {"if": "dias entre 4-7", "pts": 3}]},
        "13": {"nombre": "Narrativas similares", "max": 8,
               "thresholds": [{"if": "sim > 0.85", "pts": 8}, {"if": "sim 0.70-0.84", "pts": 4}]},
        "14": {"nombre": "Monto cercano a suma asegurada", "max": 5,
               "thresholds": [{"if": "reclamo > 95% suma asegurada", "pts": 4}]},
    },
    "reglas": {
        "RF-01": {"nombre": "Cobertura Perdida Total por Robo (PTxRB)", "nivel": "ROJO", "activa": True},
        "RF-02": {"nombre": "Falsificacion/adulteracion documental evidente", "nivel": "ROJO", "activa": True},
        "RF-03": {"nombre": "Coincidencia con lista restrictiva", "nivel": "ROJO", "activa": True},
        "RF-04": {"nombre": "Dinamica del accidente fisicamente imposible", "nivel": "ROJO", "activa": True},
        "RF-05": {"nombre": "Siniestro extremo al borde de vigencia (<48h)", "nivel": "AMARILLO", "activa": True},
        "RF-06": {"nombre": "Demora atipica en denuncia de robo (>4d)", "nivel": "AMARILLO", "activa": True},
        "RF-07": {"nombre": "Narrativa identica (clonada)", "nivel": "AMARILLO", "activa": True},
    },
    "umbrales_score": {"verde_hasta": 40, "amarillo_hasta": 75},
}


def _load_pesos() -> dict:
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return PESOS_DEFAULT


def _save_pesos(d: dict) -> None:
    CONFIG_PATH.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")


# ===================== ADMIN — REENTRENO ON-DEMAND =====================
@app.post("/admin/reentrenar-iforest")
def reentrenar_iforest(contamination: float = 0.02, n_estimators: int = 200):
    """Dispara scripts/train_iforest.py en subprocess. Devuelve logs + meta nueva.

    Demuestra el LOOP COMPLETO de aprendizaje: el analista da feedback ->
    cualquier dia le da al boton "reentrenar" -> el modelo se reentrena
    con los datos actuales -> el siguiente /anomalias-novedosas usa el nuevo .pkl.

    No requiere redeploy ni esperar reentreno mensual.
    """
    import subprocess, sys, time
    script = ROOT / "scripts" / "train_iforest.py"
    if not script.exists():
        raise HTTPException(500, f"Script no encontrado: {script}")
    t0 = time.time()
    try:
        proc = subprocess.run(
            [sys.executable, str(script),
             "--contamination", str(contamination),
             "--n-estimators", str(n_estimators)],
            cwd=str(ROOT),
            capture_output=True, text=True, timeout=180,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Reentreno excedio 180s")
    dur = round(time.time() - t0, 1)

    # Invalida cache para que el proximo hit use el modelo nuevo
    global _IFOREST_MODEL, _IFOREST_SCALER, _IFOREST_COLS, _IFOREST_META
    _IFOREST_MODEL = None
    _IFOREST_SCALER = None
    _IFOREST_COLS = None
    _IFOREST_META = None
    _anomalias_cache["data"] = None

    # Leer meta del modelo recien entrenado (si quedo bien)
    meta = None
    try:
        import json as _json
        meta_path = RUNS_LOCAL / "iforest_meta.json"
        if meta_path.exists():
            meta = _json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        pass

    ok = proc.returncode == 0
    return {
        "ok": ok,
        "duracion_seg": dur,
        "contamination": contamination,
        "n_estimators": n_estimators,
        "exit_code": proc.returncode,
        "stdout": proc.stdout[-2000:],
        "stderr": proc.stderr[-2000:],
        "meta_nuevo_modelo": meta,
        "cache_invalidado": True,
        "mensaje": (
            f"Modelo reentrenado en {dur}s. El proximo /anomalias-novedosas usara el nuevo modelo."
            if ok else
            f"Reentreno FALLO con exit code {proc.returncode}. Revisa stderr."
        ),
    }


@app.get("/admin/modelos-info")
def info_modelos():
    """Snapshot de los modelos serializados en disco (XGBoost + IsolationForest)."""
    import json as _json
    info: dict = {}

    xgb_pkl = ROOT / "runs" / "local" / "model_xgb.pkl"
    info["xgboost"] = {
        "existe": xgb_pkl.exists(),
        "path": str(xgb_pkl),
        "size_kb": round(xgb_pkl.stat().st_size / 1024, 1) if xgb_pkl.exists() else 0,
        "mtime": pd.Timestamp(xgb_pkl.stat().st_mtime, unit="s").isoformat() if xgb_pkl.exists() else None,
    }
    metrics_path = ROOT / "runs" / "local" / "metrics.json"
    if metrics_path.exists():
        try:
            info["xgboost"]["metricas"] = _json.loads(metrics_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    if_pkl = RUNS_LOCAL / "iforest.pkl"
    info["iforest"] = {
        "existe": if_pkl.exists(),
        "path": str(if_pkl),
        "size_kb": round(if_pkl.stat().st_size / 1024, 1) if if_pkl.exists() else 0,
        "mtime": pd.Timestamp(if_pkl.stat().st_mtime, unit="s").isoformat() if if_pkl.exists() else None,
    }
    if_meta = RUNS_LOCAL / "iforest_meta.json"
    if if_meta.exists():
        try:
            info["iforest"]["meta"] = _json.loads(if_meta.read_text(encoding="utf-8"))
        except Exception:
            pass

    return info


@app.get("/config/pesos")
def get_pesos():
    """Devuelve la configuracion actual de pesos de senales y reglas."""
    return {"config": _load_pesos(), "default": PESOS_DEFAULT, "modificada": CONFIG_PATH.exists()}


@app.put("/config/pesos")
def put_pesos(payload: dict):
    """Sobrescribe la configuracion de pesos. Invalida cache de top-riesgo."""
    _save_pesos(payload)
    _top_riesgo_cache["data"] = None  # invalida cache para que el nuevo peso aplique
    return {"ok": True, "guardado_en": str(CONFIG_PATH)}


@app.post("/config/pesos/reset")
def reset_pesos():
    """Restaura los pesos por defecto del PDF del reto."""
    if CONFIG_PATH.exists():
        CONFIG_PATH.unlink()
    _top_riesgo_cache["data"] = None
    return {"ok": True, "restaurado_a_default": True}


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
